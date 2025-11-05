/**
 * Analytics Routes
 * /analytics endpoints
 */

import { Router } from "express";
import * as analyticsController from "../controllers/analyticsController";
import { authenticate } from "../middleware/authMiddleware";
import { requireRole } from "../middleware/roleMiddleware";

const router = Router();

// All analytics routes require admin authentication
router.use(authenticate);
router.use(requireRole("admin"));

// Dashboard analytics
router.get("/dashboard", analyticsController.getDashboardAnalytics);

// Revenue analytics
router.get("/revenue", analyticsController.getRevenueAnalytics);

// Customer analytics
router.get("/customers", analyticsController.getAllCustomers);
router.get("/customers/:userId", analyticsController.getCustomerAnalytics);

// Failed deliveries
router.get("/failed-deliveries", analyticsController.getFailedDeliveries);

export default router;

