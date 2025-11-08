/**
 * Notification Service
 * Handles push notifications using Expo Push Notifications API
 * No Firebase/FCM required - uses Expo's HTTP API
 */

import axios from "axios";
import * as admin from "firebase-admin";
import { db } from "../config/firebase";
import { createError } from "../utils/errorHandler";
import { BookingStatus } from "./bookingService";

interface NotificationData {
  title: string;
  body: string;
  data?: any;
}

interface ExpoPushMessage {
  to: string;
  sound?: string;
  title?: string;
  body?: string;
  data?: any;
  badge?: number;
  priority?: "default" | "normal" | "high";
  channelId?: string;
}

interface ExpoPushResponse {
  data: Array<{
    status: "ok" | "error";
    id?: string;
    message?: string;
    details?: any;
  }>;
}

/**
 * Expo Push API endpoint
 */
const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Get user's Expo Push Token
 */
const getUserExpoPushToken = async (userId: string): Promise<string | null> => {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return null;
    }
    const userData = userDoc.data();
    return userData?.expoPushToken || null;
  } catch (error) {
    console.error("Error getting Expo Push token:", error);
    return null;
  }
};

/**
 * Save Expo Push Token for user
 */
export const saveExpoPushToken = async (
  userId: string,
  token: string
): Promise<void> => {
  try {
    // Validate token format (Expo push tokens start with ExponentPushToken or ExpoPushToken)
    if (!token.startsWith("ExponentPushToken[") && !token.startsWith("ExpoPushToken[")) {
      throw createError("Invalid Expo Push Token format", 400);
    }

    await db.collection("users").doc(userId).update({
      expoPushToken: token,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error: any) {
    console.error("Error saving Expo Push token:", error);
    throw createError("Failed to save Expo Push token", 500);
  }
};

/**
 * Send push notification via Expo Push API
 */
const sendExpoNotification = async (
  token: string,
  notification: NotificationData
): Promise<void> => {
  try {
    const message: ExpoPushMessage = {
      to: token,
      sound: "default",
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      priority: "high",
      badge: 1,
    };

    const response = await axios.post<ExpoPushResponse>(
      EXPO_PUSH_API_URL,
      message,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        timeout: 10000, // 10 second timeout
      }
    );

    if (response.data.data && response.data.data[0]) {
      const result = response.data.data[0];
      if (result.status === "ok") {
        console.log("✅ Expo notification sent successfully:", result.id);
      } else {
        console.error("❌ Expo notification error:", result.message, result.details);
        // Handle invalid token errors
        if (result.details?.error === "DeviceNotRegistered" || 
            result.details?.error === "InvalidCredentials") {
          console.log("⚠️ Invalid Expo Push token detected");
        }
      }
    }
  } catch (error: any) {
    console.error("❌ Error sending Expo notification:", error);
    if (error.response?.data) {
      console.error("Expo API Error Response:", error.response.data);
    }
    // Don't throw error - notification failure shouldn't break the flow
  }
};

/**
 * Send booking status change notification
 */
export const sendBookingStatusNotification = async (
  userId: string,
  bookingId: string,
  trackingNumber: string | undefined,
  oldStatus: BookingStatus,
  newStatus: BookingStatus
): Promise<void> => {
  try {
    const token = await getUserExpoPushToken(userId);
    if (!token) {
      console.log("No Expo Push token found for user:", userId);
      return;
    }

    const statusMessages: { [key in BookingStatus]?: string } = {
      "Created": "Your booking has been confirmed!",
      "Picked": "Your parcel has been picked up!",
      "Shipped": "Your parcel is now in transit!",
      "Delivered": "Your parcel has been delivered!",
      "PendingPayment": "Waiting for payment confirmation.",
      "Returned": "Your parcel has been returned.",
    };

    const title = "Booking Status Update";
    const body =
      statusMessages[newStatus] ||
      `Your booking status has been updated to ${newStatus}.`;

    await sendExpoNotification(token, {
      title,
      body,
      data: {
        type: "booking_status_update",
        bookingId,
        trackingNumber: trackingNumber || "",
        oldStatus,
        newStatus,
      },
    });
  } catch (error: any) {
    console.error("Error sending booking status notification:", error);
    // Don't throw - notification failure shouldn't break booking update
  }
};

/**
 * Send payment status notification
 */
export const sendPaymentStatusNotification = async (
  userId: string,
  bookingId: string,
  paymentStatus: "paid" | "unpaid" | "pending"
): Promise<void> => {
  try {
    const token = await getUserExpoPushToken(userId);
    if (!token) {
      console.log("No Expo Push token found for user:", userId);
      return;
    }

    const messages: { [key: string]: string } = {
      paid: "Your payment has been confirmed!",
      unpaid: "Payment is pending for your booking.",
      pending: "Your payment is being processed.",
    };

    await sendExpoNotification(token, {
      title: "Payment Update",
      body: messages[paymentStatus] || "Your payment status has been updated.",
      data: {
        type: "payment_status_update",
        bookingId,
        paymentStatus,
      },
    });
  } catch (error: any) {
    console.error("Error sending payment notification:", error);
  }
};

/**
 * Send notification to specific user
 */
export const sendNotificationToUser = async (
  userId: string,
  notification: NotificationData
): Promise<void> => {
  try {
    const token = await getUserExpoPushToken(userId);
    if (!token) {
      throw createError("User does not have Expo Push token registered", 404);
    }

    await sendExpoNotification(token, notification);
  } catch (error: any) {
    console.error("Error sending notification to user:", error);
    throw error;
  }
};

/**
 * Broadcast notification to all users with Expo Push tokens
 */
export const broadcastNotification = async (
  notification: NotificationData
): Promise<{ sent: number; failed: number; total: number }> => {
  try {
    // Get all users with Expo Push tokens
    const usersSnapshot = await db
      .collection("users")
      .where("expoPushToken", "!=", null)
      .get();

    if (usersSnapshot.empty) {
      return { sent: 0, failed: 0, total: 0 };
    }

    const tokens: string[] = [];
    usersSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.expoPushToken) {
        tokens.push(data.expoPushToken);
      }
    });

    if (tokens.length === 0) {
      return { sent: 0, failed: 0, total: 0 };
    }

    // Expo Push API allows up to 100 messages per request
    const batchSize = 100;
    let sent = 0;
    let failed = 0;
    const invalidTokens: string[] = [];

    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      
      try {
        // Prepare messages for batch
        const messages: ExpoPushMessage[] = batch.map((token) => ({
          to: token,
          sound: "default",
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          priority: "high",
          badge: 1,
        }));

        const response = await axios.post<ExpoPushResponse>(
          EXPO_PUSH_API_URL,
          messages,
          {
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              "Accept-Encoding": "gzip, deflate",
            },
            timeout: 30000, // 30 second timeout for batch
          }
        );

        // Process responses
        if (response.data.data) {
          response.data.data.forEach((result, idx) => {
            if (result.status === "ok") {
              sent++;
            } else {
              failed++;
              // Track invalid tokens
              if (result.details?.error === "DeviceNotRegistered" || 
                  result.details?.error === "InvalidCredentials") {
                invalidTokens.push(batch[idx]);
              }
            }
          });
        }

        console.log(`Batch ${Math.floor(i / batchSize) + 1}: ${sent} sent, ${failed} failed`);
      } catch (error: any) {
        console.error("Error sending batch notification:", error);
        failed += batch.length;
      }
    }

    // Remove invalid tokens from database (fire and forget)
    if (invalidTokens.length > 0) {
      db.collection("users")
        .where("expoPushToken", "in", invalidTokens)
        .get()
        .then((snapshot) => {
          const batch = db.batch();
          snapshot.docs.forEach((doc) => {
            batch.update(doc.ref, { expoPushToken: admin.firestore.FieldValue.delete() });
          });
          return batch.commit();
        })
        .then(() => {
          console.log(`Removed ${invalidTokens.length} invalid Expo Push tokens from database`);
        })
        .catch((err) => {
          console.error("Error removing invalid tokens:", err);
        });
    }

    return {
      sent,
      failed,
      total: tokens.length,
    };
  } catch (error: any) {
    console.error("Error broadcasting notification:", error);
    throw createError("Failed to broadcast notification", 500);
  }
};
