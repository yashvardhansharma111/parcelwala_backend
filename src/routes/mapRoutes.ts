/**
 * Map Routes
 * /map endpoints for address autocomplete, reverse geocoding, and fare calculation
 */

import { Router } from "express";
import * as mapController from "../controllers/mapController";
import { authenticate } from "../middleware/authMiddleware";
import { requireRole } from "../middleware/roleMiddleware";

const router = Router();

// Public endpoints (no auth required)
router.get("/autocomplete", mapController.getAutocomplete);
router.post("/details", mapController.getDetails);
router.post("/fare", mapController.calculateBookingFare);

// Admin-only endpoints
router.get("/admin/pricing", authenticate, requireRole("admin"), mapController.getPricing);
router.put("/admin/pricing", authenticate, requireRole("admin"), mapController.updatePricing);

export default router;

