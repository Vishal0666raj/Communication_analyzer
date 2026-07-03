/**
 * src/app.js
 * Exists to initialize the Express application framework.
 * Configures CORS, security headers, request parsers, route mountings,
 * and sets up global exception handlers.
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

// Load Environment variables in testing if not already loaded
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const jobRoutes = require("./routes/jobRoutes");
const reportRoutes = require("./routes/reportRoutes");

const { protect } = require("./middleware/authMiddleware");
const { uploadVideo } = require("./middleware/uploadMiddleware");
const { uploadVideoJob } = require("./controllers/jobController");
const errorHandler = require("./middleware/errorMiddleware");
const { NotFoundError } = require("./utils/apiErrors");

const app = express();

// 1. Security Middlewares
app.use(helmet());
app.use(cors());

// 2. Request Logging Middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// 3. Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Mount API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/reports", reportRoutes);

// Mount POST /api/upload-video directly at root level as requested
app.post("/api/upload-video", protect, uploadVideo, uploadVideoJob);

// Serve static upload resources (if needed for debugging or frontends)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Serve public static frontend
app.use(express.static(path.join(__dirname, "public")));

// 5. Catch-all for unhandled routes
app.use((req, res, next) => {
  next(new NotFoundError(`Can't find ${req.originalUrl} on this server!`));
});

// 6. Global Error Handler Middleware
app.use(errorHandler);

module.exports = app;
