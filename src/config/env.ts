/**
 * Environment Variable Loader
 * Loads .env and provides a centralized ENV object
 */

import dotenv from "dotenv";
dotenv.config();

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 8080,

  // Firebase
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || "",
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || "",
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY || "",

  // Renflair SMS
  RENFLAIR_API_KEY: process.env.RENFLAIR_API_KEY || "",
  RENFLAIR_API_URL: process.env.RENFLAIR_API_URL || "https://sms.renflair.in/V1.php",

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || "",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "",
  ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || "15m",
  REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || "7d",

  // Admin
  ADMIN_PHONE_NUMBER: process.env.ADMIN_PHONE_NUMBER || "+911234567890",

  // Paygic Payment Gateway
  PAYGIC_MID: process.env.PAYGIC_MID || "",
  PAYGIC_TOKEN: process.env.PAYGIC_TOKEN || "",
  PAYGIC_BASE_URL: process.env.PAYGIC_BASE_URL || "https://server.paygic.in/api/v2",
  PAYGIC_SUCCESS_URL: process.env.PAYGIC_SUCCESS_URL || "",
  PAYGIC_FAILED_URL: process.env.PAYGIC_FAILED_URL || "",
};

console.log(`✅ Environment loaded for: ${ENV.NODE_ENV}`);
