/**
 * src/services/speechAnalysis/speechAnalysisService.js
 * Exists to process the transcript and word timestamps.
 * Calculates WPM, identifies filler words, tracks long pauses,
 * and measures verbal confidence indices.
 */

const { formatSecondsToMMSS } = require("../../utils/helpers");

// Standard lists of common English filler words
const FILLER_WORDS = ["um", "uh", "like", "so", "actually", "basically", "literally"];
const MULTI_WORD_FILLERS = [
  { phrase: "you know", words: ["you", "know"] },
  { phrase: "i mean", words: ["i", "mean"] }
];

/**
 * Analyzes speech transcript and word/segment-level timestamps.
 * @param {object} transcriptionResult Result from speechService.transcribeAudio
 * @returns {object} Structured speech analysis metrics
 */
const analyzeSpeech = (transcriptionResult) => {
  const { text = "", segments = [], words = [] } = transcriptionResult;

  if (words.length === 0) {
    return {
      speakingSpeed: 0,
      fillerWords: [],
      repeatedWords: [],
      pauses: [],
      vocabularyDiversity: 0,
      averageSentenceLength: 0,
      confidenceScore: 100
    };
  }

  // 1. Calculate Speaking Speed (WPM)
  const firstWordTime = words[0].start;
  const lastWordTime = words[words.length - 1].end;
  const durationInSeconds = lastWordTime - firstWordTime;
  const durationInMinutes = durationInSeconds / 60;
  
  const totalWordsCount = words.length;
  const speakingSpeed = durationInMinutes > 0 ? Math.round(totalWordsCount / durationInMinutes) : 0;

  // 2. Detect Filler Words (and get their timestamps)
  const detectedFillers = [];
  
  // Single word fillers
  for (let i = 0; i < words.length; i++) {
    const rawWord = words[i].word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
    
    // Check single word filler
    if (FILLER_WORDS.includes(rawWord)) {
      detectedFillers.push({
        word: words[i].word,
        start: words[i].start,
        end: words[i].end,
        formattedStart: formatSecondsToMMSS(words[i].start),
        formattedEnd: formatSecondsToMMSS(words[i].end)
      });
    }

    // Check multi-word fillers (e.g. "you know")
    if (i < words.length - 1) {
      const secondRawWord = words[i + 1].word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
      const combined = `${rawWord} ${secondRawWord}`;
      
      const isMultiFiller = MULTI_WORD_FILLERS.some(f => f.phrase === combined);
      if (isMultiFiller) {
        detectedFillers.push({
          word: combined,
          start: words[i].start,
          end: words[i + 1].end,
          formattedStart: formatSecondsToMMSS(words[i].start),
          formattedEnd: formatSecondsToMMSS(words[i + 1].end)
        });
        i++; // skip next word as it's part of the filler
      }
    }
  }

  // 3. Detect Repeated Words (consecutive repetitions like "the the")
  const repeatedWords = [];
  for (let i = 0; i < words.length - 1; i++) {
    const wordA = words[i].word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
    const wordB = words[i + 1].word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
    
    // Skip empty values or fillers (which we already captured)
    if (wordA && wordA === wordB && !FILLER_WORDS.includes(wordA)) {
      repeatedWords.push({
        word: words[i].word,
        start: words[i].start,
        end: words[i + 1].end,
        formattedStart: formatSecondsToMMSS(words[i].start),
        formattedEnd: formatSecondsToMMSS(words[i + 1].end)
      });
    }
  }

  // 4. Detect Long Pauses (> 2 seconds of silence between consecutive words)
  const pauses = [];
  for (let i = 0; i < words.length - 1; i++) {
    const currentEnd = words[i].end;
    const nextStart = words[i + 1].start;
    const pauseDuration = nextStart - currentEnd;

    if (pauseDuration > 2.0) {
      pauses.push({
        start: currentEnd,
        end: nextStart,
        duration: parseFloat(pauseDuration.toFixed(2)),
        formattedStart: formatSecondsToMMSS(currentEnd),
        formattedEnd: formatSecondsToMMSS(nextStart)
      });
    }
  }

  // 5. Calculate Vocabulary Diversity (Type-Token Ratio - TTR)
  const uniqueWords = new Set(
    words.map(w => w.word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ""))
  );
  // filter out empty words from clean set
  uniqueWords.delete("");
  const vocabularyDiversity = totalWordsCount > 0 ? parseFloat((uniqueWords.size / totalWordsCount).toFixed(3)) : 0;

  // 6. Calculate Average Sentence Length (using segments as sentences)
  const sentenceCount = segments.length;
  let totalSentenceWords = 0;
  segments.forEach(seg => {
    // split text into words and count
    const segWords = seg.text.trim().split(/\s+/).filter(w => w.length > 0);
    totalSentenceWords += segWords.length;
  });
  const averageSentenceLength = sentenceCount > 0 ? parseFloat((totalSentenceWords / sentenceCount).toFixed(1)) : 0;

  // 7. Calculate Speech Confidence Score
  // Baseline 100, deduct points for:
  // - Excess filler words (deduct 3 per filler, max 30)
  // - Repeated words (deduct 5 per repetition, max 20)
  // - Long pauses (deduct 4 per long pause, max 20)
  // - Speed: ideal speed is between 120 and 160 WPM. Deduct for being too slow/fast
  let speechConfidence = 100;
  
  speechConfidence -= Math.min(detectedFillers.length * 3, 30);
  speechConfidence -= Math.min(repeatedWords.length * 5, 20);
  speechConfidence -= Math.min(pauses.length * 4, 20);

  if (speakingSpeed < 100) {
    const penalty = Math.min((100 - speakingSpeed) * 0.5, 20);
    speechConfidence -= penalty;
  } else if (speakingSpeed > 170) {
    const penalty = Math.min((speakingSpeed - 170) * 0.5, 20);
    speechConfidence -= penalty;
  }

  speechConfidence = Math.max(Math.round(speechConfidence), 30); // Floor it at 30

  return {
    speakingSpeed,
    fillerWords: detectedFillers,
    repeatedWords,
    pauses,
    vocabularyDiversity,
    averageSentenceLength,
    confidenceScore: speechConfidence
  };
};

module.exports = {
  analyzeSpeech
};
