/**
 * src/controllers/jobController.js
 * Exists to handle API actions for Jobs: uploading videos, checking progress,
 * and deleting historical records along with physical storage cleanup.
 */

const path = require("path");
const fs = require("fs");
const Job = require("../models/Job");
const Report = require("../models/Report");
const { NotFoundError, ForbiddenError, BadRequestError } = require("../utils/apiErrors");
const logger = require("../config/logger");
const { deleteFileSafe, deleteDirRecursiveSafe } = require("../utils/helpers");

/**
 * Handles video upload and creates a QUEUED job.
 */
const uploadVideoJob = async (req, res, next) => {
  try {
    // 1. Verify file was uploaded
    if (!req.file) {
      return next(new BadRequestError("No video file uploaded. Make sure to send the file in the 'video' field."));
    }

    // 2. Create Job in database
    const newJob = await Job.create({
      userId: req.user._id,
      videoPath: req.file.path,
      status: "QUEUED",
      progress: 0
    });

    logger.success(`Job created for user ${req.user.email}. Job ID: ${newJob._id}. File: ${req.file.filename}`);

    // 3. Return response (queue processor will pick it up asynchronously)
    res.status(202).json({
      status: "success",
      message: "Video uploaded successfully and queued for analysis.",
      data: {
        job: {
          id: newJob._id,
          status: newJob.status,
          progress: newJob.progress,
          videoFilename: req.file.filename,
          createdAt: newJob.createdAt
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Fetches the full Job document.
 */
const getJobDetails = async (req, res, next) => {
  const { jobId } = req.params;

  try {
    const job = await Job.findById(jobId);
    
    if (!job) {
      return next(new NotFoundError(`Job with ID ${jobId} not found.`));
    }

    // Authorization check
    if (job.userId.toString() !== req.user._id.toString()) {
      return next(new ForbiddenError("You do not have permission to access this job."));
    }

    res.status(200).json({
      status: "success",
      data: { job }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Fetches only the status and progress of a Job (used for frontend polling).
 */
const getJobStatus = async (req, res, next) => {
  const { jobId } = req.params;

  try {
    const job = await Job.findById(jobId).select("status progress error");
    
    if (!job) {
      return next(new NotFoundError(`Job with ID ${jobId} not found.`));
    }

    // Authorization check - query full job for userId check
    const fullJob = await Job.findById(jobId);
    if (fullJob.userId.toString() !== req.user._id.toString()) {
      return next(new ForbiddenError("You do not have permission to access this job."));
    }

    res.status(200).json({
      status: "success",
      data: {
        jobId: job._id,
        status: job.status,
        progress: job.progress,
        error: job.error || null
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Deletes a Job, its physical files, and its associated Report.
 */
const deleteJob = async (req, res, next) => {
  const { jobId } = req.params;

  try {
    const job = await Job.findById(jobId);
    if (!job) {
      return next(new NotFoundError(`Job with ID ${jobId} not found.`));
    }

    // Authorization check
    if (job.userId.toString() !== req.user._id.toString()) {
      return next(new ForbiddenError("You do not have permission to delete this job."));
    }

    // 1. Delete associated Report if exists
    if (job.reportId) {
      await Report.findByIdAndDelete(job.reportId);
      logger.info(`Deleted associated Report: ${job.reportId}`);
    }

    // 2. Delete physical files from disk
    deleteFileSafe(job.videoPath);
    if (job.audioPath) deleteFileSafe(job.audioPath);
    if (job.frameDirectory) deleteDirRecursiveSafe(job.frameDirectory);

    // 3. Delete Job from DB
    await Job.findByIdAndDelete(jobId);
    logger.success(`Job ${jobId} deleted successfully.`);

    res.status(200).json({
      status: "success",
      message: "Job and all associated files deleted successfully."
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadVideoJob,
  getJobDetails,
  getJobStatus,
  deleteJob
};
