/**
 * Authentication Middleware
 * Verifies access token and attaches user to request
 */

import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../services/tokenService";
import { getUserById } from "../services/userService";
import { createError } from "../utils/errorHandler";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        phoneNumber: string;
        role: "admin" | "customer";
      };
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw createError("Authorization token missing", 401);
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify token
    const payload = verifyAccessToken(token);

    // Attach user to request
    req.user = {
      uid: payload.uid,
      phoneNumber: payload.phoneNumber,
      role: payload.role,
    };

    next();
  } catch (error: any) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: { message: error.message },
      });
    }
    next(createError("Authentication failed", 401));
  }
};

