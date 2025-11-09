/**
 * Notification Service
 * Handles push notifications using OneSignal (Free & Easy)
 */

import axios from "axios";
import * as admin from "firebase-admin";
import { db } from "../config/firebase";
import { createError } from "../utils/errorHandler";
import { BookingStatus } from "./bookingService";
import { AppCreds } from "../config/creds";

interface NotificationData {
  title: string;
  body: string;
  data?: any;
}

/**
 * OneSignal API endpoints
 */
const ONESIGNAL_API_URL = "https://onesignal.com/api/v1/notifications";
const ONESIGNAL_PLAYERS_API_URL = "https://onesignal.com/api/v1/players";

/**
 * Create or update OneSignal player with external user ID
 * This registers the user in OneSignal so we can send notifications
 * 
 * IMPORTANT: OneSignal requires users to be registered before sending notifications
 * We'll create a "placeholder" player with just the external user ID
 * The actual push token will be registered when the OneSignal SDK is used
 */
const createOrUpdateOneSignalPlayer = async (
  userId: string,
  pushToken: string,
  platform: "ios" | "android" = "android"
): Promise<void> => {
  try {
    if (!AppCreds.onesignal.appId || !AppCreds.onesignal.restApiKey) {
      console.warn("OneSignal credentials not configured, skipping player registration");
      return;
    }

    // Check if this is an Expo Push Token
    const isExpoToken = pushToken.startsWith("ExponentPushToken[");
    
    if (isExpoToken) {
      // Expo Push Tokens can't be used directly with OneSignal REST API
      // OneSignal needs native FCM/APNS tokens
      // However, we can still create a player with just the external user ID
      // The player will be "unsubscribed" until the OneSignal SDK registers it properly
      
      console.log(`📝 Creating OneSignal player for user ${userId} with external user ID only`);
      console.log(`⚠️ Note: Expo Push Token detected. Player will need OneSignal SDK to be fully subscribed.`);
      
      // Try to create a player with external user ID
      // This will at least register the user in OneSignal's system
      try {
        const playerData: any = {
          app_id: AppCreds.onesignal.appId,
          external_user_id: userId, // Link Firebase UID as external user ID
          device_type: platform === "ios" ? 0 : 1, // 0 = iOS, 1 = Android
          // Note: We can't provide identifier (FCM token) because we only have Expo token
          // This player will be "unsubscribed" until OneSignal SDK registers it
        };

        const response = await axios.post(
          ONESIGNAL_PLAYERS_API_URL,
          playerData,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${AppCreds.onesignal.restApiKey}`,
            },
            timeout: 10000,
          }
        );

        if (response.data.id) {
          console.log(`✅ OneSignal player created/updated for user ${userId}:`, response.data.id);
        } else {
          console.warn(`⚠️ OneSignal player creation returned no ID for user ${userId}`);
        }
      } catch (apiError: any) {
        // If player already exists, try to update it
        if (apiError.response?.status === 400) {
          console.log(`📝 Player might already exist for user ${userId}, attempting update...`);
          // OneSignal will auto-update when we send notifications with external_user_id
        } else {
          console.error("Error creating OneSignal player:", apiError.response?.data || apiError.message);
        }
      }
    } else {
      // This might be a native FCM token or OneSignal Player ID
      console.log(`📝 Registering native token for user ${userId}`);
      // For native tokens, we could create a proper player
      // But for now, we'll just use external user IDs
    }
    
  } catch (error: any) {
    console.error("Error in createOrUpdateOneSignalPlayer:", error);
    // Don't throw - this is not critical, notifications might still work
  }
};

/**
 * Save push token for user (can be OneSignal Player ID or Expo Push Token)
 * We'll use external user IDs with OneSignal, so we just need to store the user ID
 */
export const saveFCMToken = async (
  userId: string,
  token: string
): Promise<void> => {
  try {
    // Validate token format
    if (!token || typeof token !== "string" || token.length < 10) {
      throw createError("Invalid token format", 400);
    }

    console.log(`📝 Saving push token for user ${userId}:`, {
      tokenPrefix: token.substring(0, 20) + "...",
      tokenLength: token.length,
    });

    // Store token (we'll use userId as external ID for OneSignal)
    await db.collection("users").doc(userId).update({
      pushToken: token, // Store any token format
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Push token saved for user: ${userId}`);
    
    // Try to register with OneSignal (non-blocking)
    await createOrUpdateOneSignalPlayer(userId, token);
  } catch (error: any) {
    console.error("Error saving push token:", error);
    throw createError("Failed to save push token", 500);
  }
};

/**
 * Get user's OneSignal Player ID from Firestore
 */
const getUserOneSignalPlayerId = async (userId: string): Promise<string | null> => {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return null;
    }
    const userData = userDoc.data();
    // Check for oneSignalPlayerId (from SDK) or pushToken (fallback)
    return userData?.oneSignalPlayerId || userData?.pushToken || null;
  } catch (error) {
    console.error("Error getting OneSignal Player ID:", error);
    return null;
  }
};

/**
 * Send notification via OneSignal using Player IDs or external user IDs
 */
const sendOneSignalNotification = async (
  playerIdsOrExternalIds: string[],
  notification: NotificationData,
  useExternalIds: boolean = false
): Promise<{ sent: number; failed: number }> => {
  try {
    if (!AppCreds.onesignal.appId || !AppCreds.onesignal.restApiKey) {
      throw createError("OneSignal credentials not configured", 500);
    }

    const message: any = {
      app_id: AppCreds.onesignal.appId,
      headings: { en: notification.title || "Notification" },
      contents: { en: notification.body || "" },
      data: {
        ...(notification.data || {}),
        title: notification.title,
        body: notification.body,
      },
      priority: 10, // High priority
    };

    // Use Player IDs if available, otherwise fall back to external user IDs
    if (useExternalIds) {
      message.include_external_user_ids = playerIdsOrExternalIds;
    } else {
      message.include_player_ids = playerIdsOrExternalIds;
    }

    // Only add android_channel_id if it exists in OneSignal
    // For now, we'll let OneSignal use the default channel
    // If you create a custom channel in OneSignal dashboard, add it here:
    // message.android_channel_id = "your-channel-id";

    console.log(`📤 Sending OneSignal notification to ${playerIdsOrExternalIds.length} users:`, {
      title: notification.title,
      body: notification.body,
      method: useExternalIds ? "external_user_ids" : "player_ids",
    });

    const response = await axios.post(
      ONESIGNAL_API_URL,
      message,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${AppCreds.onesignal.restApiKey}`,
        },
        timeout: 10000,
      }
    );

    // Check response for errors
    if (response.data.errors && response.data.errors.length > 0) {
      console.error("❌ OneSignal API Errors:", response.data.errors);
      // Log full response for debugging
      console.error("📋 Full OneSignal Response:", JSON.stringify(response.data, null, 2));
      return { sent: 0, failed: playerIdsOrExternalIds.length };
    }

    if (response.data.id) {
      console.log("✅ OneSignal notification sent successfully:", response.data.id);
      console.log("📊 Response:", {
        id: response.data.id,
        recipients: response.data.recipients,
        errors: response.data.errors,
      });
      
      // Check actual recipients count
      const actualRecipients = response.data.recipients || 0;
      const failed = playerIdsOrExternalIds.length - actualRecipients;
      
      return { sent: actualRecipients, failed };
    }

    return { sent: 0, failed: playerIdsOrExternalIds.length };
  } catch (error: any) {
    console.error("❌ Error sending OneSignal notification:", error);
    if (error.response?.data) {
      console.error("OneSignal API Error Response:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("Error details:", error.message);
    }
    throw createError(`Failed to send notification: ${error.message || "Unknown error"}`, 500);
  }
};

/**
 * Send notification to specific user
 * Tries Player ID first, falls back to external user ID
 */
export const sendNotificationToUser = async (
  userId: string,
  notification: NotificationData
): Promise<void> => {
  try {
    // Try to get Player ID first
    const playerId = await getUserOneSignalPlayerId(userId);
    
    if (playerId) {
      // Use Player ID if available (from OneSignal SDK)
      console.log(`📤 Sending to user ${userId} using Player ID`);
      await sendOneSignalNotification([playerId], notification, false);
    } else {
      // Fall back to external user ID (Firebase UID)
      console.log(`📤 Sending to user ${userId} using external user ID`);
      await sendOneSignalNotification([userId], notification, true);
    }
  } catch (error: any) {
    console.error("Error sending notification to user:", error);
    throw error;
  }
};

/**
 * Broadcast notification to all users with OneSignal Player IDs
 */
/**
 * Broadcast notification to all users
 * Uses Player IDs when available, falls back to external user IDs
 */
export const broadcastNotification = async (
  notification: NotificationData
): Promise<{ sent: number; failed: number; total: number }> => {
  try {
    // Get all users
    const usersSnapshot = await db.collection("users").get();

    console.log(`[broadcastNotification] Found ${usersSnapshot.size} users`);

    if (usersSnapshot.empty) {
      console.warn("[broadcastNotification] No users found.");
      return { sent: 0, failed: 0, total: 0 };
    }

    // Separate users with Player IDs and those without
    const playerIds: string[] = [];
    const externalUserIds: string[] = [];

    usersSnapshot.docs.forEach((doc) => {
      const userData = doc.data();
      const playerId = userData?.oneSignalPlayerId || userData?.pushToken;
      
      if (playerId && playerId.length > 20) {
        // Likely a Player ID (UUID format)
        playerIds.push(playerId);
      } else {
        // Use external user ID (Firebase UID)
        externalUserIds.push(doc.id);
      }
    });

    console.log(`[broadcastNotification] ${playerIds.length} users with Player IDs, ${externalUserIds.length} with external IDs`);

    let totalSent = 0;
    let totalFailed = 0;
    const batchSize = 2000;

    // Send to users with Player IDs first (more reliable)
    if (playerIds.length > 0) {
      for (let i = 0; i < playerIds.length; i += batchSize) {
        const batch = playerIds.slice(i, i + batchSize);
        try {
          const result = await sendOneSignalNotification(batch, notification, false);
          totalSent += result.sent;
          totalFailed += result.failed;
          console.log(`Batch (Player IDs) ${Math.floor(i / batchSize) + 1}: ${result.sent} sent, ${result.failed} failed`);
        } catch (error: any) {
          console.error(`❌ Error sending Player ID batch ${Math.floor(i / batchSize) + 1}:`, error);
          totalFailed += batch.length;
        }
      }
    }

    // Send to users with external IDs (fallback)
    if (externalUserIds.length > 0) {
      for (let i = 0; i < externalUserIds.length; i += batchSize) {
        const batch = externalUserIds.slice(i, i + batchSize);
        try {
          const result = await sendOneSignalNotification(batch, notification, true);
          totalSent += result.sent;
          totalFailed += result.failed;
          console.log(`Batch (External IDs) ${Math.floor(i / batchSize) + 1}: ${result.sent} sent, ${result.failed} failed`);
        } catch (error: any) {
          console.error(`❌ Error sending External ID batch ${Math.floor(i / batchSize) + 1}:`, error);
          totalFailed += batch.length;
        }
      }
    }

    return { sent: totalSent, failed: totalFailed, total: usersSnapshot.size };
  } catch (error: any) {
    console.error("Error broadcasting notification:", error);
    throw createError("Failed to broadcast notification", 500);
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
    const statusMessages: Record<BookingStatus, { title: string; body: string }> = {
      PendingPayment: {
        title: "Booking Created",
        body: `Your booking ${trackingNumber || bookingId} has been created and is pending payment.`,
      },
      Created: {
        title: "Booking Confirmed",
        body: `Your booking ${trackingNumber || bookingId} has been confirmed and is ready for pickup.`,
      },
      Picked: {
        title: "Parcel Picked Up",
        body: `Your parcel ${trackingNumber || bookingId} has been picked up and is on its way.`,
      },
      Shipped: {
        title: "Parcel In Transit",
        body: `Your parcel ${trackingNumber || bookingId} is now in transit to the destination.`,
      },
      Delivered: {
        title: "Parcel Delivered",
        body: `Your parcel ${trackingNumber || bookingId} has been delivered successfully!`,
      },
      Returned: {
        title: "Parcel Returned",
        body: `Your parcel ${trackingNumber || bookingId} has been returned.`,
      },
    };

    const message = statusMessages[newStatus];
    if (!message) {
      console.warn(`No notification message for status: ${newStatus}`);
      return;
    }

    await sendNotificationToUser(userId, {
      title: message.title,
      body: message.body,
      data: {
        type: "booking_status_update",
        bookingId,
        trackingNumber,
        oldStatus,
        newStatus,
      },
    });
  } catch (error: any) {
    // Don't throw error - notification failure shouldn't break booking flow
    console.error("Error sending booking status notification:", error);
  }
};

/**
 * Send payment status notification
 */
export const sendPaymentStatusNotification = async (
  userId: string,
  bookingId: string,
  paymentStatus: "paid" | "pending"
): Promise<void> => {
  try {
    const statusMessages: Record<"paid" | "pending", { title: string; body: string }> = {
      paid: {
        title: "Payment Received",
        body: `Your payment for booking ${bookingId} has been received successfully.`,
      },
      pending: {
        title: "Payment Pending",
        body: `Your payment for booking ${bookingId} is still pending. Please complete the payment.`,
      },
    };

    const message = statusMessages[paymentStatus];
    if (!message) {
      console.warn(`No notification message for payment status: ${paymentStatus}`);
      return;
    }

    await sendNotificationToUser(userId, {
      title: message.title,
      body: message.body,
      data: {
        type: "payment_status_update",
        bookingId,
        paymentStatus,
      },
    });
  } catch (error: any) {
    // Don't throw error - notification failure shouldn't break payment flow
    console.error("Error sending payment status notification:", error);
  }
};
