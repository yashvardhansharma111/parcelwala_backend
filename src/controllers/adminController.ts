/**
 * Admin Controller
 * Handles admin management operations
 */

import { Request, Response, NextFunction } from "express";
import * as adminService from "../services/adminService";
import { createError } from "../utils/errorHandler";

/**
 * Appoint a co-admin (Super admin only)
 * POST /admin/co-admins
 */
export const appointCoAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const superAdminId = req.user!.uid;
    const { phoneNumber, name } = req.body;

    if (!phoneNumber || typeof phoneNumber !== "string") {
      throw createError("Phone number is required", 400);
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw createError("Name is required", 400);
    }

    const coAdmin = await adminService.appointCoAdmin(superAdminId, phoneNumber, name);

    res.status(201).json({
      success: true,
      data: { coAdmin },
      message: "Co-admin appointed successfully",
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Remove a co-admin (Super admin only)
 * DELETE /admin/co-admins/:id
 */
export const removeCoAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const superAdminId = req.user!.uid;
    const { id } = req.params;

    if (!id) {
      throw createError("Co-admin ID is required", 400);
    }

    await adminService.removeCoAdmin(superAdminId, id);

    res.json({
      success: true,
      message: "Co-admin removed successfully",
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get all co-admins (Super admin only)
 * GET /admin/co-admins
 */
export const getAllCoAdmins = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const superAdminId = req.user!.uid;

    const coAdmins = await adminService.getAllCoAdmins(superAdminId);

    res.json({
      success: true,
      data: { coAdmins },
    });
  } catch (error: any) {
    next(error);
  }
};

