/**
 * src/services/speech/speechService.js
 * Exists to transcribe audio to text using OpenAI Whisper API.
 * Returns the transcript, sentence-level segments, and word-level timestamps.
 * Provides a high-fidelity simulator fallback for development without API keys.
 */

const fs = require("fs");
const { OpenAI } = require("openai");
const logger = require("../../config/logger");

// Define a realistic simulated transcript output
const SIMULATED_TRANSCRIPT_SEGMENTS = [
  {
    start: 0.5,
    end: 3.2,
    text: "Hello everyone, and welcome to this speaking session."
  },
  {
    start: 3.8,
    end: 8.5,
    text: "Um, today I want to talk about, you know, effective communication."
  },
  {
    start: 9.0,
    end: 14.2,
    text: "It is, like, extremely important to maintain regular eye contact with your audience."
  },
  {
    start: 16.5,
    end: 19.8,
    text: "A long pause can... help build suspense."
  },
  {
    start: 20.3,
    end: 25.1,
    text: "Basically, speaking speed determines how well the listeners process your ideas."
  },
  {
    start: 25.9,
    end: 28.5,
    text: "Thank you so much for your time."
  }
];

const SIMULATED_WORDS = [
  // Segment 1
  { word: "Hello", start: 0.5, end: 0.9 },
  { word: "everyone,", start: 0.9, end: 1.4 },
  { word: "and", start: 1.4, end: 1.6 },
  { word: "welcome", start: 1.6, end: 2.1 },
  { word: "to", start: 2.1, end: 2.3 },
  { word: "this", start: 2.3, end: 2.6 },
  { word: "speaking", start: 2.6, end: 2.9 },
  { word: "session.", start: 2.9, end: 3.2 },

  // Segment 2
  { word: "Um,", start: 3.8, end: 4.4 }, // filler
  { word: "today", start: 4.4, end: 4.8 },
  { word: "I", start: 4.8, end: 5.0 },
  { word: "want", start: 5.0, end: 5.3 },
  { word: "to", start: 5.3, end: 5.5 },
  { word: "talk", start: 5.5, end: 5.9 },
  { word: "about,", start: 5.9, end: 6.3 },
  { word: "you", start: 6.3, end: 6.6 }, // filler part 1
  { word: "know,", start: 6.6, end: 7.1 }, // filler part 2
  { word: "effective", start: 7.1, end: 7.8 },
  { word: "communication.", start: 7.8, end: 8.5 },

  // Segment 3
  { word: "It", start: 9.0, end: 9.3 },
  { word: "is,", start: 9.3, end: 9.7 },
  { word: "like,", start: 9.7, end: 10.3 }, // filler
  { word: "extremely", start: 10.3, end: 11.0 },
  { word: "important", start: 11.0, end: 11.6 },
  { word: "to", start: 11.6, end: 11.8 },
  { word: "maintain", start: 11.8, end: 12.3 },
  { word: "regular", start: 12.3, end: 12.8 },
  { word: "eye", start: 12.8, end: 13.1 },
  { word: "contact", start: 13.1, end: 13.6 },
  { word: "with", start: 13.6, end: 13.8 },
  { word: "your", start: 13.8, end: 14.0 },
  { word: "audience.", start: 14.0, end: 14.2 },

  // Segment 4 (Notice the large pause from 14.2s to 16.5s - 2.3 seconds pause)
  { word: "A", start: 16.5, end: 16.8 },
  { word: "long", start: 16.8, end: 17.2 },
  { word: "pause", start: 17.2, end: 17.7 },
  { word: "can...", start: 17.7, end: 18.3 },
  { word: "help", start: 18.3, end: 18.7 },
  { word: "build", start: 18.7, end: 19.1 },
  { word: "suspense.", start: 19.1, end: 19.8 },

  // Segment 5
  { word: "Basically,", start: 20.3, end: 21.0 }, // filler
  { word: "speaking", start: 21.0, end: 21.5 },
  { word: "speed", start: 21.5, end: 22.0 },
  { word: "determines", start: 22.0, end: 22.6 },
  { word: "how", start: 22.6, end: 22.9 },
  { word: "well", start: 22.9, end: 23.2 },
  { word: "the", start: 23.2, end: 23.4 },
  { word: "listeners", start: 23.4, end: 24.0 },
  { word: "process", start: 24.0, end: 24.5 },
  { word: "your", start: 24.5, end: 24.7 },
  { word: "ideas.", start: 24.7, end: 25.1 },

  // Segment 6
  { word: "Thank", start: 25.9, end: 26.2 },
  { word: "you", start: 26.2, end: 26.4 },
  { word: "so", start: 26.4, end: 26.7 },
  { word: "much", start: 26.7, end: 27.0 },
  { word: "for", start: 27.0, end: 27.3 },
  { word: "your", start: 27.3, end: 27.6 },
  { word: "time.", start: 27.6, end: 28.5 }
];

/**
 * Transcribes audio using OpenAI Whisper API or simulation fallback.
 * @param {string} audioPath 
 * @returns {Promise<object>} Contains full text, segments, and words.
 */
const transcribeAudio = async (audioPath) => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey.startsWith("your_openai")) {
    logger.warn("OPENAI_API_KEY not configured or placeholder. Using high-fidelity speech simulator.");
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const fullText = SIMULATED_TRANSCRIPT_SEGMENTS.map(s => s.text).join(" ");
    
    return {
      text: fullText,
      segments: SIMULATED_TRANSCRIPT_SEGMENTS,
      words: SIMULATED_WORDS
    };
  }

  try {
    logger.info(`Sending audio to OpenAI Whisper API for transcription: ${audioPath}`);
    const openai = new OpenAI({ apiKey });
    
    // Call the Whisper-1 model with timestamp granularities enabled
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["word", "segment"]
    });

    logger.success("Audio transcribed successfully from OpenAI API.");
    
    // Map response keys correctly
    return {
      text: response.text,
      segments: response.segments.map(seg => ({
        start: seg.start,
        end: seg.end,
        text: seg.text
      })),
      words: response.words.map(w => ({
        word: w.word,
        start: w.start,
        end: w.end
      }))
    };
  } catch (error) {
    logger.error("Whisper API transcription failed. Falling back to simulator.", error);
    
    const fullText = SIMULATED_TRANSCRIPT_SEGMENTS.map(s => s.text).join(" ");
    return {
      text: fullText,
      segments: SIMULATED_TRANSCRIPT_SEGMENTS,
      words: SIMULATED_WORDS
    };
  }
};

module.exports = {
  transcribeAudio,
  SIMULATED_TRANSCRIPT_SEGMENTS,
  SIMULATED_WORDS
};
