/**
 * User Service
 * Handles Firestore user operations
 */

import * as admin from "firebase-admin";
import { db } from "../config/firebase";
import { AppCreds } from "../config/creds";
import { createError } from "../utils/errorHandler";

export interface User {
  id: string;
  phoneNumber: string;
  name?: string; // User's name
  role: "admin" | "customer";
  refreshToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Determine user role based on phone number
 * Hardcoded super admin phone number: 8462044151
 */
export const determineRole = (phoneNumber: string): "admin" | "customer" => {
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
  
  return normalizedUserPhone === normalizedSuperAdminPhone ? "admin" : "customer";
};

/**
 * Create or get user in Firestore
 */
export const createOrGetUser = async (
  phoneNumber: string,
  name?: string
): Promise<User> => {
  try {
    // Determine role
    const role = determineRole(phoneNumber);

    // Try to find existing user by phone number
    const usersRef = db.collection("users");
    const snapshot = await usersRef.where("phoneNumber", "==", phoneNumber).limit(1).get();

    let userData: User;
    const now = new Date();

    if (!snapshot.empty) {
      // User exists, update it
      const doc = snapshot.docs[0];
      const data = doc.data();

      userData = {
        id: doc.id,
        phoneNumber,
        name: name || data.name, // Update name if provided, otherwise keep existing
        role: data.role || role,
        refreshToken: data.refreshToken,
        createdAt: data.createdAt?.toDate() || now,
        updatedAt: now,
      };

      // Update user document (only update name if provided)
      const updateData: any = {
        role: userData.role,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (name) {
        updateData.name = name;
      }
      await doc.ref.update(updateData);
    } else {
      // User doesn't exist, create new
      // Name is required for new users
      if (!name || name.trim().length === 0) {
        throw createError("Name is required for new users", 400);
      }

      const newUserRef = usersRef.doc();
      userData = {
        id: newUserRef.id,
        phoneNumber,
        name: name.trim(),
        role,
        createdAt: now,
        updatedAt: now,
      };

      await newUserRef.set({
        phoneNumber: userData.phoneNumber,
        name: userData.name,
        role: userData.role,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return userData;
  } catch (error: any) {
    console.error("Error creating/getting user:", error);
    throw createError("Failed to create or get user", 500);
  }
};

/**
 * Update user refresh token
 */
export const updateRefreshToken = async (
  userId: string,
  refreshToken: string
): Promise<void> => {
  try {
    await db.collection("users").doc(userId).update({
      refreshToken,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error: any) {
    console.error("Error updating refresh token:", error);
    throw createError("Failed to update refresh token", 500);
  }
};

/**
 * Remove refresh token (logout)
 */
export const removeRefreshToken = async (userId: string): Promise<void> => {
  try {
    await db.collection("users").doc(userId).update({
      refreshToken: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error: any) {
    console.error("Error removing refresh token:", error);
    throw createError("Failed to remove refresh token", 500);
  }
};

/**
 * Get user by phone number
 */
export const getUserByPhoneNumber = async (phoneNumber: string): Promise<User | null> => {
  try {
    const usersRef = db.collection("users");
    const snapshot = await usersRef.where("phoneNumber", "==", phoneNumber).limit(1).get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      phoneNumber: data.phoneNumber,
      name: data.name,
      role: data.role,
      refreshToken: data.refreshToken,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  } catch (error: any) {
    console.error("Error getting user by phone number:", error);
    throw createError("Failed to get user", 500);
  }
};

/**
 * Get user by ID
 */
export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return null;
    }

    const data = userDoc.data()!;
    return {
      id: userDoc.id,
      phoneNumber: data.phoneNumber,
      name: data.name,
      role: data.role,
      refreshToken: data.refreshToken,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  } catch (error: any) {
    console.error("Error getting user:", error);
    throw createError("Failed to get user", 500);
  }
};

