/* ── IMPORTS ── */
import { extractAndParseJSON, validateSchema, generateIncidentId } from './utils.js';
import { getConfig, saveApiKey, clearSession } from './storage.js';
import { processSignalToGemini, processSignalToVisionAPI } from './api.js';
import { showInlineBanner, renderOutputCard, updateProcessingState, clearProcessingLogs, renderHistory } from './ui.js';
import { handleFileSelect } from './image.js';
import { initSpeechRecognition, startRecording, stopRecording, isSpeechRecording } from './audio.js';

/* ── CONSTANTS & DOM ELEMENTS ── */
const SCENARIOS = {
  fire: 'theres fire at building near 5th and main, smoke everywhere, one guy is down near the door',
  cyclone: '{"source":"NOAA","warning":"CYCLONE SEVERE","lat":-12.4,"lon":130.8}',
  casualty: 'Medic 4 confirming MCI at central station. multiple blast injuries.',
  bridge: "BRIDGE COLLAPSE I-95 SOUTH. Sensor node 42: structural integrity critical fail.",
  flood: 'DAM RELEASE NOTICE: upstream dam 9. flow rate 4000cfs.',
  gas: 'operator: 911 whats your emergency. caller: help i smell strong gas on elm st.',
};

const ELEMENTS = {
  apiKeyInput: document.getElementById('apiKeyInput'),
  saveKeyBtn: document.getElementById('saveKeyBtn'),
  keyStatusContainer: document.getElementById('keyStatusContainer'),
  textInput: document.getElementById('textInput'),
  pasteInput: document.getElementById('pasteInput'),
  voiceTranscript: document.getElementById('voiceTranscript'),
  micBtn: document.getElementById('micBtn'),
  waveform: document.getElementById('waveform'),
  voiceStatus: document.getElementById('voiceStatus'),
  dropZone: document.getElementById('dropZone'),
  fileInput: document.getElementById('fileInput'),
  imagePreview: document.getElementById('imagePreview'),
  photoDescription: document.getElementById('photoDescription'),
  processBtn: document.getElementById('processBtn'),
  exportJsonBtn: document.getElementById('exportJsonBtn'),
  copySummaryBtn: document.getElementById('copySummaryBtn'),
  newSignalBtn: document.getElementById('newSignalBtn'),
  historyToggleBtn: document.getElementById('historyToggleBtn'),
  closeHistoryBtn: document.getElementById('closeHistoryBtn'),
  historyDrawer: document.getElementById('historyDrawer'),
  sessionIndicator: document.getElementById('sessionIndicator'),
  tabs: document.querySelectorAll('.tab'),
  tabPanels: document.querySelectorAll('.tab-panel'),
  presets: document.querySelectorAll('.btn-preset')
};

let currentActiveTabId = 'tab-text';
let currentImageData = null;
let currentIncidentData = null;
let voiceDebounceTimeout = null;

/* ── FIRESTORE & AUTH ── */
/* 
  Modular import pattern via CDN (In an NPM project: import { initializeApp } from "firebase/app") 
*/
const firebaseConfig = { projectId: "YOUR_PROJECT_ID" }; // Add real keys
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

/**
 * Initializes remote Firebase systems and anon auth payload.
 */
function initFirebaseSystems() {
  auth.onAuthStateChanged((user) => {
    if (user) handleAuthOnline(user);
    else handleAuthOffline();
  });
  auth.signInAnonymously().catch(() => handleAuthOffline());
}

/**
 * Sets dynamic connection state for UI dot and hooks Firestore Snapshot.
 * @param {Object} user - Firebase User block
 */
function handleAuthOnline(user) {
  if (ELEMENTS.sessionIndicator) {
    ELEMENTS.sessionIndicator.className = 'session-dot online';
    ELEMENTS.sessionIndicator.title = 'Session Online';
  }
  db.collection("incidents").where("uid", "==", user.uid)
    .orderBy("created_at", "desc").limit(10)
    .onSnapshot((snap) => renderSnapshotStream(snap), () => {
      showInlineBanner('Offline Mode: Firebase history unlinked.', 'error');
    });
}

/**
 * Translates Firestore snapshot stream into History payload list.
 * @param {Object} snap - Collection snapshot frame
 */
function renderSnapshotStream(snap) {
  const historyArray = [];
  snap.forEach(doc => historyArray.push({
    id: doc.id,
    timestamp: doc.data().created_at?.toMillis() || Date.now(),
    data: doc.data()
  }));
  renderHistory(historyArray);
}

/**
 * Traps connection state fallbacks explicitly.
 */
function handleAuthOffline() {
  if (ELEMENTS.sessionIndicator) {
    ELEMENTS.sessionIndicator.className = 'session-dot offline';
    ELEMENTS.sessionIndicator.title = 'Session Offline';
  }
}

/**
 * Flushes active incident to Firestore asynchronously.
 * @param {Object} payload JSON AST
 * @param {string} id Incident hash
 */
async function syncToFirestore(payload, id) {
  if (!auth.currentUser) return;
  try {
    await db.collection("incidents").doc(id).set({
      ...payload,
      uid: auth.currentUser.uid,
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
      input_type: currentActiveTabId
    });
  } catch (err) {
    showInlineBanner('Firestore write failed. Tracking locally.', 'error');
  }
}

/* ── ANALYTICS ── */

/**
 * Streams exact AST match to Google BigQuery.
 * @param {Object} payload JSON AST
 * @param {string} id Incident hash
 * @param {number} timestamp Date tick
 */
async function syncToBigQuery(payload, id, timestamp) {
  try {
    const bqPath = `https://bigquery.googleapis.com/bigquery/v2/projects/${firebaseConfig.projectId}/datasets/aria_incidents/tables/parsed_signals/insertAll`;
    const res = await fetch(bqPath, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildBigQueryRow(payload, id, timestamp))
    });
    if (res.ok) showInlineBanner('Incident logged to BigQuery', 'info');
  } catch (err) { }
}

/**
 * Reconstructs AST to match strict BigQuery array schema format.
 * @param {Object} body AST payload
 * @param {string} id Hash string
 * @param {number} ts Milliseconds timestamp
 * @returns {Object} JSON payload dictionary
 */
function buildBigQueryRow(body, id, ts) {
  return { rows: [{
    insertId: id,
    json: {
      incidentId: id, timestamp: new Date(ts).toISOString(),
      uid: "anonymous", severity: body.severity,
      incident_title: body.incident_title, incident_type: body.incident_type,
      confidence_score: body.confidence_score,
      entities: JSON.stringify(body.entities || {}),
      plain_english_summary: body.plain_english_summary
    }
  }]};
}

/**
 * Publishes events to GA4 data layer strictly.
 * @param {string} name Event name
 * @param {Object} params GA4 tracking properties
 */
function trackEvent(name, params = {}) {
  if (typeof gtag !== 'undefined') gtag('event', name, params);
}

/* ── ORCHESTRATION ── */

/**
 * Top level aggregator triggering UI freeze, fetching, validation, and syncing.
 */
async function triggerSignalProcessing() {
  const cfg = getConfig();
  if (!cfg.geminiApiKey) return showInlineBanner('API Key is strictly required in config.', 'error');

  const payload = gatherInterfaceInputs();
  if (!payload.text && !payload.image) return showInlineBanner('Valid unformatted input required.', 'error');

  ELEMENTS.processBtn.disabled = true;
  document.getElementById('outputPanel').classList.add('hidden');
  trackEvent('signal_submitted', { input_type: currentActiveTabId });

  try {
    await orchestrateCloudFlow(payload, cfg.geminiApiKey);
  } catch (err) {
    clearProcessingLogs();
    showInlineBanner(err.message, 'error');
  } finally {
    ELEMENTS.processBtn.disabled = false;
  }
}

/**
 * Consolidates inputs safely sanitizing the raw contents explicitly.
 * @returns {Object} Input payload mapped by mode
 */
function gatherInterfaceInputs() {
  const out = { text: '', image: null };
  switch (currentActiveTabId) {
    case 'tab-text': out.text = ELEMENTS.textInput.value; break;
    case 'tab-paste': out.text = ELEMENTS.pasteInput.value; break;
    case 'tab-voice':
      out.text = ELEMENTS.voiceTranscript.value;
      if (isSpeechRecording()) forceStopRecording();
      break;
    case 'tab-photo':
      out.text = ELEMENTS.photoDescription.value || 'Describe this scene';
      out.image = currentImageData;
      break;
  }
  // Sanitize input to strip all HTML tags natively per security matrix
  if (out.text) out.text = out.text.replace(/<[^>]*>/g, '').trim();
  return out;
}

/**
 * Chains pre-processing Vision calls with core Gemini restructuring endpoints.
 * @param {Object} input Clean mapped payload
 * @param {string} apiKey Auth session key
 */
async function orchestrateCloudFlow(input, apiKey) {
  updateProcessingState('Establishing LLM connection link...');
  
  if (currentActiveTabId === 'tab-photo' && input.image) {
    updateProcessingState('Vision pre-processing sequence...');
    input = await interceptVisionPayload(input, apiKey);
  }

  updateProcessingState('Awaiting Gemini parsing parameters...');
  const rawResponse = await processSignalToGemini(input, apiKey);
  const ast = validateASTResponse(rawResponse);
  
  trackEvent('incident_parsed', { severity: ast.severity, incident_type: ast.incident_type });
  finalizeOutputUI(ast);
}

/**
 * Connects Vision REST wrapper and appends metadata text block securely.
 * @param {Object} basePayload Raw text and ML b64 string
 * @param {string} key Active API hash
 * @returns {Promise<Object>} Formatted string mapped payload explicitly enriched
 */
async function interceptVisionPayload(basePayload, key) {
  try {
    const block = await processSignalToVisionAPI(basePayload.image.data, key);
    let str = '--- VISION API DETECTIONS ---\n';
    if (block.labelAnnotations) str += `Labels: ${block.labelAnnotations.map(l => l.description).join(',')}\n`;
    if (block.textAnnotations?.length) str += `Text: ${block.textAnnotations[0].description}\n`;
    str += '-----------------------------\n';
    basePayload.text = str + basePayload.text;
  } catch (err) {
    showInlineBanner('Vision API failure avoided, skipping context enrichment', 'info');
  }
  return basePayload;
}

/**
 * Validates AST strictly throwing explicit boundary errors.
 * @param {string} raw Raw markdown text explicitly returned from Gemini
 * @returns {Object} Verified matching dictionary
 * @throws {Error} Strict JSON structural mismatch
 */
function validateASTResponse(raw) {
  const parsed = extractAndParseJSON(raw);
  if (!validateSchema(parsed)) throw new Error('Schema Violation: Return output was malformed.');
  return parsed;
}

/**
 * Updates DOM logic state successfully reporting completion.
 * @param {Object} ast Verified data mapping
 */
function finalizeOutputUI(ast) {
  currentIncidentData = ast;
  const id = generateIncidentId();
  const ts = Date.now();
  renderOutputCard(ast, id, ts);
  syncToFirestore(ast, id);
  syncToBigQuery(ast, id, ts);
}

/* ── DOM & EVENTS ── */

/**
 * Master bind event routing logic hooking explicitly requested interactive logic.
 */
function initEventListeners() {
  document.addEventListener('DOMContentLoaded', () => {
    initFirebaseSystems();
    initSpeechRouting();
    bindHeaderEvents();
    bindTabs();
    bindPresets();
    bindDropHooks();
    bindActionAreaEvents();
  });
  
  // Security protocol requirement
  window.addEventListener('beforeunload', () => clearSession());
}

/**
 * Binds config bar toggles safely mapping.
 */
function bindHeaderEvents() {
  if (getConfig().geminiApiKey) ELEMENTS.keyStatusContainer.textContent = 'Key Local ✓';
  
  ELEMENTS.saveKeyBtn.addEventListener('click', () => {
    if (saveApiKey(ELEMENTS.apiKeyInput.value.trim())) {
      ELEMENTS.keyStatusContainer.textContent = 'Key Saved ✓';
      ELEMENTS.apiKeyInput.value = '********';
    }
  });

  ELEMENTS.historyToggleBtn.addEventListener('click', () => {
    ELEMENTS.historyDrawer.classList.toggle('open');
  });
  ELEMENTS.closeHistoryBtn.addEventListener('click', () => {
    ELEMENTS.historyDrawer.classList.remove('open');
  });
}

/**
 * Swaps UI container elements specifically mapping semantic relationships.
 */
function bindTabs() {
  ELEMENTS.tabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      ELEMENTS.tabs.forEach(t => t.classList.remove('active'));
      ELEMENTS.tabPanels.forEach(p => p.classList.add('hidden'));
      e.target.classList.add('active');
      currentActiveTabId = e.target.getAttribute('aria-controls');
      document.getElementById(currentActiveTabId).classList.remove('hidden');
    });
  });
}

/**
 * Attaches payload injectors safely avoiding AST execution faults.
 */
function bindPresets() {
  ELEMENTS.presets.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const mode = e.target.getAttribute('data-preset');
      const text = SCENARIOS[mode];
      trackEvent('preset_loaded', { preset_name: mode });
      if (mode === 'cyclone') {
        document.getElementById('btn-tab-paste').click();
        ELEMENTS.pasteInput.value = text;
      } else {
        document.getElementById('btn-tab-text').click();
        ELEMENTS.textInput.value = text;
      }
    });
  });
}

/**
 * Attaches asynchronous drag rules for dropping ML payloads safely.
 */
function bindDropHooks() {
  ELEMENTS.dropZone.addEventListener('dragover', e => { e.preventDefault(); ELEMENTS.dropZone.classList.add('drag-over'); });
  ELEMENTS.dropZone.addEventListener('dragleave', () => { ELEMENTS.dropZone.classList.remove('drag-over'); });
  ELEMENTS.dropZone.addEventListener('drop', async e => {
    e.preventDefault();
    ELEMENTS.dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files?.[0]) await triggerImageIngestion(e.dataTransfer.files[0]);
  });
  ELEMENTS.dropZone.addEventListener('click', () => ELEMENTS.fileInput.click());
  ELEMENTS.fileInput.addEventListener('change', async e => {
    if (e.target.files?.[0]) await triggerImageIngestion(e.target.files[0]);
  });
}

/**
 * Parses files visually tracking local variables dynamically rendering states.
 * @param {File} file Target blob memory location
 */
async function triggerImageIngestion(file) {
  try {
    currentImageData = await handleFileSelect(file);
    ELEMENTS.imagePreview.src = currentImageData.url;
    ELEMENTS.imagePreview.classList.remove('hidden');
    ELEMENTS.dropZone.querySelector('.drop-text').classList.add('hidden');
  } catch (err) {
    showInlineBanner(err.message, 'error');
  }
}

/**
 * Connects Web API specifically bounding microphone state maps natively.
 */
function initSpeechRouting() {
  initSpeechRecognition(
    (f, i) => {
      clearTimeout(voiceDebounceTimeout);
      voiceDebounceTimeout = setTimeout(() => { ELEMENTS.voiceTranscript.value = f + i; }, 300);
    },
    (err) => { showInlineBanner(`Mic blocked: ${err}`, 'error'); forceStopRecording(); },
    () => { forceStopRecording(); }
  );
  ELEMENTS.micBtn.addEventListener('click', () => {
    if (isSpeechRecording()) forceStopRecording();
    else forceStartRecording();
  });
}

/**
 * Starts audio interface binding safely tracking interface flags.
 */
function forceStartRecording() {
  if (startRecording()) {
    ELEMENTS.micBtn.classList.add('recording');
    ELEMENTS.waveform.classList.remove('hidden');
    ELEMENTS.voiceStatus.textContent = 'Listening live...';
    ELEMENTS.voiceTranscript.value = '';
  }
}

/**
 * Shuts down asynchronous loop interfaces mapping correctly terminating.
 */
function forceStopRecording() {
  stopRecording();
  ELEMENTS.micBtn.classList.remove('recording');
  ELEMENTS.waveform.classList.add('hidden');
  ELEMENTS.voiceStatus.textContent = 'Recording Stopped';
}

/**
 * Dispatches core processor hook specifically hooking AST translation routes.
 */
function bindActionAreaEvents() {
  ELEMENTS.processBtn.addEventListener('click', triggerSignalProcessing);
  
  ELEMENTS.exportJsonBtn.addEventListener('click', () => {
    if (!currentIncidentData) return;
    trackEvent('action_exported');
    const b = new Blob([JSON.stringify(currentIncidentData, null, 2)], { type: 'application/json' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u; a.download = `aria-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(u);
  });

  ELEMENTS.copySummaryBtn.addEventListener('click', async () => {
    if (!currentIncidentData) return;
    try { await navigator.clipboard.writeText(currentIncidentData.plain_english_summary); showInlineBanner('Summary copied.', 'info'); } 
    catch { showInlineBanner('Clipboard access denied.', 'error'); }
  });

  ELEMENTS.newSignalBtn.addEventListener('click', () => location.reload()); // Quick clear
}

initEventListeners();
