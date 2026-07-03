/**
 * src/routes/authRoutes.js
 * Exists to define express endpoints for user registrations, login, and profile fetching.
 * Hooks up input validators and JWT protection middleware.
 */

const express = require("express");
const { body } = require("express-validator");
const authController = require("../controllers/authController");
const { validateResults } = require("../middleware/validatorMiddleware");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Input Validations Schema
const registerValidation = [
  body("name")
    .notEmpty().withMessage("Name is required")
    .isLength({ min: 2 }).withMessage("Name must be at least 2 characters long"),
  body("email")
    .isEmail().withMessage("Must be a valid email address"),
  body("password")
    .isLength({ min: 6 }).withMessage("Password must be at least 6 characters long")
];

const loginValidation = [
  body("email")
    .isEmail().withMessage("Must be a valid email address"),
  body("password")
    .notEmpty().withMessage("Password is required")
];

// Routes Configuration
router.post("/register", registerValidation, validateResults, authController.register);
router.post("/login", loginValidation, validateResults, authController.login);

// GET /api/users/me maps here or via users route, we can support GET /api/auth/me or GET /api/users/me.
// The user specified: GET /api/users/me
// Let's create this endpoint here or build a separate user route.
// Let's place the profile route under GET /api/users/me in user routes later, 
// and keep auth endpoints clean here. Or we can define /me endpoint here as well.
router.get("/me", protect, authController.getMe);

module.exports = router;
