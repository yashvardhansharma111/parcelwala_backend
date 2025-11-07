/**
 * Coupon Service
 * Handles coupon code operations
 */

import * as admin from "firebase-admin";
import { db } from "../config/firebase";
import { createError } from "../utils/errorHandler";

export interface Coupon {
  id: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  maxUsage?: number;
  currentUsage: number;
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new coupon
 */
export const createCoupon = async (couponData: {
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  maxUsage?: number;
  validFrom: Date;
  validUntil: Date;
}): Promise<Coupon> => {
  try {
    // Validate code format (uppercase, alphanumeric)
    const codeRegex = /^[A-Z0-9]+$/;
    if (!codeRegex.test(couponData.code)) {
      throw createError("Coupon code must be uppercase alphanumeric", 400);
    }

    // Check if code already exists
    const existingCoupon = await db
      .collection("coupons")
      .where("code", "==", couponData.code.toUpperCase())
      .limit(1)
      .get();

    if (!existingCoupon.empty) {
      throw createError("Coupon code already exists", 400);
    }

    // Validate discount values
    if (couponData.discountType === "percentage") {
      if (couponData.discountValue < 1 || couponData.discountValue > 100) {
        throw createError("Percentage discount must be between 1 and 100", 400);
      }
    } else {
      if (couponData.discountValue <= 0) {
        throw createError("Fixed discount must be greater than 0", 400);
      }
    }

    // Validate dates
    if (couponData.validUntil <= couponData.validFrom) {
      throw createError("Valid until date must be after valid from date", 400);
    }

    const now = new Date();
    const couponRef = db.collection("coupons").doc();
    const coupon: Omit<Coupon, "id"> = {
      code: couponData.code.toUpperCase(),
      discountType: couponData.discountType,
      discountValue: couponData.discountValue,
      minOrderAmount: couponData.minOrderAmount,
      maxDiscountAmount: couponData.maxDiscountAmount,
      maxUsage: couponData.maxUsage,
      currentUsage: 0,
      validFrom: couponData.validFrom,
      validUntil: couponData.validUntil,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await couponRef.set({
      ...coupon,
      validFrom: admin.firestore.Timestamp.fromDate(coupon.validFrom),
      validUntil: admin.firestore.Timestamp.fromDate(coupon.validUntil),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      id: couponRef.id,
      ...coupon,
    };
  } catch (error: any) {
    console.error("Error creating coupon:", error);
    throw error;
  }
};

/**
 * Get coupon by ID
 */
export const getCouponById = async (couponId: string): Promise<Coupon | null> => {
  try {
    const doc = await db.collection("coupons").doc(couponId).get();
    if (!doc.exists) {
      return null;
    }
    const data = doc.data()!;
    return {
      id: doc.id,
      ...data,
      validFrom: data.validFrom?.toDate() || new Date(),
      validUntil: data.validUntil?.toDate() || new Date(),
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Coupon;
  } catch (error: any) {
    console.error("Error getting coupon:", error);
    throw createError("Failed to get coupon", 500);
  }
};

/**
 * Get all coupons (with pagination)
 */
export const getAllCoupons = async (options?: {
  limit?: number;
  lastDocId?: string;
}): Promise<{
  coupons: Coupon[];
  hasMore: boolean;
  lastDocId?: string;
}> => {
  try {
    const limit = options?.limit || 20; // Default 20 items per page

    let query: admin.firestore.Query = db
      .collection("coupons")
      .orderBy("createdAt", "desc")
      .limit(limit + 1); // Fetch one extra to check if there's more

    // If lastDocId is provided, start after that document
    if (options?.lastDocId) {
      const lastDoc = await db.collection("coupons").doc(options.lastDocId).get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.get();
    const hasMore = snapshot.docs.length > limit;
    const docs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

    const coupons = docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        validFrom: data.validFrom?.toDate() || new Date(),
        validUntil: data.validUntil?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Coupon;
    });

    const lastDocId = coupons.length > 0 ? coupons[coupons.length - 1].id : undefined;

    return {
      coupons,
      hasMore,
      lastDocId,
    };
  } catch (error: any) {
    console.error("Error getting coupons:", error);
    throw createError("Failed to get coupons", 500);
  }
};

/**
 * Update coupon
 */
export const updateCoupon = async (
  couponId: string,
  updates: Partial<{
    discountType: "percentage" | "fixed";
    discountValue: number;
    minOrderAmount?: number;
    maxDiscountAmount?: number;
    maxUsage?: number;
    validFrom: Date;
    validUntil: Date;
    isActive: boolean;
  }>
): Promise<Coupon> => {
  try {
    const coupon = await getCouponById(couponId);
    if (!coupon) {
      throw createError("Coupon not found", 404);
    }

    const updateData: any = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (updates.discountType !== undefined) updateData.discountType = updates.discountType;
    if (updates.discountValue !== undefined) updateData.discountValue = updates.discountValue;
    if (updates.minOrderAmount !== undefined) updateData.minOrderAmount = updates.minOrderAmount;
    if (updates.maxDiscountAmount !== undefined) updateData.maxDiscountAmount = updates.maxDiscountAmount;
    if (updates.maxUsage !== undefined) updateData.maxUsage = updates.maxUsage;
    if (updates.validFrom !== undefined) updateData.validFrom = admin.firestore.Timestamp.fromDate(updates.validFrom);
    if (updates.validUntil !== undefined) updateData.validUntil = admin.firestore.Timestamp.fromDate(updates.validUntil);
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

    await db.collection("coupons").doc(couponId).update(updateData);

    const updated = await getCouponById(couponId);
    return updated!;
  } catch (error: any) {
    console.error("Error updating coupon:", error);
    throw error;
  }
};

/**
 * Delete coupon
 */
export const deleteCoupon = async (couponId: string): Promise<void> => {
  try {
    const coupon = await getCouponById(couponId);
    if (!coupon) {
      throw createError("Coupon not found", 404);
    }

    await db.collection("coupons").doc(couponId).delete();
  } catch (error: any) {
    console.error("Error deleting coupon:", error);
    throw error;
  }
};

/**
 * Validate coupon code
 */
export const validateCoupon = async (
  code: string,
  orderAmount: number
): Promise<{
  isValid: boolean;
  coupon?: Coupon;
  discountAmount: number;
  message?: string;
}> => {
  try {
    const normalizedCode = code.trim().toUpperCase();

    // Find coupon by code
    const snapshot = await db
      .collection("coupons")
      .where("code", "==", normalizedCode)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return {
        isValid: false,
        discountAmount: 0,
        message: "Invalid coupon code",
      };
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    const coupon: Coupon = {
      id: doc.id,
      ...data,
      validFrom: data.validFrom?.toDate() || new Date(),
      validUntil: data.validUntil?.toDate() || new Date(),
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Coupon;

    // Check if coupon is active
    if (!coupon.isActive) {
      return {
        isValid: false,
        discountAmount: 0,
        message: "Coupon is not active",
      };
    }

    // Check validity dates
    const now = new Date();
    if (now < coupon.validFrom) {
      return {
        isValid: false,
        discountAmount: 0,
        message: "Coupon is not yet valid",
      };
    }

    if (now > coupon.validUntil) {
      return {
        isValid: false,
        discountAmount: 0,
        message: "Coupon has expired",
      };
    }

    // Check minimum order amount
    if (coupon.minOrderAmount && orderAmount < coupon.minOrderAmount) {
      return {
        isValid: false,
        discountAmount: 0,
        message: `Minimum order amount of ₹${coupon.minOrderAmount} required`,
      };
    }

    // Check usage limit
    if (coupon.maxUsage && coupon.currentUsage >= coupon.maxUsage) {
      return {
        isValid: false,
        discountAmount: 0,
        message: "Coupon usage limit reached",
      };
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (coupon.discountType === "percentage") {
      discountAmount = (orderAmount * coupon.discountValue) / 100;
      // Apply max discount limit if set
      if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
        discountAmount = coupon.maxDiscountAmount;
      }
    } else {
      discountAmount = coupon.discountValue;
    }

    // Ensure discount doesn't exceed order amount
    discountAmount = Math.min(discountAmount, orderAmount);

    return {
      isValid: true,
      coupon,
      discountAmount,
    };
  } catch (error: any) {
    console.error("Error validating coupon:", error);
    return {
      isValid: false,
      discountAmount: 0,
      message: "Failed to validate coupon",
    };
  }
};

/**
 * Increment coupon usage
 */
export const incrementCouponUsage = async (couponId: string): Promise<void> => {
  try {
    await db.collection("coupons").doc(couponId).update({
      currentUsage: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error: any) {
    console.error("Error incrementing coupon usage:", error);
    // Don't throw - this shouldn't break the booking flow
  }
};

