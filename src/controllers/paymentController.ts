/**
 * Payment Controller
 * Handles payment-related HTTP requests
 */

import { Request, Response, NextFunction } from "express";
import * as paygicService from "../services/paygicService";
import * as bookingService from "../services/bookingService";
import { createError } from "../utils/errorHandler";
import { ENV } from "../config/env";

/**
 * Create payment page for a booking
 * POST /payments/create
 */
export const createPaymentPage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.uid;
    const { bookingId, customerName, customerEmail, customerMobile } = req.body;

    // Validation
    if (!bookingId) {
      throw createError("Booking ID is required", 400);
    }

    if (!customerName || !customerEmail || !customerMobile) {
      throw createError(
        "Customer name, email, and mobile are required",
        400
      );
    }

    // Get booking details
    const booking = await bookingService.getBookingById(bookingId);

    if (!booking) {
      throw createError("Booking not found", 404);
    }

    // Verify booking belongs to the user
    if (booking.userId !== userId) {
      throw createError("Unauthorized: Booking does not belong to user", 403);
    }

    if (booking.paymentStatus === "paid") {
      throw createError("Booking is already paid", 400);
    }

    if (!booking.fare) {
      throw createError("Booking fare not found", 400);
    }

    // Generate unique merchant reference ID
    const merchantReferenceId = `${bookingId}-${Date.now()}`;

    // Construct redirect URLs
    // For mobile apps, use deep link format (parcelapp://) or web URL
    // Paygic will redirect to these URLs after payment
    const baseUrl = ENV.PAYGIC_SUCCESS_URL || `${req.protocol}://${req.get("host")}`;
    const failedBaseUrl = ENV.PAYGIC_FAILED_URL || baseUrl;
    const successUrl = `${baseUrl}/api/payments/success?bookingId=${bookingId}&merchantRefId=${merchantReferenceId}`;
    const failedUrl = `${failedBaseUrl}/api/payments/failed?bookingId=${bookingId}&merchantRefId=${merchantReferenceId}`;

    // Create payment page on Paygic
    const paymentResponse = await paygicService.createPaymentPage(
      merchantReferenceId,
      booking.fare,
      customerMobile,
      customerName,
      customerEmail,
      successUrl,
      failedUrl
    );

    // Debug: Log the response structure
    console.log("Paygic payment response:", JSON.stringify(paymentResponse, null, 2));

    // Check if payment response has data
    if (!paymentResponse) {
      throw createError("Invalid payment response from Paygic: response is null or undefined", 500);
    }

    if (!paymentResponse.data) {
      console.error("Payment response structure:", paymentResponse);
      throw createError(
        `Invalid payment response from Paygic: missing data property. Response: ${JSON.stringify(paymentResponse)}`,
        500
      );
    }

    if (!paymentResponse.data.payPageUrl) {
      console.error("Payment response data:", paymentResponse.data);
      throw createError(
        `Invalid payment response from Paygic: missing payPageUrl. Data: ${JSON.stringify(paymentResponse.data)}`,
        500
      );
    }

    res.status(200).json({
      success: true,
      data: {
        paymentUrl: paymentResponse.data.payPageUrl,
        merchantReferenceId: paymentResponse.data.merchantReferenceId,
        paygicReferenceId: paymentResponse.data.paygicReferenceId,
        expiry: paymentResponse.data.expiry,
        amount: paymentResponse.data.amount,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Check payment status
 * POST /payments/status
 */
export const checkPaymentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { merchantReferenceId } = req.body;

    if (!merchantReferenceId) {
      throw createError("Merchant reference ID is required", 400);
    }

    const statusResponse = await paygicService.checkPaymentStatus(
      merchantReferenceId
    );

    // Return status regardless of whether it's SUCCESS, PENDING, or FAILED
    // Frontend should handle these cases appropriately
    res.status(200).json({
      success: true,
      data: {
        status: statusResponse.txnStatus,
        message: statusResponse.msg,
        ...(statusResponse.data || {}),
      },
    });
  } catch (error: any) {
    // If the error message indicates transaction status, handle it gracefully
    if (error.message?.includes("Transaction is not successful") || 
        error.message?.includes("not successful")) {
      // This might mean the transaction is still pending or failed
      // Return a pending status instead of throwing
      res.status(200).json({
        success: true,
        data: {
          status: "PENDING" as const,
          message: error.message || "Transaction status could not be determined",
        },
      });
      return;
    }
    next(error);
  }
};

/**
 * Payment webhook/callback handler
 * POST /payments/webhook
 */
export const handleWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Validate webhook payload
    const webhookData = paygicService.validateWebhookPayload(req.body);

    const { txnStatus, data } = webhookData;
    const merchantReferenceId = data.merchantReferenceId;

    // Extract booking ID from merchant reference ID (format: bookingId-timestamp)
    const bookingId = merchantReferenceId.split("-")[0];

    // Update booking payment status based on transaction status
    if (txnStatus === "SUCCESS") {
      // This will also confirm the booking (set status from PendingPayment to Created)
      await bookingService.updatePaymentStatus(bookingId, "paid");
    } else if (txnStatus === "FAILED") {
      await bookingService.updatePaymentStatus(bookingId, "failed");
    }

    // Log webhook for debugging
    console.log("Payment webhook received:", {
      bookingId,
      merchantReferenceId,
      txnStatus,
      amount: data.amount,
      paygicReferenceId: data.paygicReferenceId,
    });

    // Return success response to Paygic
    res.status(200).json({
      success: true,
      message: "Webhook received",
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    // Still return 200 to prevent Paygic from retrying
    res.status(200).json({
      success: false,
      message: error.message || "Webhook processing failed",
    });
  }
};

/**
 * Payment success redirect handler
 * GET /payments/success
 */
export const paymentSuccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { bookingId, merchantRefId } = req.query;

    if (!bookingId || !merchantRefId) {
      throw createError("Missing required parameters", 400);
    }

    // Verify payment status
    const statusResponse = await paygicService.checkPaymentStatus(
      merchantRefId as string
    );

    if (statusResponse.txnStatus === "SUCCESS") {
      // Update booking payment status (this will also confirm booking from PendingPayment to Created)
      await bookingService.updatePaymentStatus(
        bookingId as string,
        "paid"
      );

      // Redirect to success page (mobile app will handle this)
      res.status(200).json({
        success: true,
        message: "Payment successful",
        bookingId,
        merchantReferenceId: merchantRefId,
      });
    } else {
      // Redirect to failed page
      res.redirect(
        `/api/payments/failed?bookingId=${bookingId}&merchantRefId=${merchantRefId}`
      );
    }
  } catch (error: any) {
    next(error);
  }
};

/**
 * Payment failed redirect handler
 * GET /payments/failed
 */
export const paymentFailed = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { bookingId, merchantRefId } = req.query;

    if (bookingId) {
      // Update booking payment status to failed
      await bookingService.updatePaymentStatus(
        bookingId as string,
        "failed"
      );
    }

    res.status(200).json({
      success: false,
      message: "Payment failed",
      bookingId,
      merchantReferenceId: merchantRefId,
    });
  } catch (error: any) {
    next(error);
  }
};

