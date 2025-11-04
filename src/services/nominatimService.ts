/**
 * Nominatim Service
 * Reverse geocoding to get full address details from coordinates
 * https://nominatim.org/release-docs/latest/api/Reverse/
 */

import axios from "axios";
import { cacheService } from "./cacheService";

interface NominatimAddress {
  house_number?: string;
  road?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
}

interface NominatimResult {
  place_id: number;
  licence: string;
  powered_by: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address: NominatimAddress;
  boundingbox: [string, string, string, string];
}

interface AddressDetails {
  name: string;
  houseNumber?: string;
  street?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  coordinates: {
    lat: number;
    lon: number;
  };
}

/**
 * Get full address details from coordinates using Nominatim reverse geocoding
 */
export const getAddressDetails = async (
  lat: number,
  lon: number
): Promise<AddressDetails> => {
  try {
    // Check cache first (5 min TTL)
    const cacheKey = `nominatim:${lat}:${lon}`;
    const cached = cacheService.get<AddressDetails>(cacheKey);
    if (cached) {
      return cached;
    }

    // Nominatim API endpoint (with proper User-Agent header as per their policy)
    const url = "https://nominatim.openstreetmap.org/reverse";
    const params = {
      lat: lat.toString(),
      lon: lon.toString(),
      format: "json",
      addressdetails: "1",
    };

    const response = await axios.get<NominatimResult>(url, {
      params,
      headers: {
        "User-Agent": "ParcelBookingSystem/1.0", // Required by Nominatim
      },
    });

    if (!response.data || !response.data.address) {
      throw new Error("No address found for coordinates");
    }

    const addr = response.data.address;

    // Extract city (can be city, town, or village)
    const city = addr.city || addr.town || addr.village || addr.suburb || "";

    // Extract state
    const state = addr.state || "";

    // Extract postcode
    const pincode = addr.postcode || "";

    // Extract house number and street separately
    const houseNumber = addr.house_number || undefined;
    const street = addr.road || undefined;

    // Build full address string (for backward compatibility)
    const addressParts: string[] = [];
    if (houseNumber) addressParts.push(houseNumber);
    if (street) addressParts.push(street);
    if (addr.suburb && addr.suburb !== city) addressParts.push(addr.suburb);

    const address = addressParts.join(", ") || city || "Address not available";

    // Build name (use road or city)
    const name = street || city || "Location";

    const addressDetails: AddressDetails = {
      name,
      houseNumber,
      street,
      address,
      city,
      state,
      pincode,
      landmark: addr.suburb || undefined,
      coordinates: {
        lat: parseFloat(response.data.lat),
        lon: parseFloat(response.data.lon),
      },
    };

    // Cache the results
    cacheService.set(cacheKey, addressDetails, 300); // 5 minutes

    return addressDetails;
  } catch (error: any) {
    console.error("Error fetching Nominatim address details:", error.message);
    throw new Error("Failed to fetch address details");
  }
};

