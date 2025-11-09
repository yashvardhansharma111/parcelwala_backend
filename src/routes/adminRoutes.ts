/**
 * Admin Routes
 * /admin endpoints
 */

import { Router } from "express";
import * as userController from "../controllers/userController";
import * as adminController from "../controllers/adminController";
import * as notificationController from "../controllers/notificationController";
import * as cityController from "../controllers/cityController";
import { authenticate } from "../middleware/authMiddleware";
import { requireRole, requireSuperAdmin } from "../middleware/roleMiddleware";

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireRole("admin"));

// Admin dashboard (accessible by both super admin and co-admins)
router.get("/dashboard", userController.getAdminDashboard);

// Co-admin management (Super admin only - from .env ADMIN_PHONE_NUMBER)
router.post("/co-admins", requireSuperAdmin, adminController.appointCoAdmin);
router.get("/co-admins", requireSuperAdmin, adminController.getAllCoAdmins);
router.delete("/co-admins/:id", requireSuperAdmin, adminController.removeCoAdmin);

// Notification management (Super admin only)
router.post("/notifications/broadcast", requireSuperAdmin, notificationController.broadcastNotification);
router.post("/notifications/send", requireSuperAdmin, notificationController.sendNotificationToUser);

// City management (Super admin only)
router.post("/cities", requireSuperAdmin, cityController.createCity);
router.get("/cities", cityController.getAllCities);
router.put("/cities/:id", requireSuperAdmin, cityController.updateCity);
router.delete("/cities/:id", requireSuperAdmin, cityController.deleteCity);

// City route pricing (Super admin only)
router.post("/cities/routes", requireSuperAdmin, cityController.upsertCityRoute);
router.get("/cities/routes", cityController.getAllCityRoutes);
router.delete("/cities/routes/:id", requireSuperAdmin, cityController.deleteCityRoute);

export default router;

