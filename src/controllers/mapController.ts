/**
 * Map Controller
 * Handles address autocomplete, reverse geocoding, and fare calculation
 */

import { Request, Response, NextFunction } from "express";
import { getAutocompleteSuggestions } from "../services/photonService";
import { getAddressDetails } from "../services/nominatimService";
import { calculateDistance } from "../services/distanceService";
import { calculateFare, getPricingSettings, updatePricingSettings } from "../services/pricingService";
import { createError } from "../utils/errorHandler";

/**
 * Get address autocomplete suggestions
 * GET /map/autocomplete?q=<query>
 */
export const getAutocomplete = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { q, limit } = req.query;

    if (!q || typeof q !== "string") {
      throw createError("Query parameter 'q' is required", 400);
    }

    const limitNum = limit ? parseInt(limit as string, 10) : 5;
    const suggestions = await getAutocompleteSuggestions(q, limitNum);

    res.json({
      success: true,
      data: { suggestions },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get full address details from coordinates
 * POST /map/details
 */
export const getDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { lat, lon } = req.body;

    if (typeof lat !== "number" || typeof lon !== "number") {
      throw createError("Latitude and longitude must be numbers", 400);
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw createError("Invalid coordinates", 400);
    }

    const addressDetails = await getAddressDetails(lat, lon);

    res.json({
      success: true,
      data: { address: addressDetails },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Calculate fare based on pickup/drop locations and weight
 * POST /map/fare
 */
export const calculateBookingFare = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { pickup, drop, weight } = req.body;

    // Validate pickup coordinates
    if (
      !pickup ||
      typeof pickup.lat !== "number" ||
      typeof pickup.lon !== "number"
    ) {
      throw createError("Pickup coordinates (lat, lon) are required", 400);
    }

    // Validate drop coordinates
    if (
      !drop ||
      typeof drop.lat !== "number" ||
      typeof drop.lon !== "number"
    ) {
      throw createError("Drop coordinates (lat, lon) are required", 400);
    }

    // Validate weight
    if (typeof weight !== "number" || weight <= 0) {
      throw createError("Weight must be a positive number", 400);
    }

    // Validate coordinate ranges
    if (
      pickup.lat < -90 ||
      pickup.lat > 90 ||
      pickup.lon < -180 ||
      pickup.lon > 180
    ) {
      throw createError("Invalid pickup coordinates", 400);
    }

    if (
      drop.lat < -90 ||
      drop.lat > 90 ||
      drop.lon < -180 ||
      drop.lon > 180
    ) {
      throw createError("Invalid drop coordinates", 400);
    }

    // Calculate distance
    const distanceInKm = calculateDistance(
      { lat: pickup.lat, lon: pickup.lon },
      { lat: drop.lat, lon: drop.lon }
    );

    // Calculate fare
    const fareCalculation = await calculateFare(distanceInKm, weight);

    res.json({
      success: true,
      data: fareCalculation,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Get current pricing settings (Admin only)
 * GET /admin/pricing
 */
export const getPricing = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const settings = await getPricingSettings();

    res.json({
      success: true,
      data: { pricing: settings },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Update pricing settings (Admin only)
 * PUT /admin/pricing
 */
export const updatePricing = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { baseRates, gstPercent } = req.body;

    // Validate baseRates
    if (baseRates && Array.isArray(baseRates)) {
      for (const rate of baseRates) {
        if (
          typeof rate.minKm !== "number" ||
          typeof rate.maxKm !== "number" ||
          typeof rate.maxWeight !== "number" ||
          typeof rate.fare !== "number"
        ) {
          throw createError(
            "Invalid baseRate structure. Each rate must have minKm, maxKm, maxWeight, and fare as numbers",
            400
          );
        }

        if (rate.minKm < 0 || rate.maxKm < rate.minKm || rate.maxWeight <= 0 || rate.fare < 0) {
          throw createError("Invalid rate values", 400);
        }

        // applyGst is optional boolean
        if (rate.applyGst !== undefined && typeof rate.applyGst !== "boolean") {
          throw createError("applyGst must be a boolean if provided", 400);
        }
      }
    }

    // Validate GST percent
    if (gstPercent !== undefined) {
      if (typeof gstPercent !== "number" || gstPercent < 0 || gstPercent > 100) {
        throw createError("GST percent must be between 0 and 100", 400);
      }
    }

    const updateData: any = {};
    if (baseRates) updateData.baseRates = baseRates;
    if (gstPercent !== undefined) updateData.gstPercent = gstPercent;

    await updatePricingSettings(updateData);

    const updatedSettings = await getPricingSettings();

    res.json({
      success: true,
      data: { pricing: updatedSettings },
      message: "Pricing settings updated successfully",
    });
  } catch (error: any) {
    next(error);
  }
};

