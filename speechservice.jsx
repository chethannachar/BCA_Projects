// ttsService.js
import * as Speech from "expo-speech";

/**
 * Speak an array of text items sequentially.
 * Returns a promise that resolves when all items have been spoken or rejects if cancelled.
 *
 * options:
 *  - language (string) e.g. "en-US"
 *  - rate (number) 0.0 - 1.0 (default 1.0)
 *  - pitch (number) default 1.0
 *  - onStart(index, text) optional callback
 *  - onDone(index, text) optional callback
 */
let _cancelled = false;

export const stopSpeaking = () => {
  _cancelled = true;
  Speech.stop();
};

/**
 * speakTexts: speaks each text in the array one after another.
 * Guarantee: stops any currently speaking before starting.
 */
export const speakTexts = (texts = [], options = {}) => {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(texts) || texts.length === 0) {
      resolve();
      return;
    }

    // stop any previous speech
    _cancelled = false;
    Speech.stop();

    const {
      language = undefined,
      rate = 1.0,
      pitch = 1.0,
      onStart = () => {},
      onDone = () => {},
    } = options;

    let idx = 0;

    const speakNext = () => {
      if (_cancelled) {
        reject(new Error("cancelled"));
        return;
      }

      if (idx >= texts.length) {
        resolve();
        return;
      }

      const text = String(texts[idx]).trim();
      if (!text) {
        idx += 1;
        // tiny micro-delay to avoid stack recursion
        setTimeout(speakNext, 150);
        return;
      }

      onStart(idx, text);

      const speakOptions = {
        onDone: () => {
          onDone(idx, text);
          idx += 1;
          // small pause between items for clarity
          setTimeout(speakNext, 250);
        },
        onError: (err) => {
          // continue on errors but include a small pause
          console.warn("Speech error for text:", text, err);
          idx += 1;
          setTimeout(speakNext, 250);
        },
        rate,
        pitch,
      };

      if (language) speakOptions.language = language;

      try {
        Speech.speak(text, speakOptions);
      } catch (err) {
        console.warn("Speech.speak threw:", err);
        idx += 1;
        setTimeout(speakNext, 250);
      }
    };

    speakNext();
  });
};
