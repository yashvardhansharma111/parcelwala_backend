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
  role: "admin" | "customer";
  refreshToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Determine user role based on phone number
 */
export const determineRole = (phoneNumber: string): "admin" | "customer" => {
  return phoneNumber === AppCreds.admin.phoneNumber ? "admin" : "customer";
};

/**
 * Create or get user in Firestore
 */
export const createOrGetUser = async (
  phoneNumber: string
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
        role: data.role || role,
        refreshToken: data.refreshToken,
        createdAt: data.createdAt?.toDate() || now,
        updatedAt: now,
      };

      // Update user document
      await doc.ref.update({
        role: userData.role,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      // User doesn't exist, create new
      const newUserRef = usersRef.doc();
      userData = {
        id: newUserRef.id,
        phoneNumber,
        role,
        createdAt: now,
        updatedAt: now,
      };

      await newUserRef.set({
        phoneNumber: userData.phoneNumber,
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

