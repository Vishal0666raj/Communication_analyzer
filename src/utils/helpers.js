/**
 * src/utils/helpers.js
 * Exists to provide helper functions used across services and controllers,
 * such as folder creation, file management, and timestamp conversions.
 */

const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");

/**
 * Formats a duration in seconds into MM:SS format.
 * @param {number} seconds 
 * @returns {string} e.g. "01:24"
 */
const formatSecondsToMMSS = (seconds) => {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const padMins = String(mins).padStart(2, "0");
  const padSecs = String(secs).padStart(2, "0");
  return `${padMins}:${padSecs}`;
};

/**
 * Parses MM:SS format back into seconds.
 * @param {string} timestamp e.g. "01:24"
 * @returns {number} seconds
 */
const parseMMSSToSeconds = (timestamp) => {
  if (!timestamp || !timestamp.includes(":")) return 0;
  const parts = timestamp.split(":");
  const mins = parseInt(parts[0], 10) || 0;
  const secs = parseInt(parts[1], 10) || 0;
  return (mins * 60) + secs;
};

/**
 * Ensures that a directory exists, creating it recursively if it doesn't.
 * @param {string} dirPath 
 */
const ensureDirSync = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logger.debug(`Created directory: ${dirPath}`);
  }
};

/**
 * Safely deletes a file if it exists, logging any errors instead of crashing.
 * @param {string} filePath 
 */
const deleteFileSafe = (filePath) => {
  if (!filePath) return;
  try {
    const resolvedPath = path.resolve(filePath);
    if (fs.existsSync(resolvedPath)) {
      fs.unlinkSync(resolvedPath);
      logger.debug(`Deleted file: ${resolvedPath}`);
    }
  } catch (err) {
    logger.warn(`Could not delete file at path: ${filePath}`, err.message);
  }
};

/**
 * Recursively deletes a directory and its contents.
 * @param {string} dirPath 
 */
const deleteDirRecursiveSafe = (dirPath) => {
  if (!dirPath) return;
  try {
    const resolvedPath = path.resolve(dirPath);
    if (fs.existsSync(resolvedPath)) {
      fs.rmSync(resolvedPath, { recursive: true, force: true });
      logger.debug(`Deleted directory recursively: ${resolvedPath}`);
    }
  } catch (err) {
    logger.warn(`Could not recursively delete directory: ${dirPath}`, err.message);
  }
};

module.exports = {
  formatSecondsToMMSS,
  parseMMSSToSeconds,
  ensureDirSync,
  deleteFileSafe,
  deleteDirRecursiveSafe
};
