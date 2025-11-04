/**
 * Booking Routes
 * /bookings endpoints
 */

import { Router } from "express";
import * as bookingController from "../controllers/bookingController";
import { authenticate } from "../middleware/authMiddleware";
import { requireRole } from "../middleware/roleMiddleware";

const router = Router();

// Track booking by tracking number (public endpoint, no auth required)
router.get("/track/:trackingNumber", bookingController.getBookingByTrackingNumber);

// All other booking routes require authentication
router.use(authenticate);

// Create booking
router.post("/", bookingController.createBooking);

// Get user's bookings
router.get("/", bookingController.getUserBookings);

// Get booking by ID
router.get("/:id", bookingController.getBookingById);

// Update booking status
router.patch("/:id/status", bookingController.updateBookingStatus);

// Admin routes
router.get("/admin/all", requireRole("admin"), bookingController.getAllBookings);
router.get("/admin/search", requireRole("admin"), bookingController.searchBookings);
router.get("/admin/statistics", requireRole("admin"), bookingController.getBookingStatistics);
router.patch("/:id/payment-status", requireRole("admin"), bookingController.updatePaymentStatus);
router.patch("/:id/fare", requireRole("admin"), bookingController.updateFare);

export default router;

