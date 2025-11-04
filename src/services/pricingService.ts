/**
 * Pricing Service
 * Calculate fare based on distance, weight, and pricing rules from Firestore
 */

import { db } from "../config/firebase";
import * as admin from "firebase-admin";

interface BaseRate {
  minKm: number;
  maxKm: number;
  maxWeight: number; // in kg
  fare: number; // base fare in INR
  applyGst?: boolean; // whether to apply GST to this tier (default: true for tier 2+, false for tier 1)
}

interface PricingSettings {
  baseRates: BaseRate[];
  gstPercent: number;
  updatedAt?: admin.firestore.Timestamp;
}

interface FareCalculation {
  distanceInKm: number;
  baseFare: number;
  gst: number;
  totalFare: number;
}

// Default pricing (fallback if Firestore doesn't have settings)
// Tier 1: 0-40KM, <3KG = ₹50 (no GST)
// Tier 2: 41-60KM, <5KG = ₹70 + 18% GST
const DEFAULT_PRICING: PricingSettings = {
  baseRates: [
    { minKm: 0, maxKm: 40, maxWeight: 3, fare: 50, applyGst: false },
    { minKm: 41, maxKm: 60, maxWeight: 5, fare: 70, applyGst: true },
  ],
  gstPercent: 18,
};

/**
 * Get pricing settings from Firestore
 * Falls back to default if not found
 */
export const getPricingSettings = async (): Promise<PricingSettings> => {
  try {
    const pricingDoc = await db.collection("settings").doc("pricing").get();

    if (!pricingDoc.exists) {
      console.log("No pricing settings in Firestore, using defaults");
      // Optionally create default settings in Firestore
      await db.collection("settings").doc("pricing").set(DEFAULT_PRICING);
      return DEFAULT_PRICING;
    }

    const data = pricingDoc.data() as PricingSettings;
    return {
      baseRates: data.baseRates || DEFAULT_PRICING.baseRates,
      gstPercent: data.gstPercent ?? DEFAULT_PRICING.gstPercent,
      updatedAt: data.updatedAt,
    };
  } catch (error: any) {
    console.error("Error fetching pricing settings:", error.message);
    console.log("Using default pricing settings");
    return DEFAULT_PRICING;
  }
};

/**
 * Update pricing settings in Firestore (Admin only)
 */
export const updatePricingSettings = async (
  settings: Partial<PricingSettings>
): Promise<void> => {
  try {
    const updateData: any = {
      ...settings,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("settings").doc("pricing").set(updateData, {
      merge: true,
    });
  } catch (error: any) {
    console.error("Error updating pricing settings:", error.message);
    throw new Error("Failed to update pricing settings");
  }
};

/**
 * Calculate fare based on distance, weight, and pricing rules
 */
export const calculateFare = async (
  distanceInKm: number,
  weightInKg: number
): Promise<FareCalculation> => {
  try {
    // Get pricing settings from Firestore
    const pricingSettings = await getPricingSettings();

    // Find matching rate based on distance and weight
    let baseFare = 0;
    let applyGst = false;
    let rateFound = false;

    for (const rate of pricingSettings.baseRates) {
      if (
        distanceInKm >= rate.minKm &&
        distanceInKm <= rate.maxKm &&
        weightInKg <= rate.maxWeight
      ) {
        baseFare = rate.fare;
        applyGst = rate.applyGst ?? true; // Default to true for backward compatibility, but tier 1 should be false
        rateFound = true;
        break;
      }
    }

    // If no matching rate found, use the highest rate as fallback
    if (!rateFound && pricingSettings.baseRates.length > 0) {
      const highestRate = pricingSettings.baseRates.reduce((prev, current) =>
        prev.fare > current.fare ? prev : current
      );
      baseFare = highestRate.fare;
      applyGst = highestRate.applyGst ?? true;
    }

    // If still no fare, use default minimum
    if (baseFare === 0) {
      baseFare = 50; // Minimum fare
      applyGst = false; // No GST on minimum fare
    }

    // Calculate GST (only if applicable for this tier)
    let gst = 0;
    if (applyGst) {
      const gstPercent = pricingSettings.gstPercent || 18;
      gst = Math.round((baseFare * gstPercent) / 100);
    }

    // Calculate total fare
    const totalFare = baseFare + gst;

    return {
      distanceInKm: Math.round(distanceInKm * 100) / 100, // Round to 2 decimal places
      baseFare,
      gst,
      totalFare,
    };
  } catch (error: any) {
    console.error("Error calculating fare:", error.message);
    throw new Error("Failed to calculate fare");
  }
};

