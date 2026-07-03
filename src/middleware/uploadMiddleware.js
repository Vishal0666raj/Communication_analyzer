/**
 * src/middleware/uploadMiddleware.js
 * Exists to handle video uploads via Multer.
 * Configures storage location, validates file extensions, and sets upload size limits.
 */

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { BadRequestError } = require("../utils/apiErrors");
const { ensureDirSync } = require("../utils/helpers");

// Configure Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Resolve upload directory path
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || "src/uploads");
    ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Save file with a unique name
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `video-${uniqueSuffix}${extension}`);
  }
});

// Configure File Filter
const fileFilter = (req, file, cb) => {
  const allowedExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm"];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new BadRequestError(`Unsupported file format. Allowed formats: ${allowedExtensions.join(", ")}`), false);
  }
};

// Configure Multer Limits
const limits = {
  fileSize: 100 * 1024 * 1024 // 100MB limit
};

const uploadVideo = multer({
  storage,
  fileFilter,
  limits
}).single("video"); // Key name in request must be "video"

module.exports = { uploadVideo };
