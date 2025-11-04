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

export default router;

