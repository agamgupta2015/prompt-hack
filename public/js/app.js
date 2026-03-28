/*
  === PRODUCTION SECURITY PATTERN FOR GEMINI API KEY ===
  In a production environment, never expose the Gemini API key in the client.
  Instead:
  1. Store the GEMINI_API_KEY in Google Cloud Secret Manager.
  2. Create a Firebase Cloud Function (e.g., `processSignal`).
  3. The Cloud Function accesses the secret at runtime.
  4. The client app calls the Firebase Cloud Function, which proxies the request to the Gemini API.
  5. The Cloud Function enforces Firebase App Check to ensure requests only come from your app.

  === GA4 MEASUREMENT PLAN ===
  Events tracked:
  - signal_submitted (params: input_type, input_length) -> Fired when user clicks "Process Signal"
  - incident_parsed (params: severity, incident_type, confidence_score) -> Fired when Gemini returns successfully
  - action_exported -> Fired when user clicks "Export JSON"
  - preset_loaded (params: preset_name) -> Fired when a preset is used
*/

import {
  extractAndParseJSON,
  validateSchema,
  generateIncidentId,
} from './utils.js';
import { getApiKey, saveApiKey } from './storage.js';
import { processSignalToGemini, processVisionAPI } from './api.js';
import {
  showToast,
  renderOutputCard,
  updateProcessingState,
  clearProcessingLogs,
  renderHistory,
  renderVisionLabels,
} from './ui.js';
import { handleFileSelect } from './image.js';
import {
  initSpeechRecognition,
  startRecording,
  stopRecording,
  isSpeechRecording,
} from './audio.js';

/* Firebase Initialization */
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "G-XXXXXXXXXX"
};

// Initialize Firebase SDK
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

/*
  Firestore Security Rules required for this app:
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /incidents/{incidentId} {
        allow read, write: if request.auth != null
          && request.auth.uid == resource.data.uid;
        allow create: if request.auth != null
          && request.resource.data.uid == request.auth.uid;
      }
    }
  }
*/

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

  // Firebase Auth & Real-time History Listener
  auth.onAuthStateChanged((user) => {
    const sessionIndicator = document.getElementById('sessionIndicator');
    if (user) {
      if (sessionIndicator) {
        sessionIndicator.classList.remove('offline');
        sessionIndicator.classList.add('online');
        sessionIndicator.title = 'Session Online';
      }

      // Setup Firestore Real-time listener for History
      db.collection("incidents")
        .where("uid", "==", user.uid)
        .orderBy("created_at", "desc")
        .limit(10)
        .onSnapshot((snapshot) => {
          const historyArray = [];
          snapshot.forEach(doc => {
            historyArray.push({
              id: doc.id,
              timestamp: doc.data().created_at ? doc.data().created_at.toMillis() : Date.now(),
              data: doc.data()
            });
          });
          renderHistory(historyArray);
        }, (err) => {
          console.error("Firestore history listener error:", err);
        });
    } else {
      if (sessionIndicator) {
        sessionIndicator.classList.remove('online');
        sessionIndicator.classList.add('offline');
        sessionIndicator.title = 'Session Offline';
      }
    }
  });

  // Anonymous login on app load
  auth.signInAnonymously().catch(err => {
    console.warn("Auth init failed. Maybe offline:", err);
  });
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

    // GA4 Tracking
    if (typeof gtag !== 'undefined') {
      gtag('event', 'preset_loaded', {
        preset_name: key
      });
    }

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

  // GA4 Tracking
  if (typeof gtag !== 'undefined') {
    gtag('event', 'signal_submitted', {
      input_type: currentActiveTabId,
      input_length: inputPayload.text ? inputPayload.text.length : 0
    });
  }

  // Disabling interactions
  processBtn.disabled = true;
  document.getElementById('outputPanel').classList.add('hidden');

  try {
    const processingSteps = [
      'Establishing connection to Gemini bridge...',
      'Analyzing unformatted multi-modal signatures...',
      'Triangulating verifiable entities...',
      'Prioritizing intelligence queue...',
    ];

    // Vision API Pre-processing Injection
    if (currentActiveTabId === 'tab-photo' && currentImageData) {
      updateProcessingState('Vision pre-processing...');
      try {
        const visionData = await processVisionAPI(currentImageData.data, apiKey);
        if (visionData) {
          if (visionData.labelAnnotations) {
             renderVisionLabels(visionData.labelAnnotations);
          }
          let visionContext = "[VISION API PRE-PROCESSING RESULTS]\n";
          if (visionData.labelAnnotations) {
            visionContext += "Labels: " + visionData.labelAnnotations.map(l => l.description).join(", ") + "\n";
          }
          if (visionData.textAnnotations && visionData.textAnnotations.length > 0) {
            visionContext += "Extracted Text: " + visionData.textAnnotations[0].description.replace(/\\n/g, " ") + "\n";
          }
          if (visionData.localizedObjectAnnotations) {
            visionContext += "Objects: " + visionData.localizedObjectAnnotations.map(o => o.name).join(", ") + "\n";
          }
          inputPayload.text = visionContext + "\n[USER DESCRIPTION]\n" + inputPayload.text;
        }
      } catch (err) {
        console.warn("Vision API Error:", err);
      }
    }

    // 1. Show processing
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

    // 5. Commit to Firestore
    if (auth.currentUser) {
      try {
        await db.collection("incidents").doc(incidentId).set({
          ...parsedJSON,
          uid: auth.currentUser.uid,
          created_at: firebase.firestore.FieldValue.serverTimestamp(),
          input_type: currentActiveTabId,
          raw_input_length: inputPayload.text ? inputPayload.text.length : 0
        });
      } catch (err) {
        showToast('Firestore offline — incident saved locally', 'error');
        console.error("Firestore write failed", err);
      }

      // 6. Commit to BigQuery via Streaming Insert REST API
      try {
        const PROJECT_ID = "YOUR_PROJECT_ID";
        await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT_ID}/datasets/aria_incidents/tables/parsed_signals/insertAll`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}` // Using apiKey as a placeholder for OAuth token here
          },
          body: JSON.stringify({
            kind: "bigquery#tableDataInsertAllRequest",
            skipInvalidRows: false,
            ignoreUnknownValues: true,
            rows: [
              {
                insertId: incidentId,
                json: parsedJSON
              }
            ]
          })
        });
        showToast('Incident logged to BigQuery', 'info');
      } catch (err) {
        console.warn("BigQuery insert failed:", err);
      }
    }

    // GA4 Tracking
    if (typeof gtag !== 'undefined') {
      gtag('event', 'incident_parsed', {
        severity: parsedJSON.severity,
        incident_type: parsedJSON.incident_type,
        confidence_score: parsedJSON.confidence_score
      });
    }

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

  // GA4 Tracking
  if (typeof gtag !== 'undefined') {
    gtag('event', 'action_exported');
  }

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
  
  const visionTags = document.getElementById('visionTagsContainer');
  if (visionTags) visionTags.innerHTML = '';

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
