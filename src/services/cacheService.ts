/**
 * Cache Service
 * Wrapper for NodeCache to manage OTP storage
 */

import NodeCache from "node-cache";

// Create cache instance with default TTL of 5 minutes (300 seconds)
const cache = new NodeCache({
  stdTTL: 300, // 5 minutes default TTL
  checkperiod: 60, // Check for expired keys every 60 seconds
});

export const cacheService = {
  /**
   * Store OTP in cache
   * @param phoneNumber - Phone number as key
   * @param otp - OTP code to store
   * @param ttl - Time to live in seconds (default: 300)
   */
  setOTP: (phoneNumber: string, otp: string, ttl: number = 300): boolean => {
    return cache.set(phoneNumber, otp, ttl);
  },

  /**
   * Get OTP from cache
   * @param phoneNumber - Phone number as key
   * @returns OTP string or undefined if not found/expired
   */
  getOTP: (phoneNumber: string): string | undefined => {
    return cache.get<string>(phoneNumber);
  },

  /**
   * Delete OTP from cache
   * @param phoneNumber - Phone number as key
   */
  deleteOTP: (phoneNumber: string): void => {
    cache.del(phoneNumber);
  },

  /**
   * Check if OTP exists in cache
   * @param phoneNumber - Phone number as key
   * @returns true if OTP exists, false otherwise
   */
  hasOTP: (phoneNumber: string): boolean => {
    return cache.has(phoneNumber);
  },

  /**
   * Generic cache set method
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds (default: 300)
   */
  set: <T>(key: string, value: T, ttl: number = 300): boolean => {
    return cache.set(key, value, ttl);
  },

  /**
   * Generic cache get method
   * @param key - Cache key
   * @returns Cached value or undefined if not found/expired
   */
  get: <T>(key: string): T | undefined => {
    return cache.get<T>(key);
  },

  /**
   * Delete from cache
   * @param key - Cache key
   */
  del: (key: string): void => {
    cache.del(key);
  },

  /**
   * Check if key exists in cache
   * @param key - Cache key
   */
  has: (key: string): boolean => {
    return cache.has(key);
  },

  /**
   * Get all cache keys (for debugging)
   */
  getAllKeys: (): string[] => {
    return cache.keys();
  },
};

