/**
 * Web Speech API handler
 */

let recognition = null;
let isRecording = false;

export function initSpeechRecognition(onResult, onError, onEnd) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.error('Speech Recognition API not supported in this browser.');
    return false;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    if (onResult) {
      onResult(finalTranscript, interimTranscript);
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error', event.error);
    isRecording = false;
    if (onError) onError(event.error);
  };

  recognition.onend = () => {
    if (isRecording) {
      // Auto restart if still recording
      try {
        recognition.start();
      } catch {
        isRecording = false;
        if (onEnd) onEnd();
      }
    } else {
      if (onEnd) onEnd();
    }
  };

  return true;
}

export function startRecording() {
  if (!recognition) return false;
  try {
    recognition.start();
    isRecording = true;
    return true;
  } catch (e) {
    console.warn('Recognition already started');
    return false;
  }
}

export function stopRecording() {
  if (!recognition) return false;
  isRecording = false;
  recognition.stop();
  return true;
}

export function isSpeechRecording() {
  return isRecording;
}
