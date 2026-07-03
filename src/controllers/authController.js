/**
 * src/controllers/authController.js
 * Exists to handle user authentication requests (registration and login).
 * Signs JSON Web Tokens (JWT) for secure authentication.
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { BadRequestError, ConflictError, UnauthorizedError } = require("../utils/apiErrors");
const logger = require("../config/logger");

/**
 * Generates a signed JWT for a given user ID.
 * @param {string} userId 
 * @returns {string} token
 */
const signToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET || "super_secret_ai_communication_coach_jwt_key_2026",
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

/**
 * Registers a new user.
 */
const register = async (req, res, next) => {
  const { name, email, password } = req.body;

  try {
    // 1. Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new ConflictError("An account with this email address already exists."));
    }

    // 2. Create new user
    const newUser = await User.create({
      name,
      email,
      password
    });

    logger.success(`New user registered: ${newUser.email} (${newUser._id})`);

    // 3. Issue Token
    const token = signToken(newUser._id);

    // 4. Return response
    res.status(201).json({
      status: "success",
      token,
      data: {
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          createdAt: newUser.createdAt
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Authenticates an existing user and returns a token.
 */
const login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    // 1. Find user by email and include password field
    const user = await User.findOne({ email });
    if (!user) {
      return next(new UnauthorizedError("Invalid email or password."));
    }

    // 2. Check if password matches
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(new UnauthorizedError("Invalid email or password."));
    }

    logger.success(`User logged in: ${user.email}`);

    // 3. Issue Token
    const token = signToken(user._id);

    // 4. Return response
    res.status(200).json({
      status: "success",
      token,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Returns current authenticated user profiles.
 */
const getMe = async (req, res, next) => {
  // req.user is populated by the protect middleware
  res.status(200).json({
    status: "success",
    data: {
      user: req.user
    }
  });
};

module.exports = {
  register,
  login,
  getMe
};
