/* ── UI ── */

/**
 * Safely creates an isolated DOM element.
 * @param {string} tag - Tag name
 * @param {string[]} classes - Array of class names
 * @param {string} text - Safe text content
 * @returns {HTMLElement} Built element
 */
export function createElement(tag, classes = [], text = '') {
  const el = document.createElement(tag);
  if (classes.length) el.classList.add(...classes);
  if (text) el.textContent = text;
  return el;
}

/**
 * Renders an inline error banner replacing floating toasts.
 * @param {string} message - Error description
 * @param {string} type - 'error' or 'info'
 */
export function showInlineBanner(message, type = 'error') {
  const banner = document.getElementById('errorBanner');
  if (!banner) return;
  banner.textContent = message;
  banner.className = `error-banner ${type === 'info' ? 'info' : 'error'}`;
  banner.classList.remove('hidden');
  setTimeout(() => banner.classList.add('hidden'), 5000);
}

/**
 * Controls the animated processing rings.
 * @param {string} msg - Step description
 */
export function updateProcessingState(msg) {
  const panel = document.getElementById('processingState');
  const logs = document.getElementById('processingLogs');
  if (!panel || !logs) return;
  panel.classList.remove('hidden');
  logs.appendChild(createElement('div', ['log-line'], `> ${msg}`));
  logs.scrollTop = logs.scrollHeight;
  if (logs.children.length > 5) logs.removeChild(logs.firstChild);
}

/**
 * Resets the loading interface.
 */
export function clearProcessingLogs() {
  const panel = document.getElementById('processingState');
  const logs = document.getElementById('processingLogs');
  if (panel) panel.classList.add('hidden');
  if (logs) logs.innerHTML = '';
}

/**
 * Renders the Intelligence Card payload.
 * @param {Object} data - Processed AST
 * @param {string} id - Hash
 * @param {number} ts - Epoch timestamp
 */
export function renderOutputCard(data, id, ts) {
  clearProcessingLogs();
  const panel = document.getElementById('outputPanel');
  panel.classList.add('hidden');
  void panel.offsetWidth; // Reflow
  panel.classList.remove('hidden');

  renderCardMeta(data, id, ts);
  renderEntities(data);
  renderVerifications(data);
  renderActionQueue(data);
}

/**
 * Binds AST metadata to DOM skeleton.
 * @param {Object} data - AST
 * @param {string} id - Hash
 * @param {number} ts - Epoch
 */
function renderCardMeta(data, id, ts) {
  const badge = document.getElementById('severityBadge');
  badge.className = `badge-severity severity-${data.severity}`;
  badge.innerHTML = `<span>${data.severity}</span>`;

  document.getElementById('incidentTitle').textContent = data.incident_title;
  document.getElementById('incidentType').textContent = data.incident_type;
  document.getElementById('incidentId').textContent = id;
  document.getElementById('timestamp').textContent = new Date(ts).toLocaleTimeString();
  document.getElementById('plainSummary').textContent = data.plain_english_summary;
}

/**
 * Fragments and attaches extracted entities.
 * @param {Object} data - AST
 */
function renderEntities(data) {
  const list = document.getElementById('entitiesList');
  const frag = document.createDocumentFragment();
  list.innerHTML = '';
  
  Object.entries(data.entities || {}).forEach(([cat, items]) => {
    if (Array.isArray(items)) {
      items.forEach(i => frag.appendChild(createElement('span', ['tag', `tag-${cat}`], `${cat}: ${i}`)));
    }
  });
  list.appendChild(frag);
  renderMaps(data);
}

/**
 * Attaches Google Maps Iframe if locations exist.
 * @param {Object} data - AST
 */
function renderMaps(data) {
  let mapC = document.getElementById('mapContainer');
  if (!mapC) {
    mapC = createElement('div');
    mapC.id = 'mapContainer';
    document.querySelector('.entities-grid').appendChild(mapC);
  }
  mapC.innerHTML = '';
  if (data.entities?.locations?.length > 0) {
    const q = encodeURIComponent(data.entities.locations[0]);
    mapC.innerHTML = `<h4>Location</h4><iframe width="100%" height="250" loading="lazy" src="https://www.google.com/maps/embed/v1/place?key=YOUR_MAPS_API_KEY&q=${q}"></iframe>`;
  }
}

/**
 * Fragments verification arrays.
 * @param {Object} data - AST
 */
function renderVerifications(data) {
  const factList = document.getElementById('verifiedFacts');
  const claimList = document.getElementById('unverifiedClaims');
  factList.innerHTML = ''; claimList.innerHTML = '';
  
  const fFrag = document.createDocumentFragment();
  (data.verified_facts || []).forEach(f => fFrag.appendChild(buildConfListItem(f.fact, f.confidence, false)));
  factList.appendChild(fFrag);

  const cFrag = document.createDocumentFragment();
  (data.unverified_claims || []).forEach(c => cFrag.appendChild(buildConfListItem(c.claim, c.confidence, true)));
  claimList.appendChild(cFrag);
}

/**
 * Constructs a confidence bar element block.
 * @param {string} text - Claim/Fact text
 * @param {number} conf - Float rating
 * @param {boolean} isClaim - Amber vs Green style
 * @returns {HTMLElement} Built list item
 */
function buildConfListItem(text, conf, isClaim) {
  const li = createElement('li');
  const c = createElement('div', ['fact-content']);
  c.innerHTML = `<span>${isClaim ? '~' : '✓'}</span><span>${text}</span>`;
  const b = createElement('div', ['confidence-bar']);
  const f = createElement('div', ['confidence-fill']);
  f.style.width = `${conf * 100}%`;
  if (isClaim) f.style.background = 'var(--c-accent-amber)';
  b.appendChild(f);
  li.appendChild(c); li.appendChild(b);
  return li;
}

/**
 * Fragments Action Queue.
 * @param {Object} data - AST
 */
function renderActionQueue(data) {
  const q = document.getElementById('actionQueue');
  const frag = document.createDocumentFragment();
  q.innerHTML = '';

  const actions = [...(data.action_queue || [])].sort((a, b) => a.priority - b.priority);
  actions.forEach(a => {
    const li = createElement('li', [`action-urgency-${a.urgency}`]);
    li.appendChild(createElement('p', [], a.action));
    const m = createElement('div', ['action-meta']);
    m.innerHTML = `<span>${a.owner}</span> | <span>${a.urgency}</span> | <span>${a.eta_minutes}m</span>`;
    li.appendChild(m);
    frag.appendChild(li);
  });
  q.appendChild(frag);
  renderNotifyList(data);
}

/**
 * Fragments Notification and Tag blocks.
 * @param {Object} data - AST
 */
function renderNotifyList(data) {
  const nl = document.getElementById('notifyList');
  const nf = document.createDocumentFragment();
  nl.innerHTML = '';
  (data.notify || []).forEach(n => {
    const li = createElement('li');
    li.appendChild(createElement('span', ['notify-entity'], n.entity));
    li.appendChild(createElement('span', ['notify-meta'], `${n.method} | ${n.urgency}`));
    nf.appendChild(li);
  });
  nl.appendChild(nf);

  const at = document.getElementById('autoTags');
  at.innerHTML = '';
  const atf = document.createDocumentFragment();
  (data.auto_tags || []).forEach(t => atf.appendChild(createElement('span', ['code-text'], `#${t.replace(/\s+/g,'_')} `)));
  at.appendChild(atf);
}

/**
 * Fragments History Drawer synchronization.
 * @param {Array} history - Array of mapped AST datasets
 */
export function renderHistory(history) {
  const list = document.getElementById('historyList');
  if (!history.length) {
    list.innerHTML = '<li class="code-text">No recorded incidents</li>';
    return;
  }
  const frag = document.createDocumentFragment();
  list.innerHTML = '';
  history.forEach(item => {
    const li = createElement('li', ['history-item']);
    li.innerHTML = `<div class="history-item-title">${item.data.incident_title}</div><div class="history-item-meta"><span>${item.data.severity}</span><span>${new Date(item.timestamp).toLocaleString()}</span></div>`;
    frag.appendChild(li);
  });
  list.appendChild(frag);
}
