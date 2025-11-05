/**
 * User Controller
 * Handles user profile and admin dashboard endpoints
 */

import { Request, Response, NextFunction } from "express";
import { getUserById } from "../services/userService";
import { saveFCMToken } from "../services/notificationService";
import { createError } from "../utils/errorHandler";

/**
 * Get user profile
 * GET /user/profile
 */
export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw createError("User not authenticated", 401);
    }

    const user = await getUserById(req.user.uid);

    if (!user) {
      throw createError("User not found", 404);
    }

    // Remove sensitive data
    const { refreshToken, ...userData } = user;

    res.status(200).json({
      success: true,
      data: {
        user: userData,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Save FCM token for push notifications
 * POST /user/fcm-token
 */
export const saveFCMTokenEndpoint = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw createError("User not authenticated", 401);
    }

    const { token } = req.body;

    if (!token || typeof token !== "string") {
      throw createError("FCM token is required", 400);
    }

    await saveFCMToken(req.user.uid, token);

    res.status(200).json({
      success: true,
      message: "FCM token saved successfully",
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get admin dashboard data
 * GET /admin/dashboard
 */
export const getAdminDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw createError("User not authenticated", 401);
    }

    // This is a placeholder - implement actual dashboard logic
    // You can add booking statistics, revenue, etc.

    res.status(200).json({
      success: true,
      data: {
        message: "Admin dashboard data",
        user: {
          id: req.user.uid,
          phoneNumber: req.user.phoneNumber,
          role: req.user.role,
        },
        // Add more dashboard data here
      },
    });
  } catch (error: any) {
    next(error);
  }
};

