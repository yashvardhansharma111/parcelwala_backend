/**
 * Admin Service
 * Handles admin management operations
 * Super admin (from .env) can appoint co-admins
 */

import * as admin from "firebase-admin";
import { db } from "../config/firebase";
import { AppCreds } from "../config/creds";
import { createError } from "../utils/errorHandler";
import { getUserByPhoneNumber, getUserById } from "./userService";

export interface CoAdmin {
  id: string;
  phoneNumber: string;
  name: string;
  role: "admin";
  createdAt: Date;
  createdBy: string; // Super admin user ID who created this co-admin
}

/**
 * Check if user is super admin
 * Hardcoded super admin phone number: 8462044151
 */
export const isSuperAdmin = (phoneNumber: string): boolean => {
  // Hardcoded super admin phone number
  const SUPER_ADMIN_PHONE = "8462044151";
  
  // Normalize phone numbers for comparison
  const normalizePhone = (phone: string): string => {
    if (!phone) return "";
    // Remove all spaces, +, -, and country code
    let normalized = phone.trim().replace(/\s+/g, "").replace(/[+\-]/g, "");
    // Remove +91 or 91 prefix if present
    if (normalized.startsWith("91") && normalized.length === 12) {
      normalized = normalized.substring(2);
    }
    return normalized;
  };
  
  const normalizedUserPhone = normalizePhone(phoneNumber);
  const normalizedSuperAdminPhone = normalizePhone(SUPER_ADMIN_PHONE);
  
  return normalizedUserPhone === normalizedSuperAdminPhone;
};

/**
 * Appoint a co-admin (only super admin can do this)
 */
export const appointCoAdmin = async (
  superAdminId: string,
  phoneNumber: string,
  name: string
): Promise<CoAdmin> => {
  try {
    // Verify super admin
    const superAdmin = await getUserById(superAdminId);
    if (!superAdmin || !isSuperAdmin(superAdmin.phoneNumber)) {
      throw createError("Only super admin can appoint co-admins", 403);
    }

    // Validate phone number
    if (!phoneNumber || typeof phoneNumber !== "string") {
      throw createError("Phone number is required", 400);
    }

    // Validate name
    if (!name || name.trim().length === 0) {
      throw createError("Name is required", 400);
    }

    // Cannot appoint super admin as co-admin
    if (isSuperAdmin(phoneNumber)) {
      throw createError("Cannot change super admin role", 400);
    }

    // Check if user already exists
    const existingUser = await getUserByPhoneNumber(phoneNumber);
    
    if (existingUser) {
      // User exists, update to admin role
      if (existingUser.role === "admin") {
        throw createError("User is already an admin", 400);
      }
      
      await db.collection("users").doc(existingUser.id).update({
        role: "admin",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        id: existingUser.id,
        phoneNumber: existingUser.phoneNumber,
        name: existingUser.name || name,
        role: "admin",
        createdAt: existingUser.createdAt,
        createdBy: superAdminId,
      };
    } else {
      // Create new user as admin
      const newUserRef = db.collection("users").doc();
      const now = new Date();
      
      await newUserRef.set({
        phoneNumber,
        name: name.trim(),
        role: "admin",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        id: newUserRef.id,
        phoneNumber,
        name: name.trim(),
        role: "admin",
        createdAt: now,
        createdBy: superAdminId,
      };
    }
  } catch (error: any) {
    console.error("Error appointing co-admin:", error);
    throw error;
  }
};

/**
 * Remove co-admin (only super admin can do this)
 */
export const removeCoAdmin = async (
  superAdminId: string,
  coAdminId: string
): Promise<void> => {
  try {
    // Verify super admin
    const superAdmin = await getUserById(superAdminId);
    if (!superAdmin || !isSuperAdmin(superAdmin.phoneNumber)) {
      throw createError("Only super admin can remove co-admins", 403);
    }

    // Get co-admin to remove
    const coAdmin = await getUserById(coAdminId);
    if (!coAdmin) {
      throw createError("Co-admin not found", 404);
    }

    // Cannot remove super admin
    if (isSuperAdmin(coAdmin.phoneNumber)) {
      throw createError("Cannot remove super admin", 400);
    }

    if (coAdmin.role !== "admin") {
      throw createError("User is not an admin", 400);
    }

    // Change role back to customer
    await db.collection("users").doc(coAdminId).update({
      role: "customer",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error: any) {
    console.error("Error removing co-admin:", error);
    throw error;
  }
};

/**
 * Get all co-admins (only super admin can do this)
 */
export const getAllCoAdmins = async (superAdminId: string): Promise<CoAdmin[]> => {
  try {
    // Verify super admin
    const superAdmin = await getUserById(superAdminId);
    if (!superAdmin || !isSuperAdmin(superAdmin.phoneNumber)) {
      throw createError("Only super admin can view co-admins", 403);
    }

    // Get all users with admin role (excluding super admin)
    const snapshot = await db
      .collection("users")
      .where("role", "==", "admin")
      .get();

    const coAdmins: CoAdmin[] = [];
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      // Skip super admin
      if (!isSuperAdmin(data.phoneNumber)) {
        coAdmins.push({
          id: doc.id,
          phoneNumber: data.phoneNumber,
          name: data.name || "Unknown",
          role: "admin",
          createdAt: data.createdAt?.toDate() || new Date(),
          createdBy: data.createdBy || superAdminId, // Default to current super admin if not set
        });
      }
    });

    return coAdmins.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error: any) {
    console.error("Error getting co-admins:", error);
    throw error;
  }
};

