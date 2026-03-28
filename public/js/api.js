/* ── GEMINI ── */

const GEMINI_API_URL = 'https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/processSignal';

const SYS_PROMPT = `You are ARIA. Convert unstructured data to structured JSON matching the defined schema exactly. Never include text outside the JSON.`;

/**
 * Constructs the core instruction payload for the LLM.
 * @param {Object} inputData - Structured dictionary of text/image
 * @returns {Object} JSON strict payload
 */
export function buildGeminiPayload(inputData) {
  const parts = [];
  if (inputData.text) parts.push({ text: inputData.text });
  if (inputData.image) {
    parts.push({
      inlineData: {
        mimeType: inputData.image.mimeType,
        data: inputData.image.data,
      },
    });
  }

  return {
    systemInstruction: { parts: [{ text: SYS_PROMPT }] },
    contents: [{ parts }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  };
}

/**
 * Handles explicit HTTP error ranges and formats responses.
 * @param {Response} response - Fetch response object
 * @throws {Error} specific HTTP network errors
 */
export async function handleHttpError(response) {
  if (response.status === 400) throw new Error('HTTP 400: Malformed Request.');
  if (response.status === 401) throw new Error('HTTP 401: Unauthorized API Key.');
  if (response.status === 403) throw new Error('HTTP 403: Forbidden access.');
  if (response.status === 429) throw new Error('HTTP 429: Rate limit hit, retry in 30s.');
  if (response.status >= 500) throw new Error('HTTP 500: Google Cloud server failure.');
  throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
}

/**
 * Safely executes the API proxy block and checks network health.
 * @param {string} url - Target fetch URL
 * @param {Object} payload - Body dictionary
 * @returns {Response} Raw response object
 * @throws {Error} if network is physically inaccessible
 */
export async function executeFetch(url, payload) {
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (netErr) {
    throw new Error('NETWORK_FAILURE: Unable to reach Google Services. Check connection.');
  }
}

/**
 * Orchestrates the Gemini REST API proxy interaction.
 * @param {Object} inputData - { text, image }
 * @param {string} apiKey - Target key (passed or proxied)
 * @returns {Promise<string>} The raw markdown string
 * @throws {Error} For HTTP, Network, or Parse faults
 */
export async function processSignalToGemini(inputData, apiKey) {
  if (!apiKey) throw new Error('API Key is missing from Config.');
  const payload = buildGeminiPayload(inputData);
  
  const response = await executeFetch(GEMINI_API_URL, payload);
  if (!response.ok) await handleHttpError(response);
  
  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error('Parse error: Cloud returned invalid JSON boundary.');
  }

  if (!data.candidates || !data.candidates.length) {
    throw new Error('API Error: No textual candidates returned from Gemini.');
  }
  return data.candidates[0].content.parts[0].text;
}

/* ── VISION ── */

/**
 * Formats the strict Google Vision API payload block.
 * @param {string} b64 - Base64 encoded byte map
 * @returns {Object} Vision REST format
 */
export function buildVisionPayload(b64) {
  return {
    requests: [
      {
        image: { content: b64 },
        features: [
          { type: 'LABEL_DETECTION', maxResults: 10 },
          { type: 'TEXT_DETECTION' },
          { type: 'OBJECT_LOCALIZATION' }
        ]
      }
    ]
  };
}

/**
 * Fires request to Cloud Vision to interpret imagery autonomously.
 * @param {string} base64Image - Encoded map
 * @param {string} apiKey - API Key
 * @returns {Promise<Object>} Single response JSON node
 * @throws {Error} Explicit networking errors
 */
export async function processSignalToVisionAPI(base64Image, apiKey) {
  if (!apiKey) throw new Error('API Key required for ML Vision.');
  const payload = buildVisionPayload(base64Image);
  const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
  
  const response = await executeFetch(url, payload);
  if (!response.ok) await handleHttpError(response);

  let data;
  try { data = await response.json(); } 
  catch (e) { throw new Error('Vision error: corrupted JSON chunk.'); }

  if (!data.responses || !data.responses.length) {
    throw new Error('Vision Error: API returned empty analysis block.');
  }
  return data.responses[0];
}
