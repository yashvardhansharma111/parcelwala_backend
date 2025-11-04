/**
 * Payment Routes
 * Defines routes for payment operations
 */

import { Router } from "express";
import * as paymentController from "../controllers/paymentController";
import { authenticate } from "../middleware/authMiddleware";

const router = Router();

/**
 * Create payment page (requires authentication)
 * POST /payments/create
 */
router.post("/create", authenticate, paymentController.createPaymentPage);

/**
 * Check payment status (requires authentication)
 * POST /payments/status
 */
router.post("/status", authenticate, paymentController.checkPaymentStatus);

/**
 * Payment webhook/callback (public endpoint, no auth required)
 * POST /payments/webhook
 */
router.post("/webhook", paymentController.handleWebhook);

/**
 * Payment success redirect (public endpoint)
 * GET /payments/success
 */
router.get("/success", paymentController.paymentSuccess);

/**
 * Payment failed redirect (public endpoint)
 * GET /payments/failed
 */
router.get("/failed", paymentController.paymentFailed);

export default router;

