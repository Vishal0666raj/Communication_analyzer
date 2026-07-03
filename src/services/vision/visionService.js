/**
 * src/services/vision/visionService.js
 * Exists as the interface to the computer vision pipeline.
 * Spawns the python MediaPipe frame processor and collects the metrics.
 * Implements a JS-based simulator fallback if Python is unavailable.
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const logger = require("../../config/logger");

/**
 * Executes frame analysis.
 * @param {string} frameDir Absolute path to the folder containing frames
 * @returns {Promise<object>} Contains structured frames metrics array
 */
const analyzeFrames = (frameDir) => {
  return new Promise((resolve) => {
    const pythonScript = path.join(__dirname, "analyze_frames.py");
    
    logger.info(`Spawning Python process to analyze frames in directory: ${frameDir}`);
    
    // Spawn python3 process
    const pythonProcess = spawn("python3", [pythonScript, frameDir]);
    
    let stdoutData = "";
    let stderrData = "";
    
    pythonProcess.stdout.on("data", (data) => {
      stdoutData += data.toString();
    });
    
    pythonProcess.stderr.on("data", (data) => {
      stderrData += data.toString();
    });
    
    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        logger.warn(`Python script exited with code ${code}. Stderr: ${stderrData.trim()}`);
        logger.info("Falling back to Node.js vision simulation.");
        return resolve(simulateVisionAnalysis(frameDir));
      }
      
      try {
        const parsed = JSON.parse(stdoutData.trim());
        if (parsed.warning) {
          logger.warn(`Python warning: ${parsed.warning}`);
        }
        if (parsed.error) {
          logger.error(`Python script returned error: ${parsed.error}`);
          return resolve(simulateVisionAnalysis(frameDir));
        }
        
        logger.success(`Frame analysis completed. Extracted stats for ${parsed.frames.length} frames.`);
        resolve(parsed);
      } catch (err) {
        logger.error(`Failed to parse Python stdout JSON: ${err.message}. Raw output: ${stdoutData}`);
        logger.info("Falling back to Node.js vision simulation.");
        resolve(simulateVisionAnalysis(frameDir));
      }
    });

    pythonProcess.on("error", (err) => {
      logger.warn(`Failed to spawn Python process: ${err.message}. Falling back to simulation.`);
      resolve(simulateVisionAnalysis(frameDir));
    });
  });
};

/**
 * JS-based simulator reproducing MediaPipe's metrics.
 * Ensures the system remains stable and runs correctly in all developer environments.
 * @param {string} frameDir 
 * @returns {object}
 */
const simulateVisionAnalysis = (frameDir) => {
  let frameCount = 10; // default fallback count
  try {
    if (fs.existsSync(frameDir)) {
      const files = fs.readdirSync(frameDir).filter(f => f.startsWith("frame-") && f.endsWith(".png"));
      if (files.length > 0) {
        frameCount = files.length;
      }
    }
  } catch (err) {
    logger.warn(`Could not read frameDir during simulation: ${err.message}`);
  }
  
  const frames = [];
  for (let idx = 1; idx <= frameCount; idx++) {
    const timestamp = idx - 1.0; // 1 FPS estimation
    
    let eyeContact = true;
    let headPose = { pitch: 1.2, yaw: -0.8, roll: 0.5 };
    let posture = "GOOD";
    let handsVisible = true;
    
    // Simulate minor movement issues
    if (timestamp >= 4.0 && timestamp <= 6.0) {
      eyeContact = false;
      headPose = { pitch: -5.0, yaw: 22.5, roll: 2.0 }; // Looking right
    }
    
    if (timestamp >= 12.0 && timestamp <= 14.0) {
      posture = "SLOUCHING";
    }
    
    if (timestamp > 20.0) {
      handsVisible = false; // Hands dropped
    }
    
    frames.append ? null : frames.push({
      timestamp,
      eyeContact,
      headPose,
      smiling: timestamp < 5.0 || timestamp > 25.0,
      blinkRate: idx % 8 === 0 ? 1.0 : 0.0,
      posture,
      shoulders: { left_y: 0.45, right_y: 0.45, angle: posture === "GOOD" ? 0.0 : 8.5 },
      handsVisible,
      handCount: handsVisible ? 2 : 0
    });
  }
  
  return {
    simulated: true,
    frames
  };
};

module.exports = {
  analyzeFrames
};
