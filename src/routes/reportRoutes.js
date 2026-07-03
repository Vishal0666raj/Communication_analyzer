/**
 * src/routes/reportRoutes.js
 * Exists to define express endpoints for retrieving coaching reports.
 * Employs JWT protection middleware.
 */

const express = require("express");
const reportController = require("../controllers/reportController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Protect all report endpoints
router.use(protect);

// GET /api/reports/:jobId
router.get("/:jobId", reportController.getReportByJobId);

module.exports = router;
