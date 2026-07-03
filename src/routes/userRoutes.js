/**
 * src/routes/userRoutes.js
 * Exists to expose endpoints for User resource management.
 * Specifically hooks up the GET /api/users/me endpoint.
 */

const express = require("express");
const authController = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// GET /api/users/me
router.get("/me", protect, authController.getMe);

module.exports = router;
