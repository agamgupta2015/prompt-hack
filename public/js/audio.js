/* ── AUDIO ── */

let recognition = null;
let isRecording = false;

/**
 * Instantiates the Web Speech API recognition interface.
 * @param {Function} onResult - Callback firing transcribed text
 * @param {Function} onError - Callback firing error strings
 * @param {Function} onEnd - Callback handling termination state
 * @returns {boolean} Support state
 */
export function initSpeechRecognition(onResult, onError, onEnd) {
  const SpeechR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechR) return false;

  recognition = new SpeechR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (e) => handleSpeechEvent(e, onResult);
  recognition.onerror = (e) => handleErrorEvent(e, onError);
  recognition.onend = () => handleEndEvent(onEnd);

  return true;
}

/**
 * Extracts transcribed frames from Speech API.
 * @param {Event} event - Speech event
 * @param {Function} callback - Invocation target
 */
function handleSpeechEvent(event, callback) {
  let finalTxt = '', interimTxt = '';
  for (let i = event.resultIndex; i < event.results.length; ++i) {
    if (event.results[i].isFinal) finalTxt += event.results[i][0].transcript;
    else interimTxt += event.results[i][0].transcript;
  }
  if (callback) callback(finalTxt, interimTxt);
}

/**
 * Routes error payload.
 * @param {Event} event - Error event
 * @param {Function} fallback - Fallback routing
 */
function handleErrorEvent(event, fallback) {
  isRecording = false;
  if (fallback) fallback(event.error);
}

/**
 * Handles automatic restarts matching continuous loop expectations.
 * @param {Function} onEnd - Lifecycle boundary
 */
function handleEndEvent(onEnd) {
  if (isRecording) {
    try { recognition.start(); } 
    catch { isRecording = false; if (onEnd) onEnd(); }
  } else if (onEnd) {
    onEnd();
  }
}

/**
 * Engages the microphone listener.
 * @returns {boolean} True if successfully triggered
 */
export function startRecording() {
  if (!recognition) return false;
  try {
    recognition.start();
    isRecording = true;
    return true;
  } catch { return false; }
}

/**
 * Decouples the microphone listener.
 * @returns {boolean} True if successfully dropped
 */
export function stopRecording() {
  if (!recognition) return false;
  isRecording = false;
  recognition.stop();
  return true;
}

/**
 * Reports live status query.
 * @returns {boolean} Active state
 */
export function isSpeechRecording() {
  return isRecording;
}
