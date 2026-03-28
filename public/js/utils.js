/**
 * Extracts raw JSON from a string that may contain markdown codeblocks or surrounding text.
 * @param {string} text - The raw text from the LLM.
 * @returns {Object} - Parsed JSON object.
 * @throws {Error} - If no valid JSON is found.
 */
export function extractAndParseJSON(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: text required.');
  }

  // Try to find markdown json block
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  try {
    if (match && match[1]) {
      return JSON.parse(match[1]);
    }
    // Fallback: try to parse the entire text if it's already clean JSON
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Failed to parse structured response: ${error.message}`);
  }
}

/**
 * Validates the core schema returned by the LLM.
 * @param {Object} data - The parsed JSON object.
 * @returns {boolean}
 */
export function validateSchema(data) {
  if (!data || typeof data !== 'object') return false;

  const requiredFields = [
    'severity',
    'incident_title',
    'incident_type',
    'confidence_score',
    'action_queue',
  ];

  return requiredFields.every((field) => field in data);
}

/**
 * Creates an initial intelligence card skeleton to prevent null errors
 */
export function createEmptyCard() {
  return {
    severity: 'LOW',
    incident_title: 'Unidentified Incident',
    incident_type: 'Unknown',
    confidence_score: 0.0,
    entities: {
      people: [],
      locations: [],
      times: [],
      resources_needed: [],
      organisations: [],
    },
    verified_facts: [],
    unverified_claims: [],
    action_queue: [],
    notify: [],
    plain_english_summary: 'No data available.',
    auto_tags: [],
  };
}

/**
 * Generates a unique short ID based on timestamp and random string
 */
export function generateIncidentId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INC-${timestamp}-${randomStr}`;
}
