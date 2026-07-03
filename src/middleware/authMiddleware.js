/**
 * src/middleware/authMiddleware.js
 * Exists to intercept incoming requests and verify JWT auth tokens in headers.
 * Attaches the authenticated user object to the request object.
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { UnauthorizedError, NotFoundError } = require("../utils/apiErrors");

const protect = async (req, res, next) => {
  let token;

  // 1. Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new UnauthorizedError("You are not logged in. Please provide a token."));
  }

  try {
    // 2. Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "super_secret_ai_communication_coach_jwt_key_2026");

    // 3. Check if user still exists
    const currentUser = await User.findById(decoded.id).select("-password");
    if (!currentUser) {
      return next(new NotFoundError("The user belonging to this token no longer exists."));
    }

    // 4. Grant access to protected route
    req.user = currentUser;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return next(new UnauthorizedError("Invalid token. Please log in again."));
    }
    if (error.name === "TokenExpiredError") {
      return next(new UnauthorizedError("Your token has expired. Please log in again."));
    }
    next(error);
  }
};

module.exports = { protect };
