/**
 * Authentication Routes
 * /auth endpoints
 */

import { Router } from "express";
import * as authController from "../controllers/authController";

const router = Router();

// Send OTP
router.post("/send-otp", authController.sendOtp);

// Verify OTP
router.post("/verify-otp", authController.verifyOtp);

// Refresh token
router.post("/refresh", authController.refresh);

// Logout
router.post("/logout", authController.logout);

export default router;

