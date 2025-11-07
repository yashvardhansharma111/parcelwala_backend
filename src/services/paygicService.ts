/**
 * Paygic Payment Service
 * Handles Paygic payment gateway integration
 * API Documentation: https://server.paygic.in/api/v2
 */

import axios from "axios";
import { ENV } from "../config/env";
import { createError } from "../utils/errorHandler";

interface CreatePaymentPageRequest {
  mid: string;
  merchantReferenceId: string;
  amount: string;
  customer_mobile: string;
  customer_name: string;
  customer_email: string;
  redirect_URL: string;
  failed_URL: string;
}

interface CreatePaymentPageResponse {
  status: boolean;
  statusCode: number;
  msg: string;
  data: {
    payPageUrl: string;
    expiry: string;
    amount: string;
    paygicReferenceId: string;
    merchantReferenceId: string;
  };
}

interface CheckPaymentStatusRequest {
  mid: string;
  merchantReferenceId: string;
}

interface CheckPaymentStatusResponse {
  status: boolean;
  statusCode: number;
  txnStatus: "SUCCESS" | "FAILED" | "PENDING";
  msg: string;
  data?: {
    amount: number;
    mid: string;
    paygicReferenceId: string;
    merchantReferenceId: string;
    successDate: number;
  };
}

interface PaymentWebhookPayload {
  status: boolean;
  statusCode: number;
  txnStatus: "SUCCESS" | "FAILED" | "PENDING";
  msg: string;
  data: {
    paymentType: string;
    amount: string;
    mid: string;
    paygicReferenceId: string;
    merchantReferenceId: string;
    successDate: string;
    UTR?: string;
    payerName?: string;
    payeeUPI?: string;
  };
}

/**
 * Create a payment page on Paygic
 */
export const createPaymentPage = async (
  merchantReferenceId: string,
  amount: number,
  customerMobile: string,
  customerName: string,
  customerEmail: string,
  redirectUrl: string,
  failedUrl: string
): Promise<CreatePaymentPageResponse> => {
  try {
    // Check if Paygic credentials are configured
    const hasMID = ENV.PAYGIC_MID && ENV.PAYGIC_MID.trim() !== "";
    const hasToken = ENV.PAYGIC_TOKEN && ENV.PAYGIC_TOKEN.trim() !== "";
    
    if (!hasMID || !hasToken) {
      // Log detailed error for debugging
      console.error("Paygic Configuration Error:", {
        PAYGIC_MID: hasMID ? "✓ Set" : "✗ Missing or empty",
        PAYGIC_TOKEN: hasToken ? "✓ Set" : "✗ Missing or empty",
        envKeys: Object.keys(process.env).filter(key => key.includes("PAYGIC")),
        nodeEnv: ENV.NODE_ENV,
      });
      
      throw createError(
        `Paygic credentials not configured. Missing: ${!hasMID ? "PAYGIC_MID" : ""}${!hasMID && !hasToken ? " and " : ""}${!hasToken ? "PAYGIC_TOKEN" : ""}. Please set these in Vercel Environment Variables (Settings → Environment Variables).`,
        500
      );
    }

    const requestData: CreatePaymentPageRequest = {
      mid: ENV.PAYGIC_MID,
      merchantReferenceId,
      amount: amount.toString(),
      customer_mobile: customerMobile,
      customer_name: customerName,
      customer_email: customerEmail,
      redirect_URL: redirectUrl,
      failed_URL: failedUrl,
    };

    const response = await axios.post<CreatePaymentPageResponse>(
      `${ENV.PAYGIC_BASE_URL}/createPaymentPage`,
      requestData,
      {
        headers: {
          token: ENV.PAYGIC_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    // Debug: Log the full response
    console.log("Paygic API raw response:", JSON.stringify(response.data, null, 2));

    if (!response.data.status || response.data.statusCode !== 200) {
      console.error("Paygic API error response:", response.data);
      throw createError(
        response.data.msg || "Failed to create payment page",
        response.data.statusCode || 500
      );
    }

    // Verify the response has the expected structure
    if (!response.data.data || !response.data.data.payPageUrl) {
      console.error("Invalid Paygic response structure:", response.data);
      throw createError(
        "Invalid response structure from Paygic API. Missing payPageUrl in response data.",
        500
      );
    }

    return response.data;
  } catch (error: any) {
    if (error.response?.data) {
      throw createError(
        error.response.data.msg || "Failed to create payment page",
        error.response.status || 500
      );
    }
    throw createError(
      error.message || "Failed to create payment page",
      500
    );
  }
};

/**
 * Check payment status from Paygic
 */
export const checkPaymentStatus = async (
  merchantReferenceId: string
): Promise<CheckPaymentStatusResponse> => {
  try {
    // Check if Paygic credentials are configured
    const hasMID = ENV.PAYGIC_MID && ENV.PAYGIC_MID.trim() !== "";
    const hasToken = ENV.PAYGIC_TOKEN && ENV.PAYGIC_TOKEN.trim() !== "";
    
    if (!hasMID || !hasToken) {
      console.error("Paygic Configuration Error (checkPaymentStatus):", {
        PAYGIC_MID: hasMID ? "✓ Set" : "✗ Missing or empty",
        PAYGIC_TOKEN: hasToken ? "✓ Set" : "✗ Missing or empty",
      });
      
      throw createError(
        `Paygic credentials not configured. Missing: ${!hasMID ? "PAYGIC_MID" : ""}${!hasMID && !hasToken ? " and " : ""}${!hasToken ? "PAYGIC_TOKEN" : ""}. Please set these in Vercel Environment Variables.`,
        500
      );
    }

    const requestData: CheckPaymentStatusRequest = {
      mid: ENV.PAYGIC_MID,
      merchantReferenceId,
    };

    const response = await axios.post<CheckPaymentStatusResponse>(
      `${ENV.PAYGIC_BASE_URL}/checkPaymentStatus`,
      requestData,
      {
        headers: {
          token: ENV.PAYGIC_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    // Log the response for debugging
    console.log("Paygic check status response:", JSON.stringify(response.data, null, 2));

    // If API call failed, throw error
    if (!response.data.status || response.data.statusCode !== 200) {
      throw createError(
        response.data.msg || "Failed to check payment status",
        response.data.statusCode || 500
      );
    }

    // Return the response even if txnStatus is PENDING or FAILED
    // The caller should handle different statuses appropriately
    return response.data;
  } catch (error: any) {
    if (error.response?.data) {
      throw createError(
        error.response.data.msg || "Failed to check payment status",
        error.response.status || 500
      );
    }
    throw createError(
      error.message || "Failed to check payment status",
      500
    );
  }
};

/**
 * Validate webhook payload from Paygic
 */
export const validateWebhookPayload = (
  payload: any
): PaymentWebhookPayload => {
  if (
    !payload ||
    typeof payload.status !== "boolean" ||
    !payload.txnStatus ||
    !payload.data ||
    !payload.data.merchantReferenceId
  ) {
    throw createError("Invalid webhook payload", 400);
  }

  return payload as PaymentWebhookPayload;
};

