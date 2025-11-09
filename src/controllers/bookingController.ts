/**
 * Booking Controller
 * Handles booking-related HTTP requests
 */

import { Request, Response, NextFunction } from "express";
import * as bookingService from "../services/bookingService";
import { createError } from "../utils/errorHandler";

/**
 * Create a new booking
 * POST /bookings
 */
export const createBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.uid;
    const { pickup, drop, parcelDetails, fare, paymentMethod, couponCode, deliveryType, deliveryDate } = req.body;

    // Validation
    if (!pickup || !drop || !parcelDetails) {
      throw createError("Pickup, drop, and parcel details are required", 400);
    }

    if (!pickup.name || !pickup.phone || !pickup.address || !pickup.city || !pickup.state || !pickup.pincode) {
      throw createError("Complete pickup address is required", 400);
    }

    if (!drop.name || !drop.phone || !drop.address || !drop.city || !drop.state || !drop.pincode) {
      throw createError("Complete drop address is required", 400);
    }

    if (!parcelDetails.type || !parcelDetails.weight) {
      throw createError("Parcel type and weight are required", 400);
    }

    // Validate payment method if provided
    if (paymentMethod && !["cod", "online"].includes(paymentMethod)) {
      throw createError("Invalid payment method. Must be 'cod' or 'online'", 400);
    }

    const booking = await bookingService.createBooking(userId, {
      pickup,
      drop,
      parcelDetails,
      fare,
      paymentMethod,
      couponCode,
      deliveryType,
      deliveryDate,
    });

    res.status(201).json({
      success: true,
      data: { booking },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get booking by ID
 * GET /bookings/:id
 */
export const getBookingById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.uid;
    const userRole = req.user!.role;

    const booking = await bookingService.getBookingById(id);

    if (!booking) {
      throw createError("Booking not found", 404);
    }

    // Check if user has permission (own booking or admin)
    if (booking.userId !== userId && userRole !== "admin") {
      throw createError("Unauthorized to access this booking", 403);
    }

    res.json({
      success: true,
      data: { booking },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get user's bookings
 * GET /bookings
 */
export const getUserBookings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.uid;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const lastDocId = req.query.lastDocId as string | undefined;

    // Log for debugging
    console.log(`[getUserBookings] Fetching bookings for user: ${userId}, limit: ${limit}`);

    const result = await bookingService.getUserBookings(userId, {
      limit: Math.min(limit, 50), // Max 50 per page
      lastDocId,
    });

    // Validate that all bookings belong to this user (security check)
    const invalidBookings = result.bookings.filter((b) => b.userId !== userId);
    if (invalidBookings.length > 0) {
      console.error(`[getUserBookings] SECURITY WARNING: Found ${invalidBookings.length} bookings not belonging to user ${userId}`);
      // Filter out invalid bookings
      const validBookings = result.bookings.filter((b) => b.userId === userId);
      res.json({
        success: true,
        data: {
          bookings: validBookings,
          hasMore: result.hasMore,
          lastDocId: validBookings.length > 0 ? validBookings[validBookings.length - 1].id : undefined,
        },
      });
      return;
    }

    console.log(`[getUserBookings] Returning ${result.bookings.length} bookings for user: ${userId}, hasMore: ${result.hasMore}`);

    res.json({
      success: true,
      data: {
        bookings: result.bookings,
        hasMore: result.hasMore,
        lastDocId: result.lastDocId,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get all bookings (Admin only)
 * GET /bookings/admin/all
 */
export const getAllBookings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, paymentStatus, limit, lastDocId } = req.query;

    const filters: {
      status?: bookingService.BookingStatus;
      paymentStatus?: bookingService.PaymentStatus;
    } = {};

    if (status) {
      filters.status = status as bookingService.BookingStatus;
    }

    if (paymentStatus) {
      filters.paymentStatus = paymentStatus as bookingService.PaymentStatus;
    }

    const result = await bookingService.getAllBookings(filters, {
      limit: limit ? Math.min(parseInt(limit as string), 50) : 20, // Max 50 per page
      lastDocId: lastDocId as string | undefined,
    });

    res.json({
      success: true,
      data: {
        bookings: result.bookings,
        hasMore: result.hasMore,
        lastDocId: result.lastDocId,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Update booking status
 * PATCH /bookings/:id/status
 */
export const updateBookingStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, returnReason } = req.body;
    const userId = req.user!.uid;
    const userRole = req.user!.role;

    if (!status) {
      throw createError("Status is required", 400);
    }

    const validStatuses: bookingService.BookingStatus[] = ["Created", "Picked", "Shipped", "Delivered", "Returned"];
    if (!validStatuses.includes(status)) {
      throw createError("Invalid status", 400);
    }

    // If status is "Returned", returnReason is required
    if (status === "Returned" && !returnReason) {
      throw createError("Return reason is required for returned parcels", 400);
    }

    // Check if booking exists and user has permission
    const booking = await bookingService.getBookingById(id);
    if (!booking) {
      throw createError("Booking not found", 404);
    }

    // Only admin can update status, or user can update their own booking to "Created"
    if (userRole !== "admin" && (booking.userId !== userId || status !== "Created")) {
      throw createError("Unauthorized to update booking status", 403);
    }

    await bookingService.updateBookingStatus(id, status, returnReason);

    const updatedBooking = await bookingService.getBookingById(id);

    res.json({
      success: true,
      data: { booking: updatedBooking },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Update payment status
 * PATCH /bookings/:id/payment-status
 */
export const updatePaymentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;
    const userRole = req.user!.role;

    if (!paymentStatus) {
      throw createError("Payment status is required", 400);
    }

    const validPaymentStatuses: bookingService.PaymentStatus[] = ["pending", "paid", "failed", "refunded"];
    if (!validPaymentStatuses.includes(paymentStatus)) {
      throw createError("Invalid payment status", 400);
    }

    // Only admin can update payment status
    if (userRole !== "admin") {
      throw createError("Unauthorized to update payment status", 403);
    }

    await bookingService.updatePaymentStatus(id, paymentStatus);

    const updatedBooking = await bookingService.getBookingById(id);

    res.json({
      success: true,
      data: { booking: updatedBooking },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get booking by tracking number
 * GET /bookings/track/:trackingNumber
 */
export const getBookingByTrackingNumber = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { trackingNumber } = req.params;

    if (!trackingNumber) {
      throw createError("Tracking number is required", 400);
    }

    const booking = await bookingService.getBookingByTrackingNumber(trackingNumber);

    if (!booking) {
      throw createError("Booking not found", 404);
    }

    res.json({
      success: true,
      data: { booking },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Search bookings (Admin only)
 * GET /bookings/admin/search
 */
export const searchBookings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { q, status, paymentStatus } = req.query;

    if (!q || typeof q !== "string") {
      throw createError("Search query is required", 400);
    }

    const filters: {
      status?: bookingService.BookingStatus;
      paymentStatus?: bookingService.PaymentStatus;
    } = {};

    if (status) {
      filters.status = status as bookingService.BookingStatus;
    }

    if (paymentStatus) {
      filters.paymentStatus = paymentStatus as bookingService.PaymentStatus;
    }

    const bookings = await bookingService.searchBookings(q, filters);

    res.json({
      success: true,
      data: { bookings },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Update booking fare (Admin only)
 * PATCH /bookings/:id/fare
 */
export const updateFare = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { fare } = req.body;

    if (fare === undefined || fare === null) {
      throw createError("Fare is required", 400);
    }

    if (typeof fare !== "number" || fare < 0) {
      throw createError("Fare must be a positive number", 400);
    }

    await bookingService.updateFare(id, fare);

    const updatedBooking = await bookingService.getBookingById(id);

    res.json({
      success: true,
      data: { booking: updatedBooking },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Update POD signature (Admin only)
 * PATCH /bookings/:id/pod
 */
export const updatePODSignature = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { podSignature, podSignedBy } = req.body;
    const userRole = req.user!.role;

    if (!podSignature || !podSignedBy) {
      throw createError("POD signature and signed by name are required", 400);
    }

    // Only admin can update POD signature
    if (userRole !== "admin") {
      throw createError("Unauthorized to update POD signature", 403);
    }

    const booking = await bookingService.updatePODSignature(id, podSignature, podSignedBy);

    res.json({
      success: true,
      data: { booking },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get booking statistics (Admin only)
 * GET /bookings/admin/statistics
 */
export const getBookingStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const statistics = await bookingService.getBookingStatistics();

    res.json({
      success: true,
      data: { statistics },
    });
  } catch (error: any) {
    next(error);
  }
};
