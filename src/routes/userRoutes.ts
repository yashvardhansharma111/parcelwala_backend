/**
 * User Routes
 * /user endpoints
 */

import { Router } from "express";
import * as userController from "../controllers/userController";
import { authenticate } from "../middleware/authMiddleware";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get user profile
router.get("/profile", userController.getProfile);

// Save FCM token for push notifications
router.post("/fcm-token", userController.saveFCMTokenEndpoint);

export default router;

