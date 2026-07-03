/**
 * src/models/Job.js
 * Exists to define the database schema and model for processing Jobs.
 * Tracks the state of the communication analysis pipeline.
 */

const mongoose = require("mongoose");

const JobSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    videoPath: {
      type: String,
      required: true
    },
    audioPath: {
      type: String
    },
    frameDirectory: {
      type: String
    },
    transcript: {
      type: Array, // Stores structured transcript paragraphs or words
      default: []
    },
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Report"
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    status: {
      type: String,
      enum: ["QUEUED", "PROCESSING", "COMPLETED", "FAILED"],
      default: "QUEUED"
    },
    error: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Job", JobSchema);
