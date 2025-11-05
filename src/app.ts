/**
 * Express App Setup
 * Configure Express application with middleware and routes
 */

// ✅ Load environment first
import "./config/env";

// ✅ Then import Firebase (depends on env)
import "./config/firebase";

import express, { Express } from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { errorHandler } from "./utils/errorHandler";
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import adminRoutes from "./routes/adminRoutes";
import bookingRoutes from "./routes/bookingRoutes";
import mapRoutes from "./routes/mapRoutes";
import paymentRoutes from "./routes/paymentRoutes";
import analyticsRoutes from "./routes/analyticsRoutes";

const app: Express = express();

// Middleware - CORS configuration for mobile apps
app.use(
  cors({
    origin: true, // Allow all origins (for development)
    credentials: false, // Set to false when using origin: "*" or origin: true
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Type"],
  })
);

// Handle preflight requests
app.options("*", cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/admin", adminRoutes);
app.use("/bookings", bookingRoutes);
app.use("/map", mapRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/analytics", analyticsRoutes);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { message: "Route not found" },
  });
});

// Global error handler
app.use(errorHandler);

export default app;
