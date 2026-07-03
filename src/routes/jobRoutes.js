/**
 * src/routes/jobRoutes.js
 * Exists to expose endpoints for checking job status, details, and deletion.
 * (Note: The upload video endpoint can also be placed here or mounted directly).
 */

const express = require("express");
const jobController = require("../controllers/jobController");
const { protect } = require("../middleware/authMiddleware");
const { uploadVideo } = require("../middleware/uploadMiddleware");

const router = express.Router();

// All job routes require authentication
router.use(protect);

// Endpoint for uploading video (Can be mounted as /api/upload-video in app.js)
router.post("/upload", uploadVideo, jobController.uploadVideoJob);

// Endpoint for getting job details: GET /api/jobs/:jobId
router.get("/:jobId", jobController.getJobDetails);

// Endpoint for checking status: GET /api/jobs/:jobId/status
router.get("/:jobId/status", jobController.getJobStatus);

// Endpoint for deleting job: DELETE /api/jobs/:jobId
router.delete("/:jobId", jobController.deleteJob);

module.exports = router;
