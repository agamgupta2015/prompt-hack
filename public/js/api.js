const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const SYSTEM_PROMPT = `You are ARIA, an emergency intelligence parsing system. You receive messy, unstructured real-world input of any type — voice transcripts, weather data, traffic reports, field notes, social media posts, or mixed signals — and convert them into a precise, structured JSON action plan.

Always respond with ONLY valid JSON in this exact schema:
{
  "severity": "CRITICAL|HIGH|MEDIUM|LOW",
  "incident_title": "string (max 6 words)",
  "incident_type": "string (e.g. Fire, Flood, Medical, Traffic, Infrastructure, Environmental, Civil)",
  "confidence_score": number (0.0 to 1.0),
  "entities": {
    "people": ["string"],
    "locations": ["string"],
    "times": ["string"],
    "resources_needed": ["string"],
    "organisations": ["string"]
  },
  "verified_facts": [
    { "fact": "string", "confidence": number }
  ],
  "unverified_claims": [
    { "claim": "string", "confidence": number }
  ],
  "action_queue": [
    {
      "priority": number,
      "action": "string",
      "owner": "string (role, e.g. Fire Department, Hospital, Police)",
      "urgency": "IMMEDIATE|URGENT|ROUTINE",
      "eta_minutes": number
    }
  ],
  "notify": [
    {
      "entity": "string",
      "method": "string (Call|SMS|Radio|App)",
      "urgency": "IMMEDIATE|URGENT|ROUTINE"
    }
  ],
  "plain_english_summary": "string (2-3 sentences, jargon-free)",
  "auto_tags": ["string"]
}

Never include any text outside the JSON. Be decisive. When uncertain, lower confidence score rather than omitting data.`;

/**
 * Builds the payload for the Gemini API call based on whether the input is text or image.
 */
function buildPayload(inputData) {
  const parts = [];

  if (inputData.text) {
    parts.push({ text: inputData.text });
  }

  if (inputData.image) {
    // image format: { mimeType: "image/jpeg", data: "base64..." }
    parts.push({
      inlineData: {
        mimeType: inputData.image.mimeType,
        data: inputData.image.data,
      },
    });
  }

  return {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        parts: parts,
      },
    ],
    generationConfig: {
      temperature: 0.1, // Strict precision
      responseMimeType: 'application/json',
    },
  };
}

/**
 * Initiates the request to the Gemini API.
 * @param {Object} inputData - { text: string, image: { mimeType, data } }
 * @param {string} apiKey
 * @returns {Promise<string>} raw response text
 */
export async function processSignalToGemini(inputData, apiKey) {
  if (!apiKey) {
    throw new Error('API Key is missing. Please save it in the header.');
  }

  const payload = buildPayload(inputData);

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 400)
      throw new Error('Bad Request: Invalid format or API Key format.');
    if (response.status === 401)
      throw new Error('Unauthorized: Invalid API Key.');
    if (response.status === 429)
      throw new Error('Rate Limit Exceeded: Quota reached.');
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('No candidates returned from Gemini LLM.');
  }

  return data.candidates[0].content.parts[0].text;
}
