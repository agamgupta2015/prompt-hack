/**
 * LocalStorage and SessionStorage adapters
 */

const HISTORY_KEY = 'aria_incident_history';
const KEY_STORE = 'gemini_api_key';
const MAX_HISTORY = 5;

export function getApiKey() {
  return sessionStorage.getItem(KEY_STORE) || '';
}

export function saveApiKey(key) {
  if (!key) return false;
  sessionStorage.setItem(KEY_STORE, key);
  return true;
}

export function clearApiKey() {
  sessionStorage.removeItem(KEY_STORE);
}

export function saveToHistory(record) {
  let history = getHistory();

  // unshift adds to beginning
  history.unshift(record);

  // enforce max items limit
  if (history.length > MAX_HISTORY) {
    history = history.slice(0, MAX_HISTORY);
  }

  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function getHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    console.warn('Failed to parse localStorage history.');
    return [];
  }
}
