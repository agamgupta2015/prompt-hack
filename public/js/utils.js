/* ── UTILS ── */

/**
 * Extracts raw JSON from a string that may contain markdown blocks.
 * @param {string} text - Raw output string from Gemini
 * @returns {Object} Parsed JSON dictionary
 * @throws {Error} If valid JSON format is missing or corrupted
 */
export function extractAndParseJSON(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Input validation: Required string missing.');
  }

  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  try {
    if (match && match[1]) return JSON.parse(match[1]);
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Parse failure format mismatch: ${error.message}`);
  }
}

/**
 * Validates the core schema required for rendering.
 * @param {Object} data - Parsed JSON object
 * @returns {boolean} True if all required fields are present
 */
export function validateIncidentJSON(data) {
  if (!data || typeof data !== 'object') return false;

  const required = [
    'severity',
    'incident_title',
    'incident_type',
    'confidence_score',
  ];

  return required.every((field) => field in data);
}

/**
 * Generates a unique short ID for indexing incidents.
 * @returns {string} Formatted string like INC-TIMESTAMP-HASH
 */
export function generateIncidentId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INC-${timestamp}-${randomStr}`;
}

/**
 * Strips HTML tags and trims whitespace from user input.
 * @param {string} raw - Unsanitized string
 * @returns {string} Clean string
 */
export function sanitizeInput(raw) {
  if (!raw) return '';
  return raw.replace(/<[^>]*>/g, '').trim();
}

/**
 * Maps raw severity string to known constraints.
 * @param {string} sev - Raw value
 * @returns {string} Normalized severity
 */
export function parseSeverity(sev) {
  const clean = String(sev).toUpperCase();
  if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(clean)) return clean;
  return 'UNKNOWN';
}

/**
 * Formats timestamp integer cleanly.
 * @param {number} ts - Epoch time
 * @returns {string} HH:MM:SS format
 */
export function formatTimestamp(ts) {
  return new Date(ts).toLocaleTimeString();
}

/**
 * Computes color hex or variable string based on confidence score.
 * @param {number} score - 0.0 to 1.0
 * @returns {string} CSS color var
 */
export function calculateConfidenceColor(score) {
  if (typeof score !== 'number' || score < 0 || score > 1.0) return 'var(--c-text-muted)';
  if (score >= 0.8) return 'var(--c-accent-green)';
  if (score >= 0.5) return 'var(--c-accent-amber)';
  return 'var(--c-accent-red)';
}
