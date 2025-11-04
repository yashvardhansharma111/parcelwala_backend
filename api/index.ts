/**
 * Vercel Serverless Function Entry Point
 * This file is used when deploying to Vercel
 * Vercel will automatically compile TypeScript files in the api folder
 */

import app from "../src/app";

// Export the Express app as a serverless function
// Vercel will automatically handle the routing
export default app;

// Configure function timeout (max 30 seconds for Pro plan)
export const config = {
  maxDuration: 30,
};

