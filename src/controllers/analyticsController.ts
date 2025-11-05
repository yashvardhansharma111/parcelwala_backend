/**
 * Analytics Controller
 * Handles analytics-related HTTP requests for admin dashboard
 */

import { Request, Response, NextFunction } from "express";
import * as analyticsService from "../services/analyticsService";
import { createError } from "../utils/errorHandler";

/**
 * Get dashboard analytics
 * GET /analytics/dashboard
 */
export const getDashboardAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const analytics = await analyticsService.getDashboardAnalytics();
    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get customer analytics
 * GET /analytics/customers/:userId
 */
export const getCustomerAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const analytics = await analyticsService.getCustomerAnalytics(userId);
    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get all customers with summary
 * GET /analytics/customers
 */
export const getAllCustomers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const customers = await analyticsService.getAllCustomers();
    res.status(200).json({
      success: true,
      data: customers,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get revenue analytics
 * GET /analytics/revenue
 */
export const getRevenueAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { days = 30 } = req.query;
    const analytics = await analyticsService.getRevenueAnalytics(Number(days));
    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get failed deliveries and returns
 * GET /analytics/failed-deliveries
 */
export const getFailedDeliveries = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const deliveries = await analyticsService.getFailedDeliveries();
    res.status(200).json({
      success: true,
      data: deliveries,
    });
  } catch (error: any) {
    next(error);
  }
};

