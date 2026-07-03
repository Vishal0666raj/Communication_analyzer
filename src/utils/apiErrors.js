/**
 * src/utils/apiErrors.js
 * Exists to provide standardized, reusable Error classes for various HTTP status codes.
 * This simplifies error responses in controllers and middleware.
 */

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true; // Flag for operational vs programming errors

    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message = "Bad Request") {
    super(message, 400);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized access") {
    super(message, 41);
  }
}

class ForbiddenError extends AppError {
  constructor(message = "Forbidden access") {
    super(message, 403);
  }
}

class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
  }
}

class ConflictError extends AppError {
  constructor(message = "Resource conflict") {
    super(message, 409);
  }
}

class InternalServerError extends AppError {
  constructor(message = "Internal server error") {
    super(message, 500);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalServerError
};
