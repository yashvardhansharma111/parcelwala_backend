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
    const { pickup, drop, weight, pickupPincode, dropPincode, pickupCity, dropCity } = req.body;

    // Validate weight
    if (typeof weight !== "number" || weight <= 0) {
      throw createError("Weight must be a positive number", 400);
    }

    // Check if cities are provided and try to get city route pricing
    if (pickupCity && dropCity) {
      const { getCityRoute } = await import("../services/cityService");
      try {
        // getCityRoute now handles bidirectional matching internally
        const cityRoute = await getCityRoute(pickupCity.trim(), dropCity.trim());

        if (cityRoute) {
          console.log(`[Fare Calculation] Found city route: ${pickupCity} -> ${dropCity}, baseFare: ${cityRoute.baseFare}, heavyFare: ${cityRoute.heavyFare}, weight: ${weight}`);
          // Use city route pricing
          const gstPercent = cityRoute.gstPercent || 18;
          let baseFare: number;
          
          if (weight <= 3) {
            baseFare = cityRoute.baseFare;
          } else if (weight >= 5) {
            baseFare = cityRoute.heavyFare;
          } else {
            // Weight between 3 and 5 kg - use heavy fare (higher tier)
            baseFare = cityRoute.heavyFare;
          }
          
          const gst = Math.round((baseFare * gstPercent) / 100);
          const totalFare = baseFare + gst;
          
          // Apply coupon if provided
          let finalFare = totalFare;
          let discountAmount = 0;
          let couponApplied = undefined;
          
          if (req.body.couponCode) {
            const { validateCoupon } = await import("../services/couponService");
            try {
              const couponResult = await validateCoupon(req.body.couponCode, totalFare);
              if (couponResult.isValid && couponResult.coupon) {
                discountAmount = couponResult.discountAmount;
                finalFare = totalFare - discountAmount;
                couponApplied = {
                  code: couponResult.coupon.code,
                  discountAmount: discountAmount,
                };
              }
            } catch (error) {
              // Coupon validation failed, ignore
              console.error("Coupon validation error:", error);
            }
          }
          
          res.json({
            success: true,
            data: {
              distanceInKm: 0, // Not applicable for fixed route pricing
              baseFare,
              gst,
              totalFare,
              finalFare,
              discountAmount,
              couponApplied,
            },
          });
          return;
        }
      } catch (error) {
        console.error("Error getting city route:", error);
        // Fall through to standard pricing if city route not found
      }
    } else {
      console.log(`[Fare Calculation] No city route check - pickupCity: ${pickupCity}, dropCity: ${dropCity}`);
    }

    let distanceInKm: number;

    // Check if pincodes are provided and same - use 0-40km range (use 20km as average)
    if (pickupPincode && dropPincode && pickupPincode === dropPincode && pickupPincode.length === 6) {
      distanceInKm = 20; // Use middle of 0-40km range for same pincode
    } else if (pickup && drop && typeof pickup.lat === "number" && typeof pickup.lon === "number" && typeof drop.lat === "number" && typeof drop.lon === "number") {
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

      // Calculate distance from coordinates
      distanceInKm = calculateDistance(
        { lat: pickup.lat, lon: pickup.lon },
        { lat: drop.lat, lon: drop.lon }
      );
    } else {
      // If no coordinates and different pincodes, try to calculate from pincode
      // For now, use a default distance if pincodes are different
      // TODO: Implement pincode to coordinates lookup for accurate distance
      if (pickupPincode && dropPincode && pickupPincode !== dropPincode) {
        // Different pincodes - use a default distance (could be improved with pincode lookup)
        distanceInKm = 50; // Default distance for different pincodes
      } else {
        throw createError("Either coordinates or pincodes are required", 400);
      }
    }

    // Calculate fare using standard pricing
    const fareCalculation = await calculateFare(distanceInKm, weight);
    
    // Apply coupon if provided
    let finalFare = fareCalculation.totalFare;
    let discountAmount = 0;
    let couponApplied = undefined;
    
    if (req.body.couponCode) {
      const { validateCoupon } = await import("../services/couponService");
      try {
        const couponResult = await validateCoupon(req.body.couponCode, fareCalculation.totalFare);
        if (couponResult.isValid && couponResult.coupon) {
          discountAmount = couponResult.discountAmount;
          finalFare = fareCalculation.totalFare - discountAmount;
          couponApplied = {
            code: couponResult.coupon.code,
            discountAmount: discountAmount,
          };
        }
      } catch (error) {
        // Coupon validation failed, ignore
        console.error("Coupon validation error:", error);
      }
    }

    res.json({
      success: true,
      data: {
        ...fareCalculation,
        finalFare,
        discountAmount,
        couponApplied,
      },
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

