/* ── STORAGE ── */

const KEY_STORE = 'gemini_api_key';

/**
 * Retrieves the global configuration object containing keys.
 * @returns {Object} Config dictionary
 */
export function getConfig() {
  return {
    geminiApiKey: sessionStorage.getItem(KEY_STORE) || '',
  };
}

/**
 * Saves the runtime API key securely.
 * @param {string} key - The raw API key
 * @returns {boolean} Truthy save state
 */
export function saveApiKey(key) {
  if (!key) return false;
  sessionStorage.setItem(KEY_STORE, key);
  return true;
}

/**
 * Clears volatile session store on demand or unload.
 */
export function clearSession() {
  sessionStorage.clear();
}
