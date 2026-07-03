/**
 * src/middleware/validatorMiddleware.js
 * Exists to intercept express-validator results.
 * If any inputs fail validation, it interrupts the flow and returns formatted errors.
 */

const { validationResult } = require("express-validator");
const { AppError } = require("../utils/apiErrors");

const validateResults = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMsg = errors.array().map((err) => `${err.path}: ${err.msg}`).join(", ");
    return next(new AppError(errorMsg, 400));
  }
  next();
};

module.exports = { validateResults };
