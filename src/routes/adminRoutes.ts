/**
 * Admin Routes
 * /admin endpoints
 */

import { Router } from "express";
import * as userController from "../controllers/userController";
import { authenticate } from "../middleware/authMiddleware";
import { requireRole } from "../middleware/roleMiddleware";

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireRole("admin"));

// Admin dashboard
router.get("/dashboard", userController.getAdminDashboard);

export default router;

