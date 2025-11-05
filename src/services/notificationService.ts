/**
 * Notification Service
 * Handles push notifications for booking status changes
 */

import * as admin from "firebase-admin";
import { db } from "../config/firebase";
import { createError } from "../utils/errorHandler";
import { BookingStatus } from "./bookingService";

interface NotificationData {
  title: string;
  body: string;
  data?: any;
}

/**
 * Get user's FCM token
 */
const getUserFCMToken = async (userId: string): Promise<string | null> => {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return null;
    }
    const userData = userDoc.data();
    return userData?.fcmToken || null;
  } catch (error) {
    console.error("Error getting FCM token:", error);
    return null;
  }
};

/**
 * Save FCM token for user
 */
export const saveFCMToken = async (
  userId: string,
  token: string
): Promise<void> => {
  try {
    await db.collection("users").doc(userId).update({
      fcmToken: token,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error: any) {
    console.error("Error saving FCM token:", error);
    throw createError("Failed to save FCM token", 500);
  }
};

/**
 * Send push notification to user
 */
const sendNotification = async (
  token: string,
  notification: NotificationData
): Promise<void> => {
  try {
    const message: admin.messaging.Message = {
      token,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      android: {
        priority: "high",
        notification: {
          channelId: "booking_updates",
          sound: "default",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    };

    await admin.messaging().send(message);
    console.log("Notification sent successfully");
  } catch (error: any) {
    console.error("Error sending notification:", error);
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
    const token = await getUserFCMToken(userId);
    if (!token) {
      console.log("No FCM token found for user:", userId);
      return;
    }

    const statusMessages: { [key in BookingStatus]?: string } = {
      "In Transit": "Your parcel is now in transit!",
      "Delivered": "Your parcel has been delivered!",
      "Cancelled": "Your booking has been cancelled.",
      "Pending": "Your booking is being processed.",
      "Failed": "Your delivery has failed. Please contact support.",
    };

    const title = "Booking Status Update";
    const body =
      statusMessages[newStatus] ||
      `Your booking status has been updated to ${newStatus}.`;

    await sendNotification(token, {
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
    const token = await getUserFCMToken(userId);
    if (!token) {
      return;
    }

    const messages: { [key: string]: string } = {
      paid: "Your payment has been confirmed!",
      unpaid: "Payment is pending for your booking.",
      pending: "Your payment is being processed.",
    };

    await sendNotification(token, {
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

