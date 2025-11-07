/**
 * Notification Controller
 * Handles push notification operations
 */

import { Request, Response, NextFunction } from "express";
import * as notificationService from "../services/notificationService";
import { createError } from "../utils/errorHandler";

/**
 * Send broadcast notification to all users (Super admin only)
 * POST /admin/notifications/broadcast
 */
export const broadcastNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { title, body, data } = req.body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      throw createError("Title is required", 400);
    }

    if (!body || typeof body !== "string" || body.trim().length === 0) {
      throw createError("Body is required", 400);
    }

    const result = await notificationService.broadcastNotification({
      title: title.trim(),
      body: body.trim(),
      data: data || {},
    });

    res.json({
      success: true,
      data: {
        sent: result.sent,
        failed: result.failed,
        total: result.total,
      },
      message: `Notification sent to ${result.sent} users`,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Send notification to specific user (Super admin only)
 * POST /admin/notifications/send
 */
export const sendNotificationToUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId, title, body, data } = req.body;

    if (!userId || typeof userId !== "string") {
      throw createError("User ID is required", 400);
    }

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      throw createError("Title is required", 400);
    }

    if (!body || typeof body !== "string" || body.trim().length === 0) {
      throw createError("Body is required", 400);
    }

    await notificationService.sendNotificationToUser(userId, {
      title: title.trim(),
      body: body.trim(),
      data: data || {},
    });

    res.json({
      success: true,
      message: "Notification sent successfully",
    });
  } catch (error: any) {
    next(error);
  }
};

