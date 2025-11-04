/**
 * Authentication Controller
 * Handles authentication endpoints
 */

import { Request, Response, NextFunction } from "express";
import { sendOTP, verifyOTP } from "../services/otpService";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../services/tokenService";
import {
  createOrGetUser,
  updateRefreshToken,
  removeRefreshToken,
  getUserById,
} from "../services/userService";
import { createError } from "../utils/errorHandler";

/**
 * Send OTP to phone number
 * POST /auth/send-otp
 */
export const sendOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { phoneNumber } = req.body;

    // Validate phone number
    if (!phoneNumber || typeof phoneNumber !== "string") {
      throw createError("Phone number is required", 400);
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      throw createError("Invalid phone number format", 400);
    }

    // Send OTP
    await sendOTP(phoneNumber);

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Verify OTP and create/login user
 * POST /auth/verify-otp
 */
export const verifyOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { phoneNumber, otp } = req.body;

    // Validate inputs
    if (!phoneNumber || typeof phoneNumber !== "string") {
      throw createError("Phone number is required", 400);
    }

    if (!otp || typeof otp !== "string" || otp.length !== 6) {
      throw createError("Valid 6-digit OTP is required", 400);
    }

    // Verify OTP
    const isValid = verifyOTP(phoneNumber, otp);

    if (!isValid) {
      throw createError("Invalid or expired OTP", 401);
    }

    // Create or get user
    const user = await createOrGetUser(phoneNumber);

    // Generate tokens
    const tokenPayload = {
      uid: user.id,
      phoneNumber: user.phoneNumber,
      role: user.role,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Store refresh token in Firestore
    await updateRefreshToken(user.id, refreshToken);

    // Return user data and tokens
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          phoneNumber: user.phoneNumber,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Refresh access token
 * POST /auth/refresh
 */
export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken || typeof refreshToken !== "string") {
      throw createError("Refresh token is required", 400);
    }

    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);

    // Get user from Firestore to verify refresh token matches
    const user = await getUserById(payload.uid);

    if (!user) {
      throw createError("User not found", 404);
    }

    // Verify stored refresh token matches
    if (user.refreshToken !== refreshToken) {
      throw createError("Invalid refresh token", 401);
    }

    // Generate new access token
    const tokenPayload = {
      uid: user.id,
      phoneNumber: user.phoneNumber,
      role: user.role,
    };

    const accessToken = generateAccessToken(tokenPayload);

    res.status(200).json({
      success: true,
      data: {
        accessToken,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Logout - invalidate refresh token
 * POST /auth/logout
 */
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken || typeof refreshToken !== "string") {
      throw createError("Refresh token is required", 400);
    }

    // Verify refresh token to get user ID
    const payload = verifyRefreshToken(refreshToken);

    // Remove refresh token from Firestore
    await removeRefreshToken(payload.uid);

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error: any) {
    // Even if token is invalid/expired, consider it logged out
    if (error.statusCode === 401) {
      return res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    }
    next(error);
  }
};
