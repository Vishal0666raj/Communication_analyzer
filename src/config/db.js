/**
 * src/config/db.js
 * Exists to initialize and manage the connection to the MongoDB database using Mongoose.
 */

const mongoose = require("mongoose");
const logger = require("./logger");

const connectDB = async () => {
  try {
    const connString = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ai_communication_coach";
    
    logger.info(`Attempting database connection to: ${connString.replace(/:([^@]+)@/, ":****@")}`);
    
    const conn = await mongoose.connect(connString);
    
    logger.success(`MongoDB Connected: ${conn.connection.host}`);
    
    // Listen for connection events
    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB runtime connection error:", err);
    });
    
    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB connection disconnected");
    });
    
  } catch (error) {
    logger.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }
};

module.exports = connectDB;
