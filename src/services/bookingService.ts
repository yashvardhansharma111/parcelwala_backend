/**
 * Booking Service
 * Handles Firestore booking operations
 */

import * as admin from "firebase-admin";
import { db } from "../config/firebase";
import { createError } from "../utils/errorHandler";

/**
 * Temporary booking data interface (for online payments)
 */
interface TempBookingData {
  userId: string;
  pickup: any;
  drop: any;
  parcelDetails: any;
  fare: number;
  paymentMethod: "online";
  couponCode?: string;
  merchantReferenceId: string;
  bookingId?: string; // Set after booking is created
  createdAt: Date;
}

/**
 * Store temporary booking data (for online payments - created after payment success)
 */
export const storeTempBookingData = async (
  userId: string,
  bookingData: {
    pickup: any;
    drop: any;
    parcelDetails: any;
    fare: number;
    couponCode?: string;
  },
  merchantReferenceId: string
): Promise<string> => {
  try {
    // Generate a unique temp ID based on merchantReferenceId
    // Use the full merchantReferenceId as the document ID (sanitized for Firestore)
    // Firestore document IDs can't contain certain characters, so we'll use a hash-like approach
    const tempId = merchantReferenceId.replace(/[^a-zA-Z0-9_-]/g, "_");
    
    // Validate booking data
    if (!bookingData.pickup || !bookingData.drop || !bookingData.parcelDetails) {
      throw createError("Invalid booking data: missing required fields", 400);
    }

    if (!bookingData.fare || bookingData.fare <= 0) {
      throw createError("Invalid booking data: fare must be positive", 400);
    }

    // Prepare temp data - convert undefined to null for Firestore compatibility
    const tempData: any = {
      userId,
      pickup: bookingData.pickup,
      drop: bookingData.drop,
      parcelDetails: bookingData.parcelDetails,
      fare: bookingData.fare,
      paymentMethod: "online",
      merchantReferenceId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Only include couponCode if it's provided (not undefined)
    if (bookingData.couponCode !== undefined && bookingData.couponCode !== null) {
      tempData.couponCode = bookingData.couponCode;
    }

    // Store with TTL of 1 hour (booking should be created within payment window)
    await db.collection("temp_bookings").doc(tempId).set({
      ...tempData,
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 60 * 60 * 1000)),
    });

    console.log(`[storeTempBookingData] Successfully stored temp booking with ID: ${tempId}`);
    return tempId;
  } catch (error: any) {
    console.error("Error storing temp booking data:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
      userId,
      merchantReferenceId,
      bookingDataKeys: Object.keys(bookingData || {}),
    });
    
    // Provide more specific error message
    if (error.message?.includes("Invalid booking data")) {
      throw error; // Re-throw validation errors as-is
    }
    
    throw createError(
      `Failed to store temporary booking data: ${error.message || "Unknown error"}`,
      500
    );
  }
};

/**
 * Get temporary booking data by merchantReferenceId
 */
export const getTempBookingData = async (merchantReferenceId: string): Promise<TempBookingData | null> => {
  try {
    // Sanitize merchantReferenceId to match how it was stored
    const tempId = merchantReferenceId.replace(/[^a-zA-Z0-9_-]/g, "_");
    
    const doc = await db.collection("temp_bookings").doc(tempId).get();
    if (!doc.exists) {
      console.log(`[getTempBookingData] No temp booking found for merchantReferenceId: ${merchantReferenceId} (tempId: ${tempId})`);
      return null;
    }
    const data = doc.data()!;
    return {
      userId: data.userId,
      pickup: data.pickup,
      drop: data.drop,
      parcelDetails: data.parcelDetails,
      fare: data.fare,
      paymentMethod: data.paymentMethod,
      couponCode: data.couponCode,
      merchantReferenceId: data.merchantReferenceId,
      bookingId: data.bookingId,
      createdAt: data.createdAt?.toDate() || new Date(),
    };
  } catch (error: any) {
    console.error("Error getting temp booking data:", error);
    return null;
  }
};

/**
 * Update temp booking data with actual booking ID
 */
export const updateTempBookingData = async (tempId: string, bookingId: string): Promise<void> => {
  try {
    await db.collection("temp_bookings").doc(tempId).update({
      bookingId,
    });
  } catch (error: any) {
    console.error("Error updating temp booking data:", error);
  }
};

/**
 * Delete temporary booking data
 */
export const deleteTempBookingData = async (tempId: string): Promise<void> => {
  try {
    await db.collection("temp_bookings").doc(tempId).delete();
  } catch (error: any) {
    console.error("Error deleting temp booking data:", error);
  }
};

export interface Address {
  name: string;
  phone: string;
  houseNumber?: string;
  street?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
}

export interface ParcelDetails {
  type: string;
  weight: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  description?: string;
  value?: number;
}

export type BookingStatus = "PendingPayment" | "Created" | "Picked" | "Shipped" | "Delivered" | "Returned";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type PaymentMethod = "cod" | "online"; // Cash on Delivery or Online Payment

export interface Booking {
  id: string;
  userId: string;
  pickup: Address;
  drop: Address;
  parcelDetails: ParcelDetails;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod; // Added payment method
  fare?: number;
  createdAt: Date;
  updatedAt: Date;
  trackingNumber?: string;
  returnReason?: string;
  returnedAt?: Date;
}

/**
 * Generate a unique booking ID in format: PW-DD-MM-YYYY-XXX
 * Where XXX is a 3-digit unique number for that day
 */
const generateBookingId = async (): Promise<string> => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const dateStr = `${day}-${month}-${year}`;
  
  // Get count of bookings created today to generate unique 3-digit number
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  
  const todayBookings = await db
    .collection("bookings")
    .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
    .where("createdAt", "<", admin.firestore.Timestamp.fromDate(endOfDay))
    .get();
  
  // Generate 3-digit unique number (001-999)
  const sequenceNumber = (todayBookings.size + 1).toString().padStart(3, "0");
  
  return `PW-${dateStr}-${sequenceNumber}`;
};

/**
 * Generate a unique tracking number (using booking ID format)
 */
const generateTrackingNumber = async (): Promise<string> => {
  return await generateBookingId();
};

/**
 * Create a new booking
 */
export const createBooking = async (
  userId: string,
  bookingData: {
    pickup: Address;
    drop: Address;
    parcelDetails: ParcelDetails;
    fare?: number;
    paymentMethod?: PaymentMethod;
    couponCode?: string;
    deliveryType?: "sameDay" | "later";
    deliveryDate?: string;
  }
): Promise<Booking> => {
  try {
    const trackingNumber = await generateTrackingNumber();
    const now = new Date();

    // Determine booking status and payment status based on payment method
    // COD = Created immediately, Online = PendingPayment (will be Created after payment)
    // Payment status: COD = pending (will be paid on delivery), Online = pending (needs payment)
    const paymentStatus: PaymentStatus = "pending";
    let bookingStatus: BookingStatus = "Created"; // Default for COD
    
    // For online payment, set status to PendingPayment until payment is confirmed
    if (bookingData.paymentMethod === "online") {
      bookingStatus = "PendingPayment";
    }

    // Build booking data, excluding undefined values
    const bookingData_1: any = {
      userId,
      pickup: bookingData.pickup,
      drop: bookingData.drop,
      parcelDetails: bookingData.parcelDetails,
      status: bookingStatus,
      paymentStatus,
      trackingNumber,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Only add fare if it's defined (not undefined)
    if (bookingData.fare !== undefined) {
      bookingData_1.fare = bookingData.fare;
    }

    // Add payment method if provided (not undefined or null)
    if (bookingData.paymentMethod !== undefined && bookingData.paymentMethod !== null) {
      bookingData_1.paymentMethod = bookingData.paymentMethod;
    }

    // Add coupon code if provided (not undefined, null, or empty string)
    if (bookingData.couponCode !== undefined && bookingData.couponCode !== null && bookingData.couponCode !== "") {
      bookingData_1.couponCode = bookingData.couponCode;
    }

    // Add delivery type if provided
    if (bookingData.deliveryType !== undefined && bookingData.deliveryType !== null) {
      bookingData_1.deliveryType = bookingData.deliveryType;
    }

    // Add delivery date if provided
    if (bookingData.deliveryDate !== undefined && bookingData.deliveryDate !== null && bookingData.deliveryDate !== "") {
      bookingData_1.deliveryDate = admin.firestore.Timestamp.fromDate(new Date(bookingData.deliveryDate));
    }

    // Generate booking ID and use it as document ID
    const bookingId = await generateBookingId();
    const bookingRef = db.collection("bookings").doc(bookingId);
    await bookingRef.set(bookingData_1);

    const bookingDoc = await bookingRef.get();
    const data = bookingDoc.data()!;

    return {
      id: bookingDoc.id,
      userId: data.userId,
      pickup: data.pickup,
      drop: data.drop,
      parcelDetails: data.parcelDetails,
      status: data.status,
      paymentStatus: data.paymentStatus,
      paymentMethod: data.paymentMethod,
      fare: data.fare,
      trackingNumber: data.trackingNumber,
      createdAt: data.createdAt?.toDate() || now,
      updatedAt: data.updatedAt?.toDate() || now,
    };
  } catch (error: any) {
    console.error("Error creating booking:", error);
    throw createError("Failed to create booking", 500);
  }
};

/**
 * Get booking by ID
 */
export const getBookingById = async (bookingId: string): Promise<Booking | null> => {
  try {
    const bookingDoc = await db.collection("bookings").doc(bookingId).get();

    if (!bookingDoc.exists) {
      return null;
    }

    const data = bookingDoc.data()!;
    return {
      id: bookingDoc.id,
      userId: data.userId,
      pickup: data.pickup,
      drop: data.drop,
      parcelDetails: data.parcelDetails,
      status: data.status,
      paymentStatus: data.paymentStatus,
      paymentMethod: data.paymentMethod,
      fare: data.fare,
      deliveryType: data.deliveryType,
      deliveryDate: data.deliveryDate?.toDate() || data.deliveryDate,
      podSignature: data.podSignature,
      podSignedBy: data.podSignedBy,
      podSignedAt: data.podSignedAt?.toDate() || data.podSignedAt,
      trackingNumber: data.trackingNumber,
      returnReason: data.returnReason,
      returnedAt: data.returnedAt?.toDate(),
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  } catch (error: any) {
    console.error("Error getting booking:", error);
    throw createError("Failed to get booking", 500);
  }
};

/**
 * Get all bookings for a user (with pagination)
 */
export const getUserBookings = async (
  userId: string,
  options?: {
    limit?: number;
    lastDocId?: string;
  }
): Promise<{
  bookings: Booking[];
  hasMore: boolean;
  lastDocId?: string;
}> => {
  try {
    // Validate userId
    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      throw createError("Invalid user ID", 400);
    }

    const limit = options?.limit || 20; // Default 20 items per page
    console.log(`[getUserBookings] Querying bookings for userId: ${userId}, limit: ${limit}`);

    let snapshot: admin.firestore.QuerySnapshot;
    
    try {
      // Build query with composite index (userId + createdAt)
      let query: admin.firestore.Query = db
        .collection("bookings")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(limit + 1); // Fetch one extra to check if there's more

      // If lastDocId is provided, start after that document
      if (options?.lastDocId) {
        const lastDoc = await db.collection("bookings").doc(options.lastDocId).get();
        if (lastDoc.exists) {
          query = query.startAfter(lastDoc);
        }
      }

      snapshot = await query.get();
    } catch (error: any) {
      // If composite index error, fall back to simpler query
      if (error.code === 9 || error.message?.includes("index")) {
        console.warn(`[getUserBookings] Composite index missing, using fallback query. Error: ${error.message}`);
        console.warn(`[getUserBookings] Please create a composite index: bookings(userId, createdAt DESC)`);
        
        // Fallback: Get all bookings for user, then sort in memory
        const allDocs = await db
          .collection("bookings")
          .where("userId", "==", userId)
          .get();
        
        // Sort by createdAt descending
        const sortedDocs = allDocs.docs.sort((a, b) => {
          const aTime = a.data().createdAt?.toMillis() || 0;
          const bTime = b.data().createdAt?.toMillis() || 0;
        return bTime - aTime;
        });
        
        // Apply pagination manually
        const startIndex = options?.lastDocId 
          ? sortedDocs.findIndex(d => d.id === options.lastDocId) + 1
          : 0;
        const endIndex = Math.min(startIndex + limit + 1, sortedDocs.length);
        snapshot = {
          docs: sortedDocs.slice(startIndex, endIndex),
        } as admin.firestore.QuerySnapshot;
      } else {
        throw error;
      }
    }
    const hasMore = snapshot.docs.length > limit;
    const docs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

    console.log(`[getUserBookings] Found ${docs.length} documents for userId: ${userId}, hasMore: ${hasMore}`);

    // Map to bookings
    const bookings = docs.map((doc) => {
      const data = doc.data();
      const booking = {
        id: doc.id,
        userId: data.userId,
        pickup: data.pickup,
        drop: data.drop,
        parcelDetails: data.parcelDetails,
        status: data.status,
        paymentStatus: data.paymentStatus,
        paymentMethod: data.paymentMethod,
        fare: data.fare,
        deliveryType: data.deliveryType,
        deliveryDate: data.deliveryDate?.toDate() || data.deliveryDate,
        podSignature: data.podSignature,
        podSignedBy: data.podSignedBy,
        podSignedAt: data.podSignedAt?.toDate() || data.podSignedAt,
        trackingNumber: data.trackingNumber,
        returnReason: data.returnReason,
        returnedAt: data.returnedAt?.toDate(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };

      // Double-check that booking belongs to this user (security)
      if (booking.userId !== userId) {
        console.error(`[getUserBookings] SECURITY WARNING: Booking ${booking.id} has userId ${booking.userId} but query was for ${userId}`);
      }

      return booking;
    });

    // Filter out any bookings that don't match (extra security)
    const validBookings = bookings.filter((b) => b.userId === userId);

    if (validBookings.length !== bookings.length) {
      console.error(`[getUserBookings] SECURITY WARNING: Filtered out ${bookings.length - validBookings.length} invalid bookings`);
    }

    const lastDocId = validBookings.length > 0 ? validBookings[validBookings.length - 1].id : undefined;

    console.log(`[getUserBookings] Returning ${validBookings.length} bookings, hasMore: ${hasMore}, lastDocId: ${lastDocId || "none"}`);

    return {
      bookings: validBookings,
      hasMore,
      lastDocId,
    };
  } catch (error: any) {
    console.error("Error getting user bookings:", error);
    throw createError("Failed to get user bookings", 500);
  }
};

/**
 * Get all bookings (Admin only) with pagination
 */
export const getAllBookings = async (
  filters?: {
    status?: BookingStatus;
    paymentStatus?: PaymentStatus;
  },
  options?: {
    limit?: number;
    lastDocId?: string;
  }
): Promise<{
  bookings: Booking[];
  hasMore: boolean;
  lastDocId?: string;
}> => {
  try {
    const limit = options?.limit || 20; // Default 20 items per page

    // Start with base query
    let query: admin.firestore.Query = db.collection("bookings");

    if (filters?.status) {
      query = query.where("status", "==", filters.status);
    }

    if (filters?.paymentStatus) {
      query = query.where("paymentStatus", "==", filters.paymentStatus);
    }

    // Order by createdAt descending and limit
    query = query.orderBy("createdAt", "desc").limit(limit + 1); // Fetch one extra to check if there's more

    // If lastDocId is provided, start after that document
    if (options?.lastDocId) {
      const lastDoc = await db.collection("bookings").doc(options.lastDocId).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.get();
    const hasMore = snapshot.docs.length > limit;
    const docs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

    // Map to bookings
    const bookings = docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        pickup: data.pickup,
        drop: data.drop,
        parcelDetails: data.parcelDetails,
        status: data.status,
        paymentStatus: data.paymentStatus,
        paymentMethod: data.paymentMethod,
        fare: data.fare,
        deliveryType: data.deliveryType,
        deliveryDate: data.deliveryDate?.toDate() || data.deliveryDate,
        podSignature: data.podSignature,
        podSignedBy: data.podSignedBy,
        podSignedAt: data.podSignedAt?.toDate() || data.podSignedAt,
        trackingNumber: data.trackingNumber,
        returnReason: data.returnReason,
        returnedAt: data.returnedAt?.toDate(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    });

    const lastDocId = bookings.length > 0 ? bookings[bookings.length - 1].id : undefined;

    return {
      bookings,
      hasMore,
      lastDocId,
    };
  } catch (error: any) {
    console.error("Error getting all bookings:", error);
    throw createError("Failed to get bookings", 500);
  }
};

/**
 * Update booking status
 */
export const updateBookingStatus = async (
  bookingId: string,
  status: BookingStatus,
  returnReason?: string
): Promise<void> => {
  try {
    // Get current booking to track status change
    const bookingDoc = await db.collection("bookings").doc(bookingId).get();
    if (!bookingDoc.exists) {
      throw createError("Booking not found", 404);
    }

    const bookingData = bookingDoc.data()!;
    const oldStatus = bookingData.status as BookingStatus;

    // Prepare update data
    const updateData: any = {
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // If status is "Returned", add returnReason and returnedAt
    if (status === "Returned" && returnReason) {
      updateData.returnReason = returnReason;
      updateData.returnedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    // Update status
    await db.collection("bookings").doc(bookingId).update(updateData);

    // Send notification if status changed (don't await - fire and forget)
    if (oldStatus !== status) {
      const { sendBookingStatusNotification } = await import("./notificationService");
      // Fire and forget - don't block booking update if notification fails
      sendBookingStatusNotification(
        bookingData.userId,
        bookingId,
        bookingData.trackingNumber,
        oldStatus,
        status
      ).catch((err) => {
        console.error("Failed to send booking status notification:", err);
      });
    }
  } catch (error: any) {
    console.error("Error updating booking status:", error);
    throw createError("Failed to update booking status", 500);
  }
};

/**
 * Update booking payment status
 */
export const updatePaymentStatus = async (
  bookingId: string,
  paymentStatus: PaymentStatus
): Promise<void> => {
  try {
    // Get current booking to check if it needs status update
    const bookingDoc = await db.collection("bookings").doc(bookingId).get();
    if (!bookingDoc.exists) {
      throw createError("Booking not found", 404);
    }

    const bookingData = bookingDoc.data()!;
    const updateData: any = {
      paymentStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const oldStatus = bookingData.status;
    const statusChanged = paymentStatus === "paid" && bookingData.status === "PendingPayment";
    
    // If payment is successful and booking is PendingPayment, confirm it (set to Created)
    if (statusChanged) {
      updateData.status = "Created" as BookingStatus;
    }

    await db.collection("bookings").doc(bookingId).update(updateData);

    // Send notifications (don't await - fire and forget)
    if (bookingData.paymentStatus !== paymentStatus) {
      const { sendPaymentStatusNotification } = await import("./notificationService");
      // Fire and forget - don't block payment update if notification fails
      // Only send notification for valid statuses (paid, unpaid, pending)
      if (paymentStatus === "paid" || paymentStatus === "pending") {
        sendPaymentStatusNotification(
          bookingData.userId,
          bookingId,
          paymentStatus === "paid" ? "paid" : "pending"
        ).catch((err) => {
          console.error("Failed to send payment status notification:", err);
        });
      }
    }

    // If booking status changed from PendingPayment to Created, send booking status notification
    if (statusChanged) {
      const { sendBookingStatusNotification } = await import("./notificationService");
      // Fire and forget - don't block payment update if notification fails
      sendBookingStatusNotification(
        bookingData.userId,
        bookingId,
        bookingData.trackingNumber,
        "PendingPayment",
        "Created"
      ).catch((err) => {
        console.error("Failed to send booking status notification:", err);
      });
    }
  } catch (error: any) {
    console.error("Error updating payment status:", error);
    throw createError("Failed to update payment status", 500);
  }
};

/**
 * Update POD signature (Admin only)
 */
export const updatePODSignature = async (
  bookingId: string,
  podSignature: string,
  podSignedBy: string
): Promise<Booking> => {
  try {
    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      throw createError("Booking not found", 404);
    }

    await bookingRef.update({
      podSignature,
      podSignedBy,
      podSignedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const updatedDoc = await bookingRef.get();
    const data = updatedDoc.data()!;

    return {
      id: updatedDoc.id,
      userId: data.userId,
      pickup: data.pickup,
      drop: data.drop,
      parcelDetails: data.parcelDetails,
      status: data.status,
      paymentStatus: data.paymentStatus,
      paymentMethod: data.paymentMethod,
      fare: data.fare,
      deliveryType: data.deliveryType,
      deliveryDate: data.deliveryDate?.toDate() || data.deliveryDate,
      podSignature: data.podSignature,
      podSignedBy: data.podSignedBy,
      podSignedAt: data.podSignedAt?.toDate() || data.podSignedAt,
      trackingNumber: data.trackingNumber,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  } catch (error: any) {
    console.error("Error updating POD signature:", error);
    throw createError("Failed to update POD signature", 500);
  }
};

/**
 * Update booking fare (Admin only)
 */
export const updateFare = async (
  bookingId: string,
  fare: number
): Promise<void> => {
  try {
    if (fare < 0) {
      throw createError("Fare cannot be negative", 400);
    }

    const bookingDoc = await db.collection("bookings").doc(bookingId).get();
    if (!bookingDoc.exists) {
      throw createError("Booking not found", 404);
    }

    await db.collection("bookings").doc(bookingId).update({
      fare,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error: any) {
    console.error("Error updating fare:", error);
    throw createError("Failed to update fare", 500);
  }
};

/**
 * Get booking by tracking number
 */
export const getBookingByTrackingNumber = async (
  trackingNumber: string
): Promise<Booking | null> => {
  try {
    const snapshot = await db
      .collection("bookings")
      .where("trackingNumber", "==", trackingNumber)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId,
      pickup: data.pickup,
      drop: data.drop,
      parcelDetails: data.parcelDetails,
      status: data.status,
      paymentStatus: data.paymentStatus,
      paymentMethod: data.paymentMethod,
      fare: data.fare,
      deliveryType: data.deliveryType,
      deliveryDate: data.deliveryDate?.toDate() || data.deliveryDate,
      podSignature: data.podSignature,
      podSignedBy: data.podSignedBy,
      podSignedAt: data.podSignedAt?.toDate() || data.podSignedAt,
      trackingNumber: data.trackingNumber,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  } catch (error: any) {
    console.error("Error getting booking by tracking number:", error);
    throw createError("Failed to get booking by tracking number", 500);
  }
};

/**
 * Search bookings (Admin only)
 * Supports searching by tracking number, booking ID, city names
 */
export const searchBookings = async (
  searchQuery: string,
  filters?: {
    status?: BookingStatus;
    paymentStatus?: PaymentStatus;
  }
): Promise<Booking[]> => {
  try {
    let query: admin.firestore.Query = db.collection("bookings");

    // Apply filters first
    if (filters?.status) {
      query = query.where("status", "==", filters.status);
    }

    if (filters?.paymentStatus) {
      query = query.where("paymentStatus", "==", filters.paymentStatus);
    }

    // Get all documents (no orderBy to avoid index requirement)
    const snapshot = await query.get();

    // Map to bookings first
    const allBookings = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        pickup: data.pickup,
        drop: data.drop,
        parcelDetails: data.parcelDetails,
        status: data.status,
        paymentStatus: data.paymentStatus,
        fare: data.fare,
        trackingNumber: data.trackingNumber,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    });

    // Filter in memory by search query (Firestore doesn't support full-text search)
    const searchLower = searchQuery.toLowerCase();
    const bookings = allBookings.filter((booking) => {
        // Search in tracking number
        if (booking.trackingNumber?.toLowerCase().includes(searchLower)) {
          return true;
        }
        // Search in booking ID
        if (booking.id.toLowerCase().includes(searchLower)) {
          return true;
        }
        // Search in pickup city
        if (booking.pickup.city?.toLowerCase().includes(searchLower)) {
          return true;
        }
        // Search in drop city
        if (booking.drop.city?.toLowerCase().includes(searchLower)) {
          return true;
        }
        // Search in pickup name
        if (booking.pickup.name?.toLowerCase().includes(searchLower)) {
          return true;
        }
        // Search in drop name
        if (booking.drop.name?.toLowerCase().includes(searchLower)) {
          return true;
        }
        return false;
      });

    // Sort by createdAt descending (newest first)
    return bookings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error: any) {
    console.error("Error searching bookings:", error);
    throw createError("Failed to search bookings", 500);
  }
};

/**
 * Get booking statistics (Admin dashboard)
 */
export const getBookingStatistics = async (): Promise<{
  total: number;
  byStatus: Record<BookingStatus, number>;
  byPaymentStatus: Record<PaymentStatus, number>;
  recentBookings: Booking[];
}> => {
  try {
    // Get all bookings (no orderBy to avoid index requirement)
    const snapshot = await db.collection("bookings").get();

    const bookings = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        pickup: data.pickup,
        drop: data.drop,
        parcelDetails: data.parcelDetails,
        status: data.status,
        paymentStatus: data.paymentStatus,
        fare: data.fare,
        trackingNumber: data.trackingNumber,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    });

    // Calculate statistics
    const byStatus: Record<BookingStatus, number> = {
      PendingPayment: 0,
      Created: 0,
      Picked: 0,
      Shipped: 0,
      Delivered: 0,
      Returned: 0,
    };

    const byPaymentStatus: Record<PaymentStatus, number> = {
      pending: 0,
      paid: 0,
      failed: 0,
      refunded: 0,
    };

    bookings.forEach((booking) => {
      const status = booking.status as BookingStatus;
      const paymentStatus = booking.paymentStatus as PaymentStatus;
      byStatus[status] = (byStatus[status] || 0) + 1;
      byPaymentStatus[paymentStatus] = (byPaymentStatus[paymentStatus] || 0) + 1;
    });

    // Sort by createdAt descending (newest first)
    const sortedBookings = bookings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      total: sortedBookings.length,
      byStatus,
      byPaymentStatus,
      recentBookings: sortedBookings.slice(0, 10), // Last 10 bookings
    };
  } catch (error: any) {
    console.error("Error getting booking statistics:", error);
    throw createError("Failed to get booking statistics", 500);
  }
};

