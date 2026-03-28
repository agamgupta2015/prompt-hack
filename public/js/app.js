import {
  extractAndParseJSON,
  validateSchema,
  generateIncidentId,
} from './utils.js';
import { getApiKey, saveApiKey, saveToHistory, getHistory } from './storage.js';
import { processSignalToGemini } from './api.js';
import {
  showToast,
  renderOutputCard,
  updateProcessingState,
  clearProcessingLogs,
  renderHistory,
} from './ui.js';
import { handleFileSelect } from './image.js';
import {
  initSpeechRecognition,
  startRecording,
  stopRecording,
  isSpeechRecording,
} from './audio.js';

/* State */
let currentActiveTabId = 'tab-text';
let currentImageData = null;
let currentIncidentData = null;

/* Elements */
const apiKeyInput = document.getElementById('apiKeyInput');
const saveKeyBtn = document.getElementById('saveKeyBtn');
const keyStatusContainer = document.getElementById('keyStatusContainer');

const textInput = document.getElementById('textInput');
const pasteInput = document.getElementById('pasteInput');
const voiceTranscript = document.getElementById('voiceTranscript');
const micBtn = document.getElementById('micBtn');
const waveform = document.getElementById('waveform');
const voiceStatus = document.getElementById('voiceStatus');

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const imagePreview = document.getElementById('imagePreview');
const photoDescription = document.getElementById('photoDescription');

const processBtn = document.getElementById('processBtn');

/* Init */
function init() {
  const existingKey = getApiKey();
  if (existingKey) {
    apiKeyInput.value = '********'; // Masked visual
    keyStatusContainer.textContent = 'Key Loaded ✓';
    keyStatusContainer.style.color = 'var(--c-accent-green)';
  }

  // Pre-render history
  renderHistory(getHistory());
}

/* API Key Management */
saveKeyBtn.addEventListener('click', () => {
  const val = apiKeyInput.value.trim();
  if (val && val !== '********') {
    saveApiKey(val);
    keyStatusContainer.textContent = 'Key Saved ✓';
    keyStatusContainer.style.color = 'var(--c-accent-green)';
    setTimeout(() => {
      apiKeyInput.value = '********';
    }, 500);
  }
});

/* Tabs */
const tabs = document.querySelectorAll('.tab');
tabs.forEach((tab) => {
  tab.addEventListener('click', (e) => {
    // Reset tabs
    tabs.forEach((t) => t.classList.remove('active'));
    document
      .querySelectorAll('.tab-panel')
      .forEach((p) => p.classList.add('hidden'));

    // Highlight active
    e.target.classList.add('active');
    currentActiveTabId = e.target.getAttribute('aria-controls');
    document.getElementById(currentActiveTabId).classList.remove('hidden');
  });
});

/* Presets */
const SCENARIOS = {
  fire: 'theres fire at the building near 5th and main, smoke everywhere, people on 3rd floor, electricity sparking, one guy is down near the door',
  cyclone:
    '{"source":"NOAA","warning":"CYCLONE SEVERE","lat":-12.4,"lon":130.8,"wind_kt":120,"surge_m":4,"status":"IMMINENT_LANDFALL","power_status":"50%_OFFLINE"}',
  casualty:
    'Medic 4 confirming MCI at central station. multiple blast injuries. need 5 bus immediately. police secure perimeter. blood shortage.',
  bridge:
    "BRIDGE COLLAPSE I-95 SOUTH. Sensor node 42: structural integrity critical fail. Twitter: 'omg the bridge just fell cars in water'.",
  flood:
    'DAM RELEASE NOTICE: upstream dam 9. flow rate 4000cfs. expected impact zone lower valley. data missing from sensor 2. Evacuate zone A.',
  gas: 'operator: 911 whats your emergency. caller: help i smell strong gas in my apartment complex on elm st. my neighbors are passing out. operator: get out now.',
};

document.querySelectorAll('.btn-preset').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    const key = e.target.getAttribute('data-preset');
    const text = SCENARIOS[key];

    // Switch to text tab if not on paste
    if (key === 'cyclone') {
      document.getElementById('btn-tab-paste').click();
      pasteInput.value = text;
    } else {
      document.getElementById('btn-tab-text').click();
      textInput.value = text;
    }
  });
});

/* Image Upload Logic */
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    await processImageFile(e.dataTransfer.files[0]);
  }
});

dropZone.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', async (e) => {
  if (e.target.files && e.target.files[0]) {
    await processImageFile(e.target.files[0]);
  }
});

async function processImageFile(file) {
  try {
    const imgData = await handleFileSelect(file);
    currentImageData = imgData;
    imagePreview.src = imgData.url;
    imagePreview.classList.remove('hidden');
    dropZone.querySelector('.drop-text').classList.add('hidden');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* Voice Logic */
initSpeechRecognition(
  (final, interim) => {
    voiceTranscript.value = final + interim;
  },
  (err) => {
    showToast(`Microphone Error: ${err}`);
    voiceStatus.textContent = 'Mic Error';
    waveform.classList.add('hidden');
    micBtn.classList.remove('recording');
  },
  () => {
    // End cleanly
    micBtn.classList.remove('recording');
    waveform.classList.add('hidden');
    voiceStatus.textContent = 'Recording Stopped';
  }
);

micBtn.addEventListener('click', () => {
  if (isSpeechRecording()) {
    stopRecording();
    micBtn.classList.remove('recording');
    waveform.classList.add('hidden');
    voiceStatus.textContent = 'Processing transcript...';
  } else {
    const started = startRecording();
    if (started) {
      micBtn.classList.add('recording');
      waveform.classList.remove('hidden');
      voiceStatus.textContent = 'Listening live...';
      voiceTranscript.value = ''; // clear on start
    }
  }
});

/* Main Process Flow */
processBtn.addEventListener('click', async () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    showToast('API Key is required. Please save it in the header.');
    return;
  }

  // Gather Input
  const inputPayload = { text: '', image: null };

  switch (currentActiveTabId) {
    case 'tab-text':
      inputPayload.text = textInput.value.trim();
      break;
    case 'tab-paste':
      inputPayload.text = pasteInput.value.trim();
      break;
    case 'tab-voice':
      inputPayload.text = voiceTranscript.value.trim();
      if (isSpeechRecording()) stopRecording();
      break;
    case 'tab-photo':
      inputPayload.text =
        photoDescription.value.trim() ||
        'Describe this scene and extract relevant intelligence.';
      inputPayload.image = currentImageData;
      break;
  }

  if (!inputPayload.text && !inputPayload.image) {
    showToast('Please provide input signal before processing.');
    return;
  }

  // Disabling interactions
  processBtn.disabled = true;
  document.getElementById('outputPanel').classList.add('hidden');

  try {
    // 1. Show processing
    const processingSteps = [
      'Establishing connection to Gemini bridge...',
      'Analyzing unformatted multi-modal signatures...',
      'Triangulating verifiable entities...',
      'Prioritizing intelligence queue...',
    ];

    updateProcessingState(processingSteps[0]);

    // Simulate UI sync progression logic since API is fast but we want dramatic effect
    for (let i = 1; i < processingSteps.length; i++) {
      setTimeout(() => updateProcessingState(processingSteps[i]), i * 800);
    }

    // 2. Fetch
    const rawResponse = await processSignalToGemini(inputPayload, apiKey);

    updateProcessingState('Signal parsed. Reconstructing schema...');

    // 3. Parse and Validate
    const parsedJSON = extractAndParseJSON(rawResponse);
    if (!validateSchema(parsedJSON)) {
      throw new Error('Gemini payload violated schema structure.');
    }

    // 4. Update UI & Save State
    clearProcessingLogs();

    const incidentId = generateIncidentId();
    const timestamp = Date.now();

    currentIncidentData = parsedJSON; // Cache for export

    renderOutputCard(parsedJSON, incidentId, timestamp);

    // 5. Commit to history
    saveToHistory({
      id: incidentId,
      timestamp: timestamp,
      data: parsedJSON,
    });

    // Re-render drawer silently
    renderHistory(getHistory());

    showToast('Signal processed successfully.', 'info');
  } catch (error) {
    clearProcessingLogs();
    showToast(error.message, 'error');
  } finally {
    processBtn.disabled = false;
  }
});

/* Actions (Export, Copy) */
document.getElementById('exportJsonBtn').addEventListener('click', () => {
  if (!currentIncidentData) return;
  const str = JSON.stringify(currentIncidentData, null, 2);
  const blob = new Blob([str], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aria-${new Date().getTime()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document
  .getElementById('copySummaryBtn')
  .addEventListener('click', async () => {
    if (!currentIncidentData) return;
    try {
      await navigator.clipboard.writeText(
        currentIncidentData.plain_english_summary
      );
      showToast('Summary copied to clipboard', 'info');
    } catch (err) {
      showToast('Failed to copy clipboard');
    }
  });

document.getElementById('newSignalBtn').addEventListener('click', () => {
  document.getElementById('outputPanel').classList.add('hidden');
  textInput.value = '';
  pasteInput.value = '';
  voiceTranscript.value = '';
  photoDescription.value = '';
  imagePreview.src = '';
  imagePreview.classList.add('hidden');
  dropZone.querySelector('.drop-text').classList.remove('hidden');
  currentImageData = null;
  currentIncidentData = null;
});

/* History Drawer Interactions */
const historyToggleBtn = document.getElementById('historyToggleBtn');
const closeHistoryBtn = document.getElementById('closeHistoryBtn');
const historyDrawer = document.getElementById('historyDrawer');

historyToggleBtn.addEventListener('click', () => {
  const isExpanded = historyToggleBtn.getAttribute('aria-expanded') === 'true';
  historyDrawer.classList.toggle('open');
  historyToggleBtn.setAttribute('aria-expanded', !isExpanded);
  historyDrawer.setAttribute('aria-hidden', isExpanded);
});

closeHistoryBtn.addEventListener('click', () => {
  historyDrawer.classList.remove('open');
  historyToggleBtn.setAttribute('aria-expanded', 'false');
  historyDrawer.setAttribute('aria-hidden', 'true');
});

init();
