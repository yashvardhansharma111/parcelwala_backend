/**
 * Booking Service
 * Handles Firestore booking operations
 */

import * as admin from "firebase-admin";
import { db } from "../config/firebase";
import { createError } from "../utils/errorHandler";

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

export type BookingStatus = "PendingPayment" | "Created" | "Picked" | "Shipped" | "Delivered";
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
      fare: data.fare,
      trackingNumber: data.trackingNumber,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  } catch (error: any) {
    console.error("Error getting booking:", error);
    throw createError("Failed to get booking", 500);
  }
};

/**
 * Get all bookings for a user
 */
export const getUserBookings = async (userId: string): Promise<Booking[]> => {
  try {
    // Query by userId (no orderBy to avoid index requirement)
    const snapshot = await db
      .collection("bookings")
      .where("userId", "==", userId)
      .get();

    // Map to bookings and sort by createdAt in memory
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

    // Sort by createdAt descending (newest first)
    return bookings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error: any) {
    console.error("Error getting user bookings:", error);
    throw createError("Failed to get user bookings", 500);
  }
};

/**
 * Get all bookings (Admin only)
 */
export const getAllBookings = async (filters?: {
  status?: BookingStatus;
  paymentStatus?: PaymentStatus;
}): Promise<Booking[]> => {
  try {
    // Start with base query (no orderBy to avoid index requirement)
    let query: admin.firestore.Query = db.collection("bookings");

    if (filters?.status) {
      query = query.where("status", "==", filters.status);
    }

    if (filters?.paymentStatus) {
      query = query.where("paymentStatus", "==", filters.paymentStatus);
    }

    const snapshot = await query.get();

    // Map to bookings and sort by createdAt in memory
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
        paymentMethod: data.paymentMethod,
        fare: data.fare,
        trackingNumber: data.trackingNumber,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    });

    // Sort by createdAt descending (newest first)
    return bookings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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
    await db.collection("bookings").doc(bookingId).update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
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

    // If payment is successful and booking is PendingPayment, confirm it (set to Created)
    if (paymentStatus === "paid" && bookingData.status === "PendingPayment") {
      updateData.status = "Created" as BookingStatus;
    }

    await db.collection("bookings").doc(bookingId).update(updateData);
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

