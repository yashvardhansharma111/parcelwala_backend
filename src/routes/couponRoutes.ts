/**
 * Coupon Routes
 * /coupons endpoints
 */

import { Router } from "express";
import * as couponController from "../controllers/couponController";
import { authenticate } from "../middleware/authMiddleware";
import { requireRole } from "../middleware/roleMiddleware";

const router = Router();

// Validate coupon (public endpoint - users can validate)
router.post("/validate", couponController.validateCoupon);

// All other routes require authentication and admin role
router.use(authenticate);
router.use(requireRole("admin"));

// Coupon management (Admin only)
router.post("/", couponController.createCoupon);
router.get("/", couponController.getAllCoupons);
router.get("/:id", couponController.getCouponById);
router.put("/:id", couponController.updateCoupon);
router.delete("/:id", couponController.deleteCoupon);

export default router;

