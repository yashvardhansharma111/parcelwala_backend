/**
 * Analytics Service
 * Provides analytics data for admin dashboard
 */

import * as admin from "firebase-admin";
import { db } from "../config/firebase";
import { createError } from "../utils/errorHandler";
import { getAllBookings } from "./bookingService";
import { BookingStatus } from "./bookingService";

interface DashboardAnalytics {
  userCount: number;
  totalBookings: number;
  todayBookings: number;
  inTransitBookings: number;
  deliveredBookings: number;
  cancelledBookings: number;
  dailyRevenue: number;
  monthlyRevenue: number;
  totalRevenue: number;
}

interface CustomerSummary {
  userId: string;
  phoneNumber: string;
  name?: string;
  totalBookings: number;
  lifetimeSpend: number;
  complaints: number;
  lastBookingDate?: Date;
}

interface RevenueData {
  date: string;
  revenue: number;
  bookings: number;
}

interface FailedDelivery {
  bookingId: string;
  trackingNumber?: string;
  customerPhone: string;
  customerName: string;
  status: BookingStatus;
  fare?: number;
  createdAt: Date;
  reason?: string;
}

/**
 * Get dashboard analytics
 */
export const getDashboardAnalytics = async (): Promise<DashboardAnalytics> => {
  try {
    // Get user count
    const usersSnapshot = await db.collection("users").get();
    const userCount = usersSnapshot.size;

    // Get all bookings
    const bookingsResult = await getAllBookings({}, { limit: 10000 }); // Get all bookings for analytics
    const bookings = bookingsResult.bookings;

    // Calculate today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Calculate statistics
    const totalBookings = bookings.length;
    const todayBookings = bookings.filter(
      (b) => b.createdAt >= today && b.createdAt < tomorrow
    ).length;
    const inTransitBookings = bookings.filter(
      (b) => b.status === "Shipped"
    ).length;
    const deliveredBookings = bookings.filter(
      (b) => b.status === "Delivered"
    ).length;
    const cancelledBookings = bookings.filter(
      (b) => b.status === "Returned"
    ).length;

    // Calculate revenue
    const totalRevenue = bookings
      .filter((b) => b.fare && b.paymentStatus === "paid")
      .reduce((sum, b) => sum + (b.fare || 0), 0);

    // Calculate monthly revenue (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const monthlyRevenue = bookings
      .filter(
        (b) =>
          b.fare &&
          b.paymentStatus === "paid" &&
          b.createdAt >= thirtyDaysAgo
      )
      .reduce((sum, b) => sum + (b.fare || 0), 0);

    // Calculate daily revenue (today)
    const dailyRevenue = bookings
      .filter(
        (b) =>
          b.fare &&
          b.paymentStatus === "paid" &&
          b.createdAt >= today &&
          b.createdAt < tomorrow
      )
      .reduce((sum, b) => sum + (b.fare || 0), 0);

    return {
      userCount,
      totalBookings,
      todayBookings,
      inTransitBookings,
      deliveredBookings,
      cancelledBookings,
      dailyRevenue,
      monthlyRevenue,
      totalRevenue,
    };
  } catch (error: any) {
    console.error("Error getting dashboard analytics:", error);
    throw createError("Failed to get dashboard analytics", 500);
  }
};

/**
 * Get customer analytics
 */
export const getCustomerAnalytics = async (
  userId: string
): Promise<{
  userId: string;
  phoneNumber: string;
  name?: string;
  totalBookings: number;
  lifetimeSpend: number;
  bookings: any[];
  complaints: number;
}> => {
  try {
    // Get user
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      throw createError("User not found", 404);
    }

    const userData = userDoc.data()!;

    // Get user bookings
    const bookingsSnapshot = await db
      .collection("bookings")
      .where("userId", "==", userId)
      .get();

    const bookings = bookingsSnapshot.docs.map((doc) => {
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

    // Calculate lifetime spend
    const lifetimeSpend = bookings
      .filter((b) => b.fare && b.paymentStatus === "paid")
      .reduce((sum, b) => sum + (b.fare || 0), 0);

    // Get complaints (if we have a complaints collection)
    let complaints = 0;
    try {
      const complaintsSnapshot = await db
        .collection("complaints")
        .where("userId", "==", userId)
        .get();
      complaints = complaintsSnapshot.size;
    } catch (error) {
      // Complaints collection might not exist yet
      complaints = 0;
    }

    return {
      userId,
      phoneNumber: userData.phoneNumber,
      name: userData.name,
      totalBookings: bookings.length,
      lifetimeSpend,
      bookings: bookings.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      ),
      complaints,
    };
  } catch (error: any) {
    console.error("Error getting customer analytics:", error);
    throw createError("Failed to get customer analytics", 500);
  }
};

/**
 * Get all customers with summary
 */
export const getAllCustomers = async (): Promise<CustomerSummary[]> => {
  try {
    const usersSnapshot = await db
      .collection("users")
      .where("role", "==", "customer")
      .get();

    const customers: CustomerSummary[] = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;

      // Get user bookings
      const bookingsSnapshot = await db
        .collection("bookings")
        .where("userId", "==", userId)
        .get();

      const bookings = bookingsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      });

      // Calculate lifetime spend
      const lifetimeSpend = bookings
        .filter((b: any) => b.fare && b.paymentStatus === "paid")
        .reduce((sum: number, b: any) => sum + (b.fare || 0), 0);

      // Get complaints
      let complaints = 0;
      try {
        const complaintsSnapshot = await db
          .collection("complaints")
          .where("userId", "==", userId)
          .get();
        complaints = complaintsSnapshot.size;
      } catch (error) {
        complaints = 0;
      }

      // Get last booking date
      const lastBooking =
        bookings.length > 0
          ? bookings.sort(
              (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
            )[0]
          : null;

      customers.push({
        userId,
        phoneNumber: userData.phoneNumber,
        name: userData.name,
        totalBookings: bookings.length,
        lifetimeSpend,
        complaints,
        lastBookingDate: lastBooking?.createdAt,
      });
    }

    return customers.sort(
      (a, b) => (b.lifetimeSpend || 0) - (a.lifetimeSpend || 0)
    );
  } catch (error: any) {
    console.error("Error getting all customers:", error);
    throw createError("Failed to get customers", 500);
  }
};

/**
 * Get revenue analytics for the last N days
 */
export const getRevenueAnalytics = async (
  days: number = 30
): Promise<RevenueData[]> => {
  try {
    const bookingsResult = await getAllBookings({}, { limit: 10000 });
    const bookings = bookingsResult.bookings;

    // Calculate date range
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Filter bookings within date range
    const filteredBookings = bookings.filter(
      (b) =>
        b.createdAt >= startDate &&
        b.createdAt <= endDate &&
        b.fare &&
        b.paymentStatus === "paid"
    );

    // Group by date
    const revenueByDate: { [key: string]: RevenueData } = {};

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split("T")[0];
      revenueByDate[dateKey] = {
        date: dateKey,
        revenue: 0,
        bookings: 0,
      };
    }

    // Calculate revenue per day
    filteredBookings.forEach((booking) => {
      const dateKey = booking.createdAt.toISOString().split("T")[0];
      if (revenueByDate[dateKey]) {
        revenueByDate[dateKey].revenue += booking.fare || 0;
        revenueByDate[dateKey].bookings += 1;
      }
    });

    return Object.values(revenueByDate).sort(
      (a, b) => a.date.localeCompare(b.date)
    );
  } catch (error: any) {
    console.error("Error getting revenue analytics:", error);
    throw createError("Failed to get revenue analytics", 500);
  }
};

/**
 * Get failed deliveries and returns
 */
export const getFailedDeliveries = async (): Promise<FailedDelivery[]> => {
  try {
    const bookingsResult = await getAllBookings({}, { limit: 10000 });
    const bookings = bookingsResult.bookings;

    // Filter failed deliveries and returns
    const failed = bookings.filter(
      (b) =>
        b.status === "Returned" ||
        (b.status === "Delivered" && b.paymentStatus === "failed")
    );

    // Get user details for each booking
    const failedDeliveries: FailedDelivery[] = [];

    for (const booking of failed) {
      try {
        const userDoc = await db.collection("users").doc(booking.userId).get();
        const userData = userDoc.exists ? userDoc.data() : null;

        failedDeliveries.push({
          bookingId: booking.id,
          trackingNumber: booking.trackingNumber,
          customerPhone: userData?.phoneNumber || "Unknown",
          customerName: userData?.name || "Unknown",
          status: booking.status,
          fare: booking.fare,
          createdAt: booking.createdAt,
        });
      } catch (error) {
        console.error(`Error getting user for booking ${booking.id}:`, error);
      }
    }

    return failedDeliveries.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  } catch (error: any) {
    console.error("Error getting failed deliveries:", error);
    throw createError("Failed to get failed deliveries", 500);
  }
};

