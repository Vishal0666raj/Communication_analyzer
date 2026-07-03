/**
 * src/jobs/jobProcessor.js
 * Exists to process video analysis jobs in the background.
 * Uses a polling loop to scan for QUEUED jobs, processes them,
 * manages status/progress updates, and handles file cleanups.
 */

const path = require("path");
const fs = require("fs");
const Job = require("../models/Job");
const logger = require("../config/logger");
const videoService = require("../services/video/videoService");
const speechService = require("../services/speech/speechService");
const visionService = require("../services/vision/visionService");
const speechAnalysisService = require("../services/speechAnalysis/speechAnalysisService");
const reportService = require("../services/report/reportService");
const { ensureDirSync, deleteFileSafe, deleteDirRecursiveSafe } = require("../utils/helpers");

let isPolling = false;
let pollingInterval = null;

/**
 * Updates progress percentage for a Job in the DB.
 * @param {string} jobId 
 * @param {number} progress 
 */
const updateJobProgress = async (jobId, progress) => {
  try {
    await Job.findByIdAndUpdate(jobId, { progress });
    logger.debug(`Job ${jobId} progress updated to: ${progress}%`);
  } catch (err) {
    logger.error(`Failed to update progress for job ${jobId}`, err);
  }
};

/**
 * Performs the heavy processing tasks for a specific Job.
 * @param {object} job Document representing the Job
 */
const processJob = async (job) => {
  const jobId = job._id.toString();
  const videoPath = path.resolve(job.videoPath);
  
  // Set up temp output paths
  const tempDir = path.resolve(process.env.TEMP_DIR || "src/temp");
  const audioPath = path.join(tempDir, `audio-${jobId}.wav`);
  const frameDir = path.join(tempDir, `frames-${jobId}`);

  try {
    logger.info(`Started processing Job ${jobId}. Video Path: ${videoPath}`);
    
    // Update status to PROCESSING
    await Job.findByIdAndUpdate(jobId, {
      status: "PROCESSING",
      progress: 5,
      audioPath,
      frameDirectory: frameDir
    });

    // Step 1: Probe Metadata (Progress: 10%)
    logger.info(`Step 1/6 for Job ${jobId}: Probing metadata...`);
    const metadata = await videoService.getMetadata(videoPath);
    await updateJobProgress(jobId, 10);

    // Step 2: Extract Audio (Progress: 25%)
    logger.info(`Step 2/6 for Job ${jobId}: Extracting audio...`);
    await videoService.extractAudio(videoPath, audioPath);
    await updateJobProgress(jobId, 30);

    // Step 3: Extract Frames (Progress: 50%)
    logger.info(`Step 3/6 for Job ${jobId}: Extracting frames at 1 FPS...`);
    await videoService.extractFrames(videoPath, frameDir, 1);
    await updateJobProgress(jobId, 50);

    // Step 4: Speech-to-Text Transcription via Whisper (Progress: 70%)
    logger.info(`Step 4/6 for Job ${jobId}: Transcribing audio...`);
    const transcriptionResult = await speechService.transcribeAudio(audioPath);
    // Attach text to the job for caching or backup
    await Job.findByIdAndUpdate(jobId, { transcript: transcriptionResult.segments });
    await updateJobProgress(jobId, 70);

    // Step 5: Vision Analysis via MediaPipe (Progress: 85%)
    logger.info(`Step 5/6 for Job ${jobId}: Running vision frame analysis...`);
    const visionResult = await visionService.analyzeFrames(frameDir);
    await updateJobProgress(jobId, 85);

    // Step 6: Speech Metrics Analysis (Progress: 90%)
    logger.info(`Step 6/6 for Job ${jobId}: Running speech metrics analysis...`);
    // Inject the raw transcript text into speechMetrics
    const speechMetrics = speechAnalysisService.analyzeSpeech(transcriptionResult);
    speechMetrics.rawTranscriptText = transcriptionResult.text;
    await updateJobProgress(jobId, 92);

    // Step 7: Synthesize & Save Final Report (Progress: 100% on success)
    logger.info(`Final Step: Compiling AI coaching report...`);
    await reportService.compileAndSaveReport(jobId, speechMetrics, visionResult);

    logger.success(`Job ${jobId} finished processing successfully.`);

  } catch (error) {
    logger.error(`Job ${jobId} failed during execution.`, error);
    
    // Update job status to FAILED
    await Job.findByIdAndUpdate(jobId, {
      status: "FAILED",
      error: error.message
    });
  } finally {
    // ALWAYS clean up intermediate files to prevent disk bloat
    logger.info(`Cleaning up temporary files for Job ${jobId}...`);
    deleteFileSafe(audioPath);
    deleteDirRecursiveSafe(frameDir);
  }
};

/**
 * Core loop that polls the database for pending jobs.
 */
const pollQueue = async () => {
  if (isPolling) return; // Prevent overlapping runs
  isPolling = true;

  try {
    // Find the oldest QUEUED job
    const queuedJob = await Job.findOne({ status: "QUEUED" }).sort({ createdAt: 1 });
    
    if (queuedJob) {
      logger.info(`Found queued job ${queuedJob._id}. Lock acquired.`);
      
      // Temporarily mark as PROCESSING so no other worker picks it up
      await Job.findByIdAndUpdate(queuedJob._id, { status: "PROCESSING", progress: 1 });
      
      // Process synchronously regarding the queue (one job at a time)
      await processJob(queuedJob);
    }
  } catch (error) {
    logger.error("Error occurred during queue polling:", error);
  } finally {
    isPolling = false;
  }
};

/**
 * Starts the background polling interval.
 * @param {number} intervalMs Milliseconds between poll checks (default 5000ms)
 */
const startQueueProcessor = (intervalMs = 5000) => {
  if (pollingInterval) {
    logger.warn("Job Queue Processor is already running.");
    return;
  }

  logger.info("Initializing Background Job Queue Processor...");
  pollingInterval = setInterval(pollQueue, intervalMs);
};

/**
 * Stops the background polling interval.
 */
const stopQueueProcessor = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    logger.info("Background Job Queue Processor stopped.");
  }
};

module.exports = {
  startQueueProcessor,
  stopQueueProcessor,
  processJob // Exported for manual/testing triggers
};
