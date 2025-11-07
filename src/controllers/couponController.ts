/**
 * Coupon Controller
 * Handles coupon-related HTTP requests
 */

import { Request, Response, NextFunction } from "express";
import * as couponService from "../services/couponService";
import { createError } from "../utils/errorHandler";

/**
 * Create a new coupon (Admin only)
 * POST /coupons
 */
export const createCoupon = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      code,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      maxUsage,
      validFrom,
      validUntil,
    } = req.body;

    // Validation
    if (!code || typeof code !== "string" || code.trim().length === 0) {
      throw createError("Coupon code is required", 400);
    }

    if (!discountType || !["percentage", "fixed"].includes(discountType)) {
      throw createError("Discount type must be 'percentage' or 'fixed'", 400);
    }

    if (!discountValue || typeof discountValue !== "number" || discountValue <= 0) {
      throw createError("Discount value must be a positive number", 400);
    }

    if (!validFrom || !validUntil) {
      throw createError("Valid from and valid until dates are required", 400);
    }

    const coupon = await couponService.createCoupon({
      code: code.trim(),
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      maxUsage,
      validFrom: new Date(validFrom),
      validUntil: new Date(validUntil),
    });

    res.status(201).json({
      success: true,
      data: { coupon },
      message: "Coupon created successfully",
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get all coupons (Admin only) with pagination
 * GET /coupons
 */
export const getAllCoupons = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const lastDocId = req.query.lastDocId as string | undefined;

    const result = await couponService.getAllCoupons({
      limit: Math.min(limit, 50), // Max 50 per page
      lastDocId,
    });

    res.json({
      success: true,
      data: {
        coupons: result.coupons,
        hasMore: result.hasMore,
        lastDocId: result.lastDocId,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get coupon by ID (Admin only)
 * GET /coupons/:id
 */
export const getCouponById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const coupon = await couponService.getCouponById(id);

    if (!coupon) {
      throw createError("Coupon not found", 404);
    }

    res.json({
      success: true,
      data: { coupon },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Update coupon (Admin only)
 * PUT /coupons/:id
 */
export const updateCoupon = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Convert date strings to Date objects if provided
    if (updates.validFrom) updates.validFrom = new Date(updates.validFrom);
    if (updates.validUntil) updates.validUntil = new Date(updates.validUntil);

    const coupon = await couponService.updateCoupon(id, updates);

    res.json({
      success: true,
      data: { coupon },
      message: "Coupon updated successfully",
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Delete coupon (Admin only)
 * DELETE /coupons/:id
 */
export const deleteCoupon = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    await couponService.deleteCoupon(id);

    res.json({
      success: true,
      message: "Coupon deleted successfully",
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Validate coupon code (Public endpoint for users)
 * POST /coupons/validate
 */
export const validateCoupon = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { code, orderAmount } = req.body;

    if (!code || typeof code !== "string") {
      throw createError("Coupon code is required", 400);
    }

    if (!orderAmount || typeof orderAmount !== "number" || orderAmount <= 0) {
      throw createError("Order amount must be a positive number", 400);
    }

    const result = await couponService.validateCoupon(code, orderAmount);

    res.json({
      success: result.isValid,
      data: result,
    });
  } catch (error: any) {
    next(error);
  }
};

