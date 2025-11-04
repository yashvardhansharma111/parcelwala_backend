/**
 * Role Middleware
 * Restricts routes based on user role
 */

import { Request, Response, NextFunction } from "express";
import { createError } from "../utils/errorHandler";
import { AppCreds } from "../config/creds";

/**
 * Middleware to restrict access to admin only
 */
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { message: "Authentication required" },
    });
  }

  // Check if user is admin
  if (req.user.role !== "admin" || req.user.phoneNumber !== AppCreds.admin.phoneNumber) {
    return res.status(403).json({
      success: false,
      error: { message: "Admin access required" },
    });
  }

  next();
};

/**
 * Middleware factory to restrict access by role
 * @param roles Array of allowed roles
 */
export const requireRole = (...roles: ("admin" | "customer")[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: "Authentication required" },
      });
    }

    // Check if user has one of the required roles
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { message: `Access denied. Required roles: ${roles.join(", ")}` },
      });
    }

    // Additional check for admin: verify phone number matches
    if (req.user.role === "admin" && req.user.phoneNumber !== AppCreds.admin.phoneNumber) {
      return res.status(403).json({
        success: false,
        error: { message: "Admin access required" },
      });
    }

    next();
  };
};

