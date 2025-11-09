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

// Save FCM Token for push notifications
router.post("/fcm-token", userController.saveFCMTokenEndpoint);

// Save OneSignal Player ID for push notifications
router.post("/onesignal-player-id", userController.saveOneSignalPlayerIdEndpoint);

export default router;

