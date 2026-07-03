/**
 * src/services/report/reportService.js
 * Exists to aggregate raw speech and visual metrics,
 * compress continuous frame-level issues into temporal events,
 * invoke the AI report generator, and persist results to the database.
 */

const Report = require("../../models/Report");
const Job = require("../../models/Job");
const { generateCoachingReport } = require("../ai/aiService");
const logger = require("../../config/logger");

/**
 * Aggregates analysis outputs and saves the final Report to MongoDB.
 * @param {string} jobId Mongoose Job ObjectId
 * @param {object} speechMetrics Speech analysis results
 * @param {object} visionResult Raw frame-by-frame visual metrics
 * @returns {Promise<object>} Saved Mongoose Report document
 */
const compileAndSaveReport = async (jobId, speechMetrics, visionResult) => {
  try {
    logger.info(`Compiling final report for job: ${jobId}`);

    const frames = visionResult.frames || [];
    const totalFrames = frames.length;

    // 1. Calculate Aggregate Computer Vision Percentages
    let eyeContactCount = 0;
    let slouchingCount = 0;
    let handsVisibleCount = 0;
    let smilingCount = 0;
    let blinkCount = 0;

    frames.forEach((f) => {
      if (f.eyeContact) eyeContactCount++;
      if (f.posture === "SLOUCHING") slouchingCount++;
      if (f.handsVisible) handsVisibleCount++;
      if (f.smiling) smilingCount++;
      if (f.blinkRate > 0) blinkCount++;
    });

    const eyeContactPercent = totalFrames > 0 ? Math.round((eyeContactCount / totalFrames) * 100) : 100;
    const slouchingPercent = totalFrames > 0 ? Math.round((slouchingCount / totalFrames) * 100) : 0;
    const goodPosturePercent = 100 - slouchingPercent;
    const handsVisiblePercent = totalFrames > 0 ? Math.round((handsVisibleCount / totalFrames) * 100) : 0;
    const smilingPercent = totalFrames > 0 ? Math.round((smilingCount / totalFrames) * 100) : 0;

    const visionSummary = {
      eyeContactPercent,
      slouchingPercent,
      goodPosturePercent,
      handsVisiblePercent,
      smilingPercent,
      blinkCount
    };

    // 2. Coalesce continuous frame-level visual issues into timeline ranges
    // This avoids spamming individual seconds for a single 5-second look-away.
    const postureIssues = findContinuousVisionIssues(frames, (f) => f.posture === "SLOUCHING");
    const eyeContactIssues = findContinuousVisionIssues(frames, (f) => f.eyeContact === false);

    const detectedVisionIssues = {
      posture: postureIssues,
      eyeContact: eyeContactIssues
    };

    // 3. Prepare package for the AI Coaching Service
    const transcriptText = speechMetrics.speakingSpeed > 0 ? speechMetrics.fillerWords.length > 0 || speechMetrics.pauses.length > 0 
      ? "Transcript text processed and scanned." : "Transcript text analyzed." : "No speech detected.";
      
    // Let's grab the actual raw text if available in speechMetrics or recreate it
    let fullText = "";
    if (speechMetrics.rawTranscriptText) {
      fullText = speechMetrics.rawTranscriptText;
    } else {
      // Reassemble text if speechMetrics has text
      fullText = speechMetrics.text || "Speaking session transcript";
    }

    const aiInput = {
      transcriptText: fullText,
      speechMetrics,
      visionSummary,
      detectedVisionIssues
    };

    // 4. Generate AI feedback report
    const aiCoachingReport = await generateCoachingReport(aiInput);

    // 5. Create and save Report document in MongoDB
    const reportData = {
      jobId,
      transcript: speechMetrics.segments || [],
      overallScore: aiCoachingReport.overallScore || 80,
      confidenceScore: aiCoachingReport.confidenceScore || 80,
      grammarScore: aiCoachingReport.grammarScore || 80,
      bodyLanguageScore: aiCoachingReport.bodyLanguageScore || 80,
      eyeContactScore: aiCoachingReport.eyeContactScore || 80,
      postureScore: aiCoachingReport.postureScore || 80,
      gestureScore: aiCoachingReport.gestureScore || 80,
      communicationScore: aiCoachingReport.communicationScore || 80,
      vocabularyScore: aiCoachingReport.vocabularyScore || 80,
      speakingSpeed: speechMetrics.speakingSpeed,
      fillerWords: speechMetrics.fillerWords,
      pauses: speechMetrics.pauses,
      strengths: aiCoachingReport.strengths || [],
      weaknesses: aiCoachingReport.weaknesses || [],
      summary: aiCoachingReport.summary || "",
      timeline: aiCoachingReport.timeline || []
    };

    const newReport = new Report(reportData);
    const savedReport = await newReport.save();

    // 6. Update Job status to COMPLETED
    await Job.findByIdAndUpdate(jobId, {
      status: "COMPLETED",
      progress: 100,
      reportId: savedReport._id
    });

    logger.success(`Report successfully compiled and saved for Job ${jobId}. Report ID: ${savedReport._id}`);
    return savedReport;

  } catch (error) {
    logger.error(`Error compiling final report for job: ${jobId}`, error);
    
    // Update Job status to FAILED
    await Job.findByIdAndUpdate(jobId, {
      status: "FAILED",
      error: error.message
    });
    
    throw error;
  }
};

/**
 * Scans frame timeline to combine consecutive seconds of a problem into a start-end range.
 * @param {Array} frames Frame details
 * @param {Function} predicateCondition Evaluates true if the issue is active
 * @returns {Array<{start: number, end: number}>} Grouped ranges
 */
const findContinuousVisionIssues = (frames, predicateCondition) => {
  const issues = [];
  let inIssueRange = false;
  let startTimestamp = 0;

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const isIssue = predicateCondition(f);

    if (isIssue) {
      if (!inIssueRange) {
        // Start of range
        inIssueRange = true;
        startTimestamp = f.timestamp;
      }
    } else {
      if (inIssueRange) {
        // End of range
        inIssueRange = false;
        issues.push({
          start: startTimestamp,
          end: frames[i - 1].timestamp + 1.0 // round up duration
        });
      }
    }
  }

  // Handle boundary condition if file ends in an issue state
  if (inIssueRange && frames.length > 0) {
    issues.push({
      start: startTimestamp,
      end: frames[frames.length - 1].timestamp + 1.0
    });
  }

  return issues;
};

module.exports = {
  compileAndSaveReport
};
