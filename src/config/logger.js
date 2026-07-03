/**
 * src/config/logger.js
 * Exists to provide a central, production-ready logging utility.
 * Supports different levels (info, warn, error, debug) with timestamps and color-coded output.
 */

const colors = {
  reset: "\x1b[0m",
  info: "\x1b[36m",    // Cyan
  warn: "\x1b[33m",    // Yellow
  error: "\x1b[31m",   // Red
  debug: "\x1b[90m",   // Gray
  success: "\x1b[32m"  // Green
};

const getTimestamp = () => {
  return new Date().toISOString();
};

const formatMessage = (level, message, meta = "") => {
  const metaStr = meta ? ` | Meta: ${JSON.stringify(meta, null, 2)}` : "";
  return `[${getTimestamp()}] [${level.toUpperCase()}]: ${message}${metaStr}`;
};

const logger = {
  info: (message, meta) => {
    console.log(`${colors.info}${formatMessage("info", message, meta)}${colors.reset}`);
  },
  success: (message, meta) => {
    console.log(`${colors.success}${formatMessage("success", message, meta)}${colors.reset}`);
  },
  warn: (message, meta) => {
    console.warn(`${colors.warn}${formatMessage("warn", message, meta)}${colors.reset}`);
  },
  error: (message, meta) => {
    console.error(`${colors.error}${formatMessage("error", message, meta)}${colors.reset}`);
    if (meta && meta instanceof Error) {
      console.error(colors.error, meta.stack, colors.reset);
    }
  },
  debug: (message, meta) => {
    if (process.env.NODE_ENV !== "production") {
      console.log(`${colors.debug}${formatMessage("debug", message, meta)}${colors.reset}`);
    }
  }
};

module.exports = logger;
