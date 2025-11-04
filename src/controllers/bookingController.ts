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
    const { pickup, drop, parcelDetails, fare, paymentMethod } = req.body;

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

    const bookings = await bookingService.getUserBookings(userId);

    res.json({
      success: true,
      data: { bookings },
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
    const { status, paymentStatus } = req.query;

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

    const bookings = await bookingService.getAllBookings(filters);

    res.json({
      success: true,
      data: { bookings },
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
    const { status } = req.body;
    const userId = req.user!.uid;
    const userRole = req.user!.role;

    if (!status) {
      throw createError("Status is required", 400);
    }

    const validStatuses: bookingService.BookingStatus[] = ["Created", "Picked", "Shipped", "Delivered"];
    if (!validStatuses.includes(status)) {
      throw createError("Invalid status", 400);
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

    await bookingService.updateBookingStatus(id, status);

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
