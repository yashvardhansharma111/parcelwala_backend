/**
 * Photon Service
 * Fast address autocomplete using Photon API + Static Ratlam Addresses
 * https://photon.komoot.io/
 */

import axios from "axios";
import { cacheService } from "./cacheService";
import * as fs from "fs";
import * as path from "path";

interface PhotonFeature {
  geometry: {
    coordinates: [number, number]; // [lon, lat]
    type: string;
  };
  properties: {
    name: string;
    country?: string;
    state?: string;
    city?: string;
    postcode?: string;
    street?: string;
    road?: string;
    housenumber?: string;
    osm_key?: string;
    osm_value?: string;
  };
  type: string;
}

interface PhotonResponse {
  features: PhotonFeature[];
}

interface AutocompleteSuggestion {
  displayName: string;
  coordinates: {
    lat: number;
    lon: number;
  };
  address: {
    name: string;
    street?: string;
    houseNumber?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  source?: "static" | "photon" | "nominatim"; // Track data source
}

interface StaticAddress {
  city: string;
  address: string;
  addressType: string;
  title: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  placeIdProvider?: string;
}

/**
 * Load static Ratlam addresses from JSON file
 */
const loadStaticAddresses = (): StaticAddress[] => {
  try {
    // Try multiple paths for different deployment environments
    const possiblePaths = [
      path.join(__dirname, "../../data/ratlam-addresses.json"), // Local development
      path.join(process.cwd(), "data/ratlam-addresses.json"), // Vercel/serverless
      path.join(process.cwd(), "backend/data/ratlam-addresses.json"), // Monorepo
      path.join(__dirname, "../data/ratlam-addresses.json"), // Compiled dist
    ];

    for (const filePath of possiblePaths) {
      try {
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, "utf-8");
          return JSON.parse(fileContent) as StaticAddress[];
        }
      } catch (err) {
        // Continue to next path
      }
    }

    console.warn("Static addresses file not found. Using Photon API only.");
    return [];
  } catch (error: any) {
    console.error("Error loading static addresses:", error.message);
    return [];
  }
};

/**
 * Search static addresses by query
 */
const searchStaticAddresses = (
  query: string,
  staticAddresses: StaticAddress[],
  limit: number = 5
): AutocompleteSuggestion[] => {
  if (!query || query.trim().length === 0) {
    return staticAddresses.slice(0, limit).map((addr) => ({
      displayName: addr.address,
      coordinates: { lat: addr.latitude, lon: addr.longitude },
      address: {
        name: addr.title || addr.address.split(",")[0] || "",
        city: addr.city,
        state: "Madhya Pradesh",
        postcode: "457001",
      },
      source: "static",
    }));
  }

  const queryLower = query.toLowerCase().trim();
  const matches: { address: StaticAddress; score: number }[] = [];

  for (const addr of staticAddresses) {
    let score = 0;
    const titleLower = (addr.title || "").toLowerCase();
    const addressLower = addr.address.toLowerCase();

    // Exact title match
    if (titleLower.includes(queryLower)) {
      score += 100;
    } else if (titleLower.startsWith(queryLower)) {
      score += 80;
    }

    // Address match
    if (addressLower.includes(queryLower)) {
      score += 50;
    }

    // Partial word match
    const queryWords = queryLower.split(/\s+/);
    queryWords.forEach((word) => {
      if (titleLower.includes(word)) score += 20;
      if (addressLower.includes(word)) score += 10;
    });

    if (score > 0) {
      matches.push({ address: addr, score });
    }
  }

  // Sort by score (highest first) and return top matches
  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((match) => ({
      displayName: match.address.address,
      coordinates: {
        lat: match.address.latitude,
        lon: match.address.longitude,
      },
      address: {
        name: match.address.title || match.address.address.split(",")[0] || "",
        city: match.address.city,
        state: "Madhya Pradesh",
        postcode: "457001",
      },
      source: "static",
    }));
};

/**
 * Get address autocomplete suggestions from Static Data + Photon API
 */
export const getAutocompleteSuggestions = async (
  query: string,
  limit: number = 5
): Promise<AutocompleteSuggestion[]> => {
  try {
    // Check cache first (5 min TTL)
    const cacheKey = `photon:${query}:${limit}`;
    const cached = cacheService.get<AutocompleteSuggestion[]>(cacheKey);
    if (cached) {
      return cached;
    }

    if (!query || query.trim().length === 0) {
      // Return top static addresses if no query
      const staticAddresses = loadStaticAddresses();
      return searchStaticAddresses("", staticAddresses, limit);
    }

    // Load static addresses
    const staticAddresses = loadStaticAddresses();
    const staticResults = searchStaticAddresses(query, staticAddresses, limit);

    // Combine results: static first (priority), then Photon
    const allResults: AutocompleteSuggestion[] = [...staticResults];

    // Only fetch from Photon if we need more results
    const remainingLimit = limit - staticResults.length;
    let photonResults: AutocompleteSuggestion[] = [];

    if (remainingLimit > 0) {
      try {
        // Append "Ratlam" to query to prioritize Ratlam addresses
        const queryWithCity = `${query.trim()} Ratlam`;

        // Ratlam coordinates (approximate center)
        const ratlamLat = 23.3315;
        const ratlamLon = 75.0369;

        // Photon API endpoint
        const url = `https://photon.komoot.io/api/`;
        const params: any = {
          q: queryWithCity,
          limit: (remainingLimit * 3).toString(), // Get more results to filter from
          lang: "en",
          lat: ratlamLat.toString(), // Location bias: prioritize results near Ratlam
          lon: ratlamLon.toString(),
        };

        const response = await axios.get<PhotonResponse>(url, { params });

        if (response.data && response.data.features) {
          // Transform Photon response to our format and filter for Ratlam only
          photonResults = response.data.features
            .filter((feature) => {
              // Only include features with coordinates
              if (!feature.geometry?.coordinates) return false;
              
              // Filter: Only include addresses in Ratlam (strict filtering)
              const city = feature.properties.city?.toLowerCase() || "";
              const state = feature.properties.state?.toLowerCase() || "";
              const name = feature.properties.name?.toLowerCase() || "";
              const postcode = feature.properties.postcode || "";
              
              // Check if explicitly mentions "ratlam" in city, state, or name
              const hasRatlam = 
                city.includes("ratlam") || 
                state.includes("ratlam") ||
                name.includes("ratlam");
              
              // Ratlam PIN codes start with 457 (e.g., 457001, 457002, etc.)
              const isRatlamPinCode = postcode.startsWith("457");
              
              // Only include if explicitly mentions Ratlam or has Ratlam PIN code
              return hasRatlam || isRatlamPinCode;
            })
            .slice(0, remainingLimit)
            .map((feature) => {
              const [lon, lat] = feature.geometry.coordinates;
              const props = feature.properties;

              // Build display name
              const parts: string[] = [];
              if (props.name) parts.push(props.name);
              if (props.street && props.housenumber) {
                parts.push(`${props.housenumber} ${props.street}`);
              } else if (props.street) {
                parts.push(props.street);
              }
              if (props.city) parts.push(props.city);
              if (props.state) parts.push(props.state);
              if (props.postcode) parts.push(props.postcode);

              const displayName = parts.join(", ") || props.name || "Unknown Location";

              return {
                displayName,
                coordinates: { lat, lon },
                address: {
                  name: props.name || "",
                  street: props.street || props.road,
                  houseNumber: props.housenumber,
                  city: props.city,
                  state: props.state,
                  postcode: props.postcode,
                  country: props.country,
                },
                source: "photon",
              };
            });
        }
      } catch (error: any) {
        console.error("Error fetching Photon results:", error.message);
        // Continue with static results only
      }
    }

    // Combine: static first, then Photon results
    const suggestions = [...staticResults, ...photonResults].slice(0, limit);

    // Remove duplicates based on coordinates (within 50 meters)
    const uniqueSuggestions: AutocompleteSuggestion[] = [];
    const seenCoords = new Set<string>();

    for (const suggestion of suggestions) {
      const coordKey = `${Math.round(suggestion.coordinates.lat * 1000)}_${Math.round(suggestion.coordinates.lon * 1000)}`;
      if (!seenCoords.has(coordKey)) {
        seenCoords.add(coordKey);
        uniqueSuggestions.push(suggestion);
      }
    }

    // Cache the results
    cacheService.set(cacheKey, uniqueSuggestions, 300); // 5 minutes

    return uniqueSuggestions;
  } catch (error: any) {
    console.error("Error fetching Photon autocomplete:", error.message);
    throw new Error("Failed to fetch address suggestions");
  }
};

