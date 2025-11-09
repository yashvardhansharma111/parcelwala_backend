/**
 * City Service
 * Handles city management and city route pricing
 */

import * as admin from "firebase-admin";
import { db } from "../config/firebase";
import { createError } from "../utils/errorHandler";

export interface City {
  id: string;
  name: string;
  state?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CityRoute {
  id: string;
  fromCity: string;
  toCity: string;
  baseFare: number; // Base fare for weight <= 3kg
  heavyFare: number; // Fare for weight >= 5kg
  gstPercent: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new city
 */
export const createCity = async (cityData: {
  name: string;
  state?: string;
}): Promise<City> => {
  try {
    // Check if city already exists
    const existingCity = await db
      .collection("cities")
      .where("name", "==", cityData.name.trim())
      .limit(1)
      .get();

    if (!existingCity.empty) {
      throw createError("City already exists", 400);
    }

    const now = new Date();
    const cityRef = db.collection("cities").doc();
    
    const firestoreData: any = {
      name: cityData.name.trim(),
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (cityData.state !== undefined && cityData.state !== null) {
      firestoreData.state = cityData.state.trim();
    }

    await cityRef.set(firestoreData);

    return {
      id: cityRef.id,
      name: cityData.name.trim(),
      state: cityData.state?.trim(),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
  } catch (error: any) {
    console.error("Error creating city:", error);
    throw error;
  }
};

/**
 * Get all cities
 */
export const getAllCities = async (): Promise<City[]> => {
  try {
    let snapshot;
    try {
      // Try to use indexed query first
      snapshot = await db
        .collection("cities")
        .where("isActive", "==", true)
        .orderBy("name", "asc")
        .get();
    } catch (indexError: any) {
      // If index doesn't exist, fallback to fetching all and sorting in memory
      if (indexError.code === 9 || indexError.message?.includes("index")) {
        console.warn("[getAllCities] Composite index not found, using fallback query");
        const allSnapshot = await db.collection("cities").get();
        const cities = allSnapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name,
              state: data.state,
              isActive: data.isActive ?? true,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
            };
          })
          .filter((city) => city.isActive) // Filter active cities
          .sort((a, b) => a.name.localeCompare(b.name)); // Sort by name
        
        return cities;
      }
      throw indexError;
    }

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        state: data.state,
        isActive: data.isActive,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    });
  } catch (error: any) {
    console.error("Error getting cities:", error);
    throw createError("Failed to get cities", 500);
  }
};

/**
 * Update city
 */
export const updateCity = async (
  cityId: string,
  updates: Partial<{ name: string; state?: string; isActive: boolean }>
): Promise<City> => {
  try {
    const cityDoc = await db.collection("cities").doc(cityId).get();
    if (!cityDoc.exists) {
      throw createError("City not found", 404);
    }

    const updateData: any = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (updates.name !== undefined) updateData.name = updates.name.trim();
    if (updates.state !== undefined && updates.state !== null) {
      updateData.state = updates.state.trim();
    } else if (updates.state === null) {
      updateData.state = admin.firestore.FieldValue.delete();
    }
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

    await db.collection("cities").doc(cityId).update(updateData);

    const updated = await db.collection("cities").doc(cityId).get();
    const data = updated.data()!;
    return {
      id: updated.id,
      name: data.name,
      state: data.state,
      isActive: data.isActive,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  } catch (error: any) {
    console.error("Error updating city:", error);
    throw error;
  }
};

/**
 * Delete city (soft delete by setting isActive to false)
 */
export const deleteCity = async (cityId: string): Promise<void> => {
  try {
    await updateCity(cityId, { isActive: false });
  } catch (error: any) {
    console.error("Error deleting city:", error);
    throw error;
  }
};

/**
 * Create or update city route pricing
 */
export const upsertCityRoute = async (routeData: {
  fromCity: string;
  toCity: string;
  baseFare: number; // For weight <= 3kg
  heavyFare: number; // For weight >= 5kg
  gstPercent?: number;
}): Promise<CityRoute> => {
  try {
    // Normalize city names (case-insensitive)
    const fromCity = routeData.fromCity.trim();
    const toCity = routeData.toCity.trim();

    // Check if route already exists (bidirectional check)
    const existingRoute = await db
      .collection("city_routes")
      .where("fromCity", "==", fromCity)
      .where("toCity", "==", toCity)
      .limit(1)
      .get();

    const now = new Date();
    const firestoreData: any = {
      fromCity,
      toCity,
      baseFare: routeData.baseFare,
      heavyFare: routeData.heavyFare,
      gstPercent: routeData.gstPercent || 18,
      isActive: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (existingRoute.empty) {
      // Create new route
      const routeRef = db.collection("city_routes").doc();
      firestoreData.createdAt = admin.firestore.FieldValue.serverTimestamp();
      await routeRef.set(firestoreData);

      return {
        id: routeRef.id,
        fromCity,
        toCity,
        baseFare: routeData.baseFare,
        heavyFare: routeData.heavyFare,
        gstPercent: routeData.gstPercent || 18,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
    } else {
      // Update existing route
      const routeId = existingRoute.docs[0].id;
      await db.collection("city_routes").doc(routeId).update(firestoreData);

      const updated = await db.collection("city_routes").doc(routeId).get();
      const data = updated.data()!;
      return {
        id: updated.id,
        fromCity: data.fromCity,
        toCity: data.toCity,
        baseFare: data.baseFare,
        heavyFare: data.heavyFare,
        gstPercent: data.gstPercent,
        isActive: data.isActive,
        createdAt: data.createdAt?.toDate() || now,
        updatedAt: data.updatedAt?.toDate() || now,
      };
    }
  } catch (error: any) {
    console.error("Error upserting city route:", error);
    throw createError("Failed to create/update city route", 500);
  }
};

/**
 * Get city route pricing
 */
export const getCityRoute = async (
  fromCity: string,
  toCity: string
): Promise<CityRoute | null> => {
  try {
    // Normalize city names (case-insensitive, trimmed)
    const fromCityNorm = fromCity.trim().toLowerCase();
    const toCityNorm = toCity.trim().toLowerCase();

    // Get all active routes and filter in memory for case-insensitive matching
    // This is necessary because Firestore queries are case-sensitive
    const snapshot = await db
      .collection("city_routes")
      .where("isActive", "==", true)
      .get();

    if (snapshot.empty) {
      return null;
    }

    // Find matching route (case-insensitive, bidirectional)
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const storedFromCity = (data.fromCity || "").trim().toLowerCase();
      const storedToCity = (data.toCity || "").trim().toLowerCase();

      // Check both directions
      if (
        (storedFromCity === fromCityNorm && storedToCity === toCityNorm) ||
        (storedFromCity === toCityNorm && storedToCity === fromCityNorm)
      ) {
        console.log(`[getCityRoute] Match found: "${data.fromCity}" -> "${data.toCity}" (normalized: "${storedFromCity}" -> "${storedToCity}")`);
        return {
          id: doc.id,
          fromCity: data.fromCity,
          toCity: data.toCity,
          baseFare: data.baseFare,
          heavyFare: data.heavyFare,
          gstPercent: data.gstPercent,
          isActive: data.isActive,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      }
    }

    console.log(`[getCityRoute] No route found for: "${fromCity}" -> "${toCity}" (normalized: "${fromCityNorm}" -> "${toCityNorm}")`);
    console.log(`[getCityRoute] Available routes: ${snapshot.docs.map(doc => {
      const routeData = doc.data();
      return `"${routeData.fromCity}" -> "${routeData.toCity}"`;
    }).join(", ")}`);
    return null;
  } catch (error: any) {
    console.error("Error getting city route:", error);
    throw createError("Failed to get city route", 500);
  }
};

/**
 * Get all city routes
 */
export const getAllCityRoutes = async (): Promise<CityRoute[]> => {
  try {
    const snapshot = await db
      .collection("city_routes")
      .where("isActive", "==", true)
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        fromCity: data.fromCity,
        toCity: data.toCity,
        baseFare: data.baseFare,
        heavyFare: data.heavyFare,
        gstPercent: data.gstPercent,
        isActive: data.isActive,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    });
  } catch (error: any) {
    console.error("Error getting city routes:", error);
    throw createError("Failed to get city routes", 500);
  }
};

/**
 * Delete city route
 */
export const deleteCityRoute = async (routeId: string): Promise<void> => {
  try {
    await db.collection("city_routes").doc(routeId).update({
      isActive: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error: any) {
    console.error("Error deleting city route:", error);
    throw createError("Failed to delete city route", 500);
  }
};

