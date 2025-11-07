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
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
            alert: {
              title: notification.title,
              body: notification.body,
            },
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log("Notification sent successfully:", response);
  } catch (error: any) {
    console.error("Error sending notification:", error);
    
    // Handle invalid token errors
    if (error.code === "messaging/invalid-registration-token" || 
        error.code === "messaging/registration-token-not-registered") {
      console.log("Invalid token, removing from database");
      // Optionally remove invalid token from database
      // This would require userId, so we'll handle it at a higher level
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
    const token = await getUserFCMToken(userId);
    if (!token) {
      console.log("No FCM token found for user:", userId);
      return;
    }

    const statusMessages: { [key in BookingStatus]?: string } = {
      "Created": "Your booking has been confirmed!",
      "Picked": "Your parcel has been picked up!",
      "Shipped": "Your parcel is now in transit!",
      "Delivered": "Your parcel has been delivered!",
      "PendingPayment": "Waiting for payment confirmation.",
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
      console.log("No FCM token found for user:", userId);
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

/**
 * Send notification to specific user
 */
export const sendNotificationToUser = async (
  userId: string,
  notification: NotificationData
): Promise<void> => {
  try {
    const token = await getUserFCMToken(userId);
    if (!token) {
      throw createError("User does not have FCM token registered", 404);
    }

    await sendNotification(token, notification);
  } catch (error: any) {
    console.error("Error sending notification to user:", error);
    throw error;
  }
};

/**
 * Broadcast notification to all users with FCM tokens
 */
export const broadcastNotification = async (
  notification: NotificationData
): Promise<{ sent: number; failed: number; total: number }> => {
  try {
    // Get all users with FCM tokens
    const usersSnapshot = await db
      .collection("users")
      .where("fcmToken", "!=", null)
      .get();

    if (usersSnapshot.empty) {
      return { sent: 0, failed: 0, total: 0 };
    }

    const tokens: string[] = [];
    usersSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (data.fcmToken) {
        tokens.push(data.fcmToken);
      }
    });

    if (tokens.length === 0) {
      return { sent: 0, failed: 0, total: 0 };
    }

    // Send notifications in batches (FCM allows up to 500 tokens per batch)
    const batchSize = 500;
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      
      try {
        // Use multicast for batch sending
        const message: admin.messaging.MulticastMessage = {
          tokens: batch,
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

        const response = await admin.messaging().sendEachForMulticast(message);
        sent += response.successCount;
        failed += response.failureCount;

        console.log(`Batch ${Math.floor(i / batchSize) + 1}: ${response.successCount} sent, ${response.failureCount} failed`);
      } catch (error: any) {
        console.error("Error sending batch notification:", error);
        failed += batch.length;
      }
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

