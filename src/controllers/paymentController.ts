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
 * For online payments, this now accepts booking data and creates booking only after payment success
 */
export const createPaymentPage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.uid;
    const { 
      bookingId, // Optional - if booking already exists (COD flow)
      bookingData, // For online payments - booking data to create after payment
      customerName, 
      customerEmail, 
      customerMobile 
    } = req.body;

    // Validation
    if (!customerName || !customerEmail || !customerMobile) {
      throw createError(
        "Customer name, email, and mobile are required",
        400
      );
    }

    let booking;
    let fare: number;
    let merchantReferenceId: string;

    if (bookingId) {
      // Existing booking (COD or retry payment)
      booking = await bookingService.getBookingById(bookingId);

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

      fare = booking.fare;
      merchantReferenceId = `${bookingId}-${Date.now()}`;
    } else if (bookingData) {
      // New online payment - booking will be created after payment success
      // Validate booking data
      if (!bookingData.pickup || !bookingData.drop || !bookingData.parcelDetails) {
        throw createError("Complete booking data is required", 400);
      }

      if (!bookingData.fare || bookingData.fare <= 0) {
        throw createError("Valid fare is required", 400);
      }

      fare = bookingData.fare;
      // Use a temporary ID that will be replaced with actual booking ID after payment
      const tempId = `temp-${userId}-${Date.now()}`;
      merchantReferenceId = `${tempId}-${Date.now()}`;
    } else {
      throw createError("Either bookingId or bookingData is required", 400);
    }

    // Construct redirect URLs
    const baseUrl = ENV.PAYGIC_SUCCESS_URL || `${req.protocol}://${req.get("host")}`;
    const failedBaseUrl = ENV.PAYGIC_FAILED_URL || baseUrl;
    const successUrl = `${baseUrl}/api/payments/success?merchantRefId=${encodeURIComponent(merchantReferenceId)}`;
    const failedUrl = `${failedBaseUrl}/api/payments/failed?merchantRefId=${encodeURIComponent(merchantReferenceId)}`;

    // Create payment page via Paygic
    const paymentPage = await paygicService.createPaymentPage(
      merchantReferenceId,
      fare,
      customerMobile,
      customerName,
      customerEmail,
      successUrl,
      failedUrl
    );

    // Store booking data temporarily if this is a new booking (for webhook to create it)
    if (bookingData && !bookingId) {
      // Store in a temporary collection or pass via merchantReferenceId
      // For now, we'll encode it in the merchantReferenceId and extract it in webhook
      // Better approach: Store in a temporary Firestore collection with TTL
      const tempBookingRef = await bookingService.storeTempBookingData(userId, bookingData, merchantReferenceId);
      console.log(`[PaymentController] Stored temp booking data with ref: ${tempBookingRef}`);
    }

    res.json({
      success: true,
      data: {
        paymentUrl: paymentPage.data.payPageUrl,
        merchantReferenceId: paymentPage.data.merchantReferenceId,
        paygicReferenceId: paymentPage.data.paygicReferenceId,
        expiry: paymentPage.data.expiry,
        amount: paymentPage.data.amount,
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

    const status = await paygicService.checkPaymentStatus(merchantReferenceId);

    // If status is PENDING, return it gracefully instead of throwing error
    if (status.txnStatus === "PENDING") {
      res.json({
        success: true,
        status: "PENDING",
        message: "Transaction is not successful",
      });
      return;
    }

    res.json({
      success: true,
      status: status.txnStatus,
      data: status,
    });
  } catch (error: any) {
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

    // Extract booking ID or temp ID from merchant reference ID (format: bookingId-timestamp or temp-userId-timestamp-timestamp)
    const parts = merchantReferenceId.split("-");
    const firstPart = parts[0];
    
    let bookingId: string | null = null;
    let isTempBooking = false;

    if (firstPart === "temp") {
      // This is a new booking - need to create it
      isTempBooking = true;
      // Extract userId from temp ID: temp-userId-timestamp-timestamp
      const userId = parts[1];
      const tempId = `${firstPart}-${userId}-${parts[2]}`;
      
      // Get temp booking data
      const tempBookingData = await bookingService.getTempBookingData(tempId);
      
      if (!tempBookingData) {
        console.error(`[Webhook] Temp booking data not found for: ${tempId}`);
        throw createError("Temporary booking data not found", 404);
      }

      if (txnStatus === "SUCCESS") {
        // Create the actual booking
        const booking = await bookingService.createBooking(userId, {
          pickup: tempBookingData.pickup,
          drop: tempBookingData.drop,
          parcelDetails: tempBookingData.parcelDetails,
          fare: tempBookingData.fare,
          paymentMethod: "online",
          couponCode: tempBookingData.couponCode,
        });

        // Update payment status to paid (this will also set status from PendingPayment to Created)
        await bookingService.updatePaymentStatus(booking.id, "paid");
        
        bookingId = booking.id;
        
        // Update temp booking data with actual booking ID (for success handler)
        await bookingService.updateTempBookingData(tempId, booking.id);
        
        // Delete temp booking data after a delay (to allow success handler to read it)
        setTimeout(() => {
          bookingService.deleteTempBookingData(tempId).catch(console.error);
        }, 60000); // Delete after 1 minute
        
        console.log(`[Webhook] Created booking ${bookingId} after successful payment`);
      } else if (txnStatus === "FAILED") {
        // Delete temp booking data - booking was never created
        await bookingService.deleteTempBookingData(tempId);
        console.log(`[Webhook] Payment failed, temp booking data deleted for: ${tempId}`);
      }
    } else {
      // Existing booking - just update payment status
      bookingId = firstPart;

      if (txnStatus === "SUCCESS") {
        // This will also confirm the booking (set status from PendingPayment to Created)
        await bookingService.updatePaymentStatus(bookingId, "paid");
      } else if (txnStatus === "FAILED") {
        await bookingService.updatePaymentStatus(bookingId, "failed");
      }
    }

    // Log webhook for debugging
    console.log("Payment webhook received:", {
      bookingId,
      merchantReferenceId,
      txnStatus,
      isTempBooking,
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
    const { merchantRefId } = req.query;

    if (!merchantRefId) {
      throw createError("Missing required parameters", 400);
    }

    // Verify payment status
    const statusResponse = await paygicService.checkPaymentStatus(
      merchantRefId as string
    );

    if (statusResponse.txnStatus === "SUCCESS") {
      // Extract booking ID from merchant reference
      const parts = (merchantRefId as string).split("-");
      const firstPart = parts[0];
      
      let bookingId: string | null = null;
      
      if (firstPart === "temp") {
        // Find the booking that was created by webhook
        const userId = parts[1];
        const tempId = `${firstPart}-${userId}-${parts[2]}`;
        const tempBookingData = await bookingService.getTempBookingData(tempId);
        
        if (tempBookingData && tempBookingData.bookingId) {
          bookingId = tempBookingData.bookingId;
        } else {
          // Try to find booking by userId and recent creation
          // This is a fallback - webhook should have created it
          throw createError("Booking not found. Please check your bookings.", 404);
        }
      } else {
        bookingId = firstPart;
        // Update booking payment status (this will also confirm booking from PendingPayment to Created)
        await bookingService.updatePaymentStatus(bookingId, "paid");
      }

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
        `/api/payments/failed?merchantRefId=${merchantRefId}`
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
    const { merchantRefId } = req.query;

    res.status(200).json({
      success: false,
      message: "Payment failed",
      merchantReferenceId: merchantRefId,
    });
  } catch (error: any) {
    next(error);
  }
};
