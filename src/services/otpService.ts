/**
 * OTP Service
 * Handles OTP generation and sending via Renflair SMS API
 * Documentation: https://renflair.in/sms.php
 * 
 * ============================================================================
 * QUICK SWITCH BETWEEN DEV AND PROD MODE
 * ============================================================================
 * 
 * METHOD 1 (Recommended): Use environment variable
 *   - Add to .env: OTP_DEV_MODE=true  (for development - logs to console)
 *   - Add to .env: OTP_DEV_MODE=false (for production - sends real SMS)
 * 
 * METHOD 2: Use NODE_ENV
 *   - Set NODE_ENV=development (dev mode - logs to console)
 *   - Set NODE_ENV=production  (prod mode - sends real SMS)
 * 
 * METHOD 3: Force mode in code (see sendOTP function below)
 *   - Uncomment: const OTP_DEV_MODE = true;  (force dev mode)
 *   - Uncomment: const OTP_DEV_MODE = false; (force prod mode)
 * 
 * METHOD 4: Comment out production SMS code block
 *   - Comment out the entire "PRODUCTION SMS CODE" section in sendOTP()
 * 
 * ============================================================================
 */

import axios from "axios";
import { ENV } from "../config/env";
import { generateOTP } from "../utils/generateOTP";
import { cacheService } from "./cacheService";
import { createError } from "../utils/errorHandler";

/**
 * Extract 10-digit phone number from various formats
 * Handles: +91XXXXXXXXXX, 91XXXXXXXXXX, XXXXXXXXXX
 */
const extractPhoneNumber = (phoneNumber: string): string => {
  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, "");
  
  // If starts with 91, remove it (country code)
  if (digits.startsWith("91") && digits.length === 12) {
    return digits.slice(2);
  }
  
  // If 10 digits, return as is
  if (digits.length === 10) {
    return digits;
  }
  
  // If more than 10 digits, take last 10
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  
  throw createError("Invalid phone number format", 400);
};

/**
 * Normalize phone number to consistent format for cache key
 * Always returns +91XXXXXXXXXX format
 */
const normalizePhoneNumber = (phoneNumber: string): string => {
  // Remove all non-digit characters
  const digits = phoneNumber.replace(/\D/g, "");
  
  // Extract 10-digit number
  let phoneDigits: string;
  if (digits.startsWith("91") && digits.length === 12) {
    phoneDigits = digits.slice(2);
  } else if (digits.length === 10) {
    phoneDigits = digits;
  } else if (digits.length > 10) {
    phoneDigits = digits.slice(-10);
  } else {
    throw createError("Invalid phone number format", 400);
  }
  
  // Return normalized format: +91XXXXXXXXXX
  return `+91${phoneDigits}`;
};

/**
 * Send OTP via Renflair SMS API
 * 
 * ============================================================================
 * DEVELOPMENT vs PRODUCTION MODE
 * ============================================================================
 * 
 * To switch between dev and prod modes, modify the OTP_DEV_MODE check below:
 * 
 * DEVELOPMENT MODE (Logs OTP to console - no real SMS sent):
 *   - Set OTP_DEV_MODE = true in .env OR
 *   - Set NODE_ENV = "development" OR
 *   - Comment out the production SMS code block
 * 
 * PRODUCTION MODE (Sends real SMS via Renflair API):
 *   - Set OTP_DEV_MODE = false in .env AND
 *   - Set NODE_ENV = "production" AND
 *   - Ensure RENFLAIR_API_KEY is set in .env
 * 
 * ============================================================================
 * 
 * API Endpoint: https://sms.renflair.in/V1.php
 * Format: https://sms.renflair.in/V1.php?API={API_KEY}&PHONE={PHONE}&OTP={OTP}
 * Message format: "{OTP} is your verification code for {domain.com}"
 */
export const sendOTP = async (phoneNumber: string): Promise<void> => {
  try {
    // Generate 6-digit OTP
    const otp = generateOTP();

    // Normalize phone number for consistent cache key
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // Store OTP in cache for 10 minutes (use normalized phone as key)
    cacheService.setOTP(normalizedPhone, otp, 600);

    // Extract 10-digit phone number (without country code)
    const phone = extractPhoneNumber(phoneNumber);

    // ============================================================================
    // DEVELOPMENT MODE CHECK - Switch between dev and prod here
    // ============================================================================
    // Option 1: Use OTP_DEV_MODE environment variable (recommended)
    // Set OTP_DEV_MODE=true in .env for development, false for production
    const OTP_DEV_MODE = process.env.OTP_DEV_MODE === "true" || ENV.NODE_ENV === "development";
    
    // Option 2: Force dev mode by uncommenting the line below (overrides env)
    // const OTP_DEV_MODE = true; // <-- Uncomment this line to force dev mode
    
    // Option 3: Force prod mode by uncommenting the line below (overrides env)
    // const OTP_DEV_MODE = false; // <-- Uncomment this line to force prod mode
    
    // ============================================================================
    // DEVELOPMENT MODE: Log OTP to console (no real SMS sent)
    // ============================================================================
    // To enable dev mode: Set OTP_DEV_MODE=true in .env OR uncomment the force line above
    if (OTP_DEV_MODE) {
      console.log("=".repeat(60));
      console.log("🔧 DEVELOPMENT MODE - OTP NOT SENT VIA SMS");
      console.log("=".repeat(60));
      console.log(`📱 Phone Number: ${normalizedPhone}`);
      console.log(`🔐 OTP Code: ${otp}`);
      console.log(`⏰ Valid for: 10 minutes`);
      console.log("=".repeat(60));
      console.log(`✅ OTP generated and stored in cache with key: ${normalizedPhone}`);
      console.log(`💡 To enable real SMS (production mode):`);
      console.log(`   1. Set OTP_DEV_MODE=false in .env`);
      console.log(`   2. Set RENFLAIR_API_KEY=your_api_key in .env`);
      console.log(`   3. Set NODE_ENV=production in .env`);
      console.log("=".repeat(60));
      return; // Exit early - no SMS sent in dev mode
    }

    // ============================================================================
    // PRODUCTION MODE: Send real SMS via Renflair API
    // ============================================================================
    // To enable prod mode: Set OTP_DEV_MODE=false in .env AND ensure RENFLAIR_API_KEY is set
    
    // Validate API key is configured for production
    const hasApiKey = ENV.RENFLAIR_API_KEY && ENV.RENFLAIR_API_KEY.trim() !== "";
    if (!hasApiKey) {
      console.warn("⚠️  WARNING: RENFLAIR_API_KEY not configured. Falling back to dev mode (logging only).");
      console.log("=".repeat(60));
      console.log("🔧 FALLBACK TO DEVELOPMENT MODE - OTP NOT SENT VIA SMS");
      console.log("=".repeat(60));
      console.log(`📱 Phone Number: ${normalizedPhone}`);
      console.log(`🔐 OTP Code: ${otp}`);
      console.log(`⏰ Valid for: 10 minutes`);
      console.log("=".repeat(60));
      console.log(`💡 To enable real SMS, set RENFLAIR_API_KEY in your .env file`);
      console.log("=".repeat(60));
      return;
    }

    // ============================================================================
    // PRODUCTION SMS CODE - Comment out this entire block to disable SMS sending
    // ============================================================================
    // To disable SMS sending (dev mode), comment out from here to the end of the try block
    // OR set OTP_DEV_MODE=true in .env (recommended method above)
    
    // Renflair API endpoint for OTP
    const apiUrl = "https://sms.renflair.in/V1.php";
    
    // Build query parameters
    const params = new URLSearchParams({
      API: ENV.RENFLAIR_API_KEY,
      PHONE: phone,
      OTP: otp,
    });

    const fullUrl = `${apiUrl}?${params.toString()}`;

    console.log(`📤 Sending OTP to ${phone} via Renflair API...`);
    
    // Send SMS via Renflair API (GET request)
    const response = await axios.get(fullUrl, {
      timeout: 10000, // 10 second timeout
    });
    
    // ============================================================================
    // End of Production SMS Code
    // ============================================================================

    // Log response for debugging
    console.log("Renflair API Response:", {
      status: response.status,
      data: response.data,
    });

    // Check if SMS was sent successfully
    // Renflair API typically returns JSON with status
    if (response.status !== 200) {
      throw createError("Failed to send OTP via SMS", 500);
    }

    // Check response data for success/failure indicators
    const responseData = response.data;
    if (typeof responseData === "object") {
      // If response has error or failure status
      if (responseData.error || responseData.status === "error" || responseData.status === false) {
        console.error("Renflair API Error:", responseData);
        throw createError(responseData.message || "Failed to send OTP via SMS", 500);
      }
    }

    console.log(`✅ OTP sent successfully to ${phone} via SMS`);
    console.log(`📝 OTP stored in cache with key: ${normalizedPhone}`);
  } catch (error: any) {
    console.error("Error sending OTP:", error);
    
    // Handle specific error cases
    if (error.response?.data) {
      console.error("Renflair API Error Response:", error.response.data);
      throw createError(
        error.response.data.message || "Failed to send OTP. Please try again.",
        500
      );
    }
    
    if (error.code === "ECONNABORTED") {
      throw createError("Request timeout. Please check your internet connection.", 500);
    }
    
    // Don't expose internal error details to client
    throw createError("Failed to send OTP. Please try again.", 500);
  }
};

/**
 * Verify OTP
 */
export const verifyOTP = (phoneNumber: string, otp: string): boolean => {
  try {
    // Normalize phone number to match the key used when storing OTP
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    
    const storedOTP = cacheService.getOTP(normalizedPhone);

    if (!storedOTP) {
      console.log(`OTP not found for ${normalizedPhone}. Available keys:`, cacheService.getAllKeys?.() || "N/A");
      return false; // OTP not found or expired
    }

    if (storedOTP !== otp) {
      console.log(`OTP mismatch for ${normalizedPhone}. Expected: ${storedOTP}, Received: ${otp}`);
      return false; // OTP mismatch
    }

    // OTP is valid, delete it from cache (one-time use)
    cacheService.deleteOTP(normalizedPhone);

    return true;
  } catch (error: any) {
    console.error("Error verifying OTP:", error);
    return false;
  }
};

