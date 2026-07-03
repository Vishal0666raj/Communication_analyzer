/**
 * src/utils/testPipeline.js
 * Integration test script to verify the entire pipeline end-to-end.
 * Connects to MongoDB, inserts a user, creates a mock video file,
 * queues a Job, executes the processor, and verifies the generated Report.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const connectDB = require("../config/db");
const logger = require("../config/logger");
const User = require("../models/User");
const Job = require("../models/Job");
const Report = require("../models/Report");
const { processJob } = require("../jobs/jobProcessor");
const { ensureDirSync, deleteFileSafe, deleteDirRecursiveSafe } = require("./helpers");

const runIntegrationTest = async () => {
  logger.info("=== STARTING END-TO-END PIPELINE INTEGRATION TEST ===");

  // 1. Connect to Database
  await connectDB();

  try {
    // Clean up past test documents
    logger.info("Cleaning up historical test documents...");
    await User.deleteMany({ email: "test-coach@example.com" });
    await Job.deleteMany({});
    await Report.deleteMany({});

    // 2. Create Test User
    logger.info("Creating test user...");
    const testUser = await User.create({
      name: "Coach Tester",
      email: "test-coach@example.com",
      password: "password123"
    });
    logger.success(`Created test user: ${testUser.name} (${testUser._id})`);

    // 3. Create mock video file
    const uploadsDir = path.resolve(process.env.UPLOAD_DIR || "src/uploads");
    ensureDirSync(uploadsDir);
    const mockVideoPath = path.join(uploadsDir, `test-session-${Date.now()}.mp4`);
    fs.writeFileSync(mockVideoPath, "MOCK VIDEO DATA FOR INTEGRATION TESTING");
    logger.success(`Created mock video file at: ${mockVideoPath}`);

    // 4. Create Job in DB
    logger.info("Queueing test Job...");
    const testJob = await Job.create({
      userId: testUser._id,
      videoPath: mockVideoPath,
      status: "QUEUED",
      progress: 0
    });
    logger.success(`Job queued in DB: ${testJob._id}`);

    // 5. Run the Job Processor directly
    logger.info("Triggering job processor manually...");
    await processJob(testJob);

    // 6. Verification checks
    logger.info("Running pipeline validations...");
    
    // Check if Job is marked COMPLETED
    const finalJob = await Job.findById(testJob._id);
    if (!finalJob) throw new Error("Job not found in database after processing.");
    
    logger.info(`Final Job Status: ${finalJob.status}`);
    logger.info(`Final Job Progress: ${finalJob.progress}%`);
    logger.info(`Final Job Error: ${finalJob.error || "None"}`);

    if (finalJob.status !== "COMPLETED") {
      throw new Error(`Pipeline did not complete. Status: ${finalJob.status}, Error: ${finalJob.error}`);
    }

    // Verify Report document
    if (!finalJob.reportId) {
      throw new Error("Job completed but no reportId was linked.");
    }

    const report = await Report.findById(finalJob.reportId);
    if (!report) {
      throw new Error(`Report with ID ${finalJob.reportId} not found in database.`);
    }

    logger.success("=== REPORT GENERATION SUCCESS ===");
    logger.info(`Report ID: ${report._id}`);
    logger.info(`Overall Score: ${report.overallScore}`);
    logger.info(`Speaking Speed: ${report.speakingSpeed} WPM`);
    logger.info(`Confidence Score: ${report.confidenceScore}`);
    logger.info(`Body Language Score: ${report.bodyLanguageScore}`);
    logger.info(`Filler Words Count: ${report.fillerWords.length}`);
    logger.info(`Pauses Count: ${report.pauses.length}`);
    logger.info(`Strengths: ${JSON.stringify(report.strengths)}`);
    logger.info(`Weaknesses: ${JSON.stringify(report.weaknesses)}`);
    logger.info(`Summary: ${report.summary}`);
    logger.info(`Timeline Events Count: ${report.timeline.length}`);
    
    if (report.timeline.length > 0) {
      logger.info("Sample Timeline Event:");
      console.log(JSON.stringify(report.timeline[0], null, 2));
    }

    // Clean up mock video file
    deleteFileSafe(mockVideoPath);

    logger.success("=== INTEGRATION TEST PASSED SUCCESSFULLY ===");

  } catch (error) {
    logger.error("Integration test failed with error:", error);
  } finally {
    logger.info("Closing MongoDB connection...");
    await mongoose.connection.close();
    logger.success("DB Connection closed. Test runner finished.");
  }
};

runIntegrationTest();
