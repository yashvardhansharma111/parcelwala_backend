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
    // Extract temp ID from merchantReferenceId (format: temp-userId-timestamp-timestamp)
    const parts = merchantReferenceId.split("-");
    const tempId = `temp-${parts[1]}-${parts[2]}`;
    
    const tempData: TempBookingData = {
      userId,
      pickup: bookingData.pickup,
      drop: bookingData.drop,
      parcelDetails: bookingData.parcelDetails,
      fare: bookingData.fare,
      paymentMethod: "online",
      couponCode: bookingData.couponCode,
      merchantReferenceId,
      createdAt: new Date(),
    };

    // Store with TTL of 1 hour (booking should be created within payment window)
    await db.collection("temp_bookings").doc(tempId).set({
      ...tempData,
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 60 * 60 * 1000)),
    });

    return tempId;
  } catch (error: any) {
    console.error("Error storing temp booking data:", error);
    throw createError("Failed to store temporary booking data", 500);
  }
};

/**
 * Get temporary booking data
 */
export const getTempBookingData = async (tempId: string): Promise<TempBookingData | null> => {
  try {
    const doc = await db.collection("temp_bookings").doc(tempId).get();
    if (!doc.exists) {
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
}

/**
 * Generate a unique tracking number
 */
const generateTrackingNumber = (): string => {
  const prefix = "PBS";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
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
  }
): Promise<Booking> => {
  try {
    const trackingNumber = generateTrackingNumber();
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

    // Add payment method if provided
    if (bookingData.paymentMethod) {
      bookingData_1.paymentMethod = bookingData.paymentMethod;
    }

    // Add coupon code if provided
    if (bookingData.couponCode) {
      bookingData_1.couponCode = bookingData.couponCode;
    }

    const bookingRef = db.collection("bookings").doc();
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

    // Build query
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

    const snapshot = await query.get();
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
        trackingNumber: data.trackingNumber,
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
  status: BookingStatus
): Promise<void> => {
  try {
    // Get current booking to track status change
    const bookingDoc = await db.collection("bookings").doc(bookingId).get();
    if (!bookingDoc.exists) {
      throw createError("Booking not found", 404);
    }

    const bookingData = bookingDoc.data()!;
    const oldStatus = bookingData.status as BookingStatus;

    // Update status
    await db.collection("bookings").doc(bookingId).update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

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
      sendPaymentStatusNotification(
        bookingData.userId,
        bookingId,
        paymentStatus
      ).catch((err) => {
        console.error("Failed to send payment status notification:", err);
      });
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
      fare: data.fare,
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

