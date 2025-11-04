/**
 * Token Service
 * Handles JWT access and refresh token creation and verification
 */

import jwt from "jsonwebtoken";
import { AppCreds } from "../config/creds";
import { createError } from "../utils/errorHandler";

export interface TokenPayload {
  uid: string;
  phoneNumber: string;
  role: "admin" | "customer";
}

/**
 * Generate access token
 */
export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, AppCreds.auth.jwtSecret, {
    expiresIn: AppCreds.auth.accessTokenExpiry as string,
  } as jwt.SignOptions);
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, AppCreds.auth.jwtRefreshSecret, {
    expiresIn: AppCreds.auth.refreshTokenExpiry as string,
  } as jwt.SignOptions);
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    const decoded = jwt.verify(token, AppCreds.auth.jwtSecret) as TokenPayload;
    return decoded;
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      throw createError("Access token expired", 401);
    }
    if (error.name === "JsonWebTokenError") {
      throw createError("Invalid access token", 401);
    }
    throw createError("Token verification failed", 401);
  }
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): TokenPayload => {
  try {
    const decoded = jwt.verify(
      token,
      AppCreds.auth.jwtRefreshSecret
    ) as TokenPayload;
    return decoded;
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      throw createError("Refresh token expired", 401);
    }
    if (error.name === "JsonWebTokenError") {
      throw createError("Invalid refresh token", 401);
    }
    throw createError("Token verification failed", 401);
  }
};

