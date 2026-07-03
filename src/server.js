/**
 * src/server.js
 * Entry point of the application.
 * Connects to MongoDB, starts the background queue processor,
 * and boots the HTTP server to listen on the designated port.
 */

// Load environment variables immediately
require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");
const { startQueueProcessor, stopQueueProcessor } = require("./jobs/jobProcessor");
const logger = require("./config/logger");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // 1. Establish Database Connection
  await connectDB();

  // 2. Start Background Job Queue Engine
  // Checks for queued files every 3 seconds for fast dev feedback
  startQueueProcessor(3000);

  // 3. Bind server to port
  const server = app.listen(PORT, () => {
    logger.success(`Server is running in ${process.env.NODE_ENV || "development"} mode on port: ${PORT}`);
  });

  // 4. Graceful Shutdown handlers
  const shutdown = () => {
    logger.warn("SIGTERM/SIGINT signal received. Starting graceful shutdown...");
    
    // Stop polling queue
    stopQueueProcessor();

    server.close(() => {
      logger.info("HTTP Server closed.");
      
      const mongoose = require("mongoose");
      mongoose.connection.close(false, () => {
        logger.success("MongoDB connection closed.");
        process.exit(0);
      });
    });

    // Forced shutdown fallback after 10s
    setTimeout(() => {
      logger.error("Forced shutdown activated: connections could not be closed in time.");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
};

startServer().catch(err => {
  logger.error("Fatal startup error occurred:", err);
  process.exit(1);
});
