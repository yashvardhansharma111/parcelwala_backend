/**
 * Server Entry Point
 * Start the Express server
 */

import app from "./app";
import { ENV } from "./config/env";

const PORT = ENV.PORT || 8080;
const HOST = "0.0.0.0"; // Listen on all interfaces for device access

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📱 Environment: ${ENV.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📲 Device access: http://<your-ip>:${PORT}/health`);
  console.log(`   Make sure devices are on the same network`);
});

