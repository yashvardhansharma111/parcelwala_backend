"use strict";
/**
 * Vercel Serverless Function Entry Point
 * This file is used when deploying to Vercel
 * Vercel will automatically compile TypeScript files in the api folder
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const app_1 = __importDefault(require("../src/app"));
// Export the Express app as a serverless function
// Vercel will automatically handle the routing
exports.default = app_1.default;
// Configure function timeout (max 30 seconds for Pro plan)
exports.config = {
    maxDuration: 30,
};
//# sourceMappingURL=index.js.map