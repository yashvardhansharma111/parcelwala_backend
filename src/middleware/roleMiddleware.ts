/**
 * Role Middleware
 * Restricts routes based on user role
 */

import { Request, Response, NextFunction } from "express";
import { createError } from "../utils/errorHandler";
import { AppCreds } from "../config/creds";

/**
 * Middleware to restrict access to super admin only (from .env)
 */
export const requireSuperAdmin = (
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
  
  const normalizedUserPhone = normalizePhone(req.user.phoneNumber);
  const normalizedSuperAdminPhone = normalizePhone(SUPER_ADMIN_PHONE);
  
  // Check if user is super admin
  if (req.user.role !== "admin" || normalizedUserPhone !== normalizedSuperAdminPhone) {
    return res.status(403).json({
      success: false,
      error: { message: "Super admin access required" },
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

    // For admin role: allow both super admin (from .env) and co-admins
    // Super admin has phone number matching ADMIN_PHONE_NUMBER
    // Co-admins have role "admin" but different phone number
    // Both can access admin routes, but only super admin can manage co-admins

    next();
  };
};

