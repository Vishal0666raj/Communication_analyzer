/**
 * src/middleware/errorMiddleware.js
 * Exists to catch any errors thrown during API request execution.
 * Formats errors nicely and sends structured JSON responses back to the client.
 */

const logger = require("../config/logger");

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  // Log error using our structured logger
  logger.error(`${err.message} - Path: ${req.originalUrl} - Method: ${req.method}`, err);

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, res);
  } else {
    // Production mode - don't leak details for programming or external library errors
    let error = { ...err };
    error.message = err.message;

    // Handle specific Mongoose/JWT/Cast validation errors
    if (err.name === "CastError") error = handleCastErrorDB(err);
    if (err.code === 11000) error = handleDuplicateFieldsDB(err);
    if (err.name === "ValidationError") error = handleValidationErrorDB(err);

    sendErrorProd(error, res);
  }
};

// Dev error response - contains stack trace and raw details
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack
  });
};

// Prod error response - clean and sanitized
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
  } else {
    // Programming or other unknown error: don't leak details
    res.status(500).json({
      status: "error",
      message: "Something went wrong internally."
    });
  }
};

// Custom Database error handlers
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  const { AppError } = require("../utils/apiErrors");
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg ? err.errmsg.match(/(["'])(\\?.)*?\1/)[0] : "value";
  const message = `Duplicate field value: ${value}. Please use another value!`;
  const { AppError } = require("../utils/apiErrors");
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data. ${errors.join(". ")}`;
  const { AppError } = require("../utils/apiErrors");
  return new AppError(message, 400);
};

module.exports = errorHandler;
