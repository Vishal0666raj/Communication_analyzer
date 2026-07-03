/**
 * src/controllers/reportController.js
 * Exists to handle report retrieval requests.
 * Fetches compiled analysis, scores, and timelines by jobId.
 */

const Report = require("../models/Report");
const Job = require("../models/Job");
const { NotFoundError, ForbiddenError, BadRequestError } = require("../utils/apiErrors");

/**
 * Fetches the coaching report associated with a specific jobId.
 */
const getReportByJobId = async (req, res, next) => {
  const { jobId } = req.params;

  try {
    // 1. Fetch job to verify exists and check ownership
    const job = await Job.findById(jobId);
    if (!job) {
      return next(new NotFoundError(`Job with ID ${jobId} not found.`));
    }

    // 2. Ownership check
    if (job.userId.toString() !== req.user._id.toString()) {
      return next(new ForbiddenError("You do not have permission to access the report for this job."));
    }

    // 3. Check job status
    if (job.status === "FAILED") {
      return next(new BadRequestError(`The job failed to process. Error: ${job.error}`));
    }

    if (job.status !== "COMPLETED" || !job.reportId) {
      return res.status(200).json({
        status: "success",
        message: "The analysis is still processing. Please check back shortly.",
        data: {
          jobId: job._id,
          status: job.status,
          progress: job.progress
        }
      });
    }

    // 4. Retrieve the actual Report
    const report = await Report.findById(job.reportId);
    if (!report) {
      return next(new NotFoundError(`Report for Job ${jobId} was not found.`));
    }

    res.status(200).json({
      status: "success",
      data: { report }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  getReportByJobId
};
