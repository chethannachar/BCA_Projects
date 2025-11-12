// speechservice.jsx
import * as Speech from "expo-speech";

let _isSpeaking = false;
let _currentIndex = 0;
let _texts = [];
let _cancelled = false;

export const stopSpeaking = () => {
  _isSpeaking = false;
  _cancelled = true;
  Speech.stop();
};

export const isSpeaking = () => _isSpeaking;

// Speak single text with prompt
export const speakCurrentItem = async (text, options = {}) => {
  _isSpeaking = true;

  try {
    // Speak the current item
    await new Promise((resolve) => {
      Speech.speak(text, {
        ...options,
        onDone: resolve,
      });
    });

    // Speak the prompt
    await new Promise((resolve) => {
      Speech.speak(
        "Say information for details, navigate for directions, or next to continue",
        { ...options, rate: 1.1, onDone: resolve }
      );
    });
  } finally {
    _isSpeaking = false;
  }
};

// Speak info content
export const speakInfo = (text, options = {}) => {
  _isSpeaking = true;
  return new Promise((resolve) => {
    try {
      Speech.speak(text, {
        ...options,
        onDone: () => {
          _isSpeaking = false;
          if (typeof options.onDone === "function") options.onDone();
          resolve();
        },
        onError: () => {
          _isSpeaking = false;
          resolve();
        },
      });
    } catch (err) {
      _isSpeaking = false;
      resolve();
    }
  });
};

export const setTexts = (texts = []) => {
  _texts = texts;
  _currentIndex = 0;
};

export const getNextText = () => {
  if (_currentIndex < _texts.length - 1) {
    _currentIndex++;
    return _texts[_currentIndex];
  }
  return null;
};

export const getCurrentText = () => _texts[_currentIndex];

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
        setTimeout(speakNext, 150);
        return;
      }

      onStart(idx, text);

      const speakOptions = {
        onDone: () => {
          onDone(idx, text);
          idx += 1;
          setTimeout(speakNext, 250);
        },
        onError: (err) => {
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
