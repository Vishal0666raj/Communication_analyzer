/**
 * src/models/Report.js
 * Exists to define the database schema and model for the final AI Coaching Reports.
 * Stores comprehensive text summaries, scores, timelines, and analytical feedback.
 */

const mongoose = require("mongoose");

const ReportSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true
    },
    transcript: {
      type: Array, // Re-saves transcript data or simplified version with timestamps
      default: []
    },
    overallScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    confidenceScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    grammarScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    bodyLanguageScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    eyeContactScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    postureScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    gestureScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    communicationScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    vocabularyScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    speakingSpeed: {
      type: Number // Words Per Minute (WPM)
    },
    fillerWords: {
      type: Array, // Detailed breakdown of filler word counts
      default: []
    },
    pauses: {
      type: Array, // Pauses details with timestamps
      default: []
    },
    strengths: {
      type: [String],
      default: []
    },
    weaknesses: {
      type: [String],
      default: []
    },
    summary: {
      type: String,
      required: true
    },
    timeline: [
      {
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
        category: { type: String, required: true }, // e.g. "Speech", "Eye Contact", "Posture"
        issue: { type: String, required: true },
        suggestion: { type: String, required: true }
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Report", ReportSchema);
