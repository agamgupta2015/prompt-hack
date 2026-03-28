/**
 * DOM manipulation and View presentation
 */

/**
 * Creates an element with optional classes and text content
 */
function createElement(tag, classes = [], textContent = '') {
  const el = document.createElement(tag);
  if (classes.length) {
    el.classList.add(...classes);
  }
  if (textContent) {
    el.textContent = textContent;
  }
  return el;
}

/**
 * Updates an element's text content securely
 */
function setContentSecure(elementId, content) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = content || '';
}

/**
 * Show a toast message to the user
 */
export function showToast(message, type = 'error') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type === 'info' ? 'info' : ''}`;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

/**
 * Render the entire output card
 */
export function renderOutputCard(data, incidentId, timestamp) {
  // Hide processed state and show output panel in "reset" state first
  document.getElementById('processingState').classList.add('hidden');
  const panel = document.getElementById('outputPanel');

  // Re-trigger CSS animations by removing and adding class
  panel.classList.add('hidden');
  // force reflow
  void panel.offsetWidth;
  panel.classList.remove('hidden');

  // 1. Header & Meta
  const badge = document.getElementById('severityBadge');
  badge.className = `badge-severity severity-${data.severity}`;
  const badgeSpan = badge.querySelector('span');
  if (badgeSpan) badgeSpan.textContent = data.severity;
  else badge.innerHTML = `<span>${data.severity}</span>`;

  setContentSecure('incidentTitle', data.incident_title);
  setContentSecure('incidentType', data.incident_type);
  setContentSecure('incidentId', incidentId);
  setContentSecure('timestamp', new Date(timestamp).toLocaleTimeString());

  // 2. Summary
  setContentSecure('plainSummary', data.plain_english_summary);

  // 3. Entities
  const entitiesList = document.getElementById('entitiesList');
  entitiesList.innerHTML = '';
  Object.entries(data.entities || {}).forEach(([category, items]) => {
    if (Array.isArray(items)) {
      items.forEach((item) => {
        entitiesList.appendChild(
          createElement(
            'span',
            ['tag', `tag-${category}`],
            `${category}: ${item}`
          )
        );
      });
    }
  });

  // Google Maps Embed API Integration
  const entitiesGrid = document.querySelector('.entities-grid');
  let mapContainer = document.getElementById('mapContainer');
  if (!mapContainer) {
    mapContainer = createElement('div');
    mapContainer.id = 'mapContainer';
    entitiesGrid.appendChild(mapContainer);
  }
  mapContainer.innerHTML = '';

  if (data.entities && data.entities.locations && data.entities.locations.length > 0) {
    const q = encodeURIComponent(data.entities.locations[0]);
    // The Google Maps API key must be HTTP-referrer restricted in Google Cloud Console
    mapContainer.innerHTML = `
      <h4>Location Context</h4>
      <iframe
        width="100%"
        height="250"
        style="border: 1px solid var(--c-border); border-radius: var(--radius-sm); margin-top: var(--space-xs); display: block;"
        loading="lazy"
        allowfullscreen
        referrerpolicy="no-referrer-when-downgrade"
        src="https://www.google.com/maps/embed/v1/place?key=YOUR_MAPS_API_KEY&q=${q}">
      </iframe>
    `;
  }

  // 4. Verification Facts & Claims
  const factsList = document.getElementById('verifiedFacts');
  factsList.innerHTML = '';
  (data.verified_facts || []).forEach((f) => {
    const li = createElement('li');
    const content = createElement('div', ['fact-content']);
    content.innerHTML = `<span class="icon-fact">✓</span><span>${f.fact}</span>`;

    const confBar = createElement('div', ['confidence-bar']);
    const confFill = createElement('div', ['confidence-fill']);
    confFill.style.width = `${f.confidence * 100}%`;
    confBar.appendChild(confFill);

    li.appendChild(content);
    li.appendChild(confBar);
    factsList.appendChild(li);
  });

  const claimsList = document.getElementById('unverifiedClaims');
  claimsList.innerHTML = '';
  (data.unverified_claims || []).forEach((c) => {
    const li = createElement('li');
    const content = createElement('div', ['fact-content']);
    content.innerHTML = `<span class="icon-claim">~</span><span>${c.claim}</span>`;

    const confBar = createElement('div', ['confidence-bar']);
    const confFill = createElement('div', ['confidence-fill']);
    confFill.style.width = `${c.confidence * 100}%`;
    confFill.style.background = 'var(--c-accent-amber)';
    confBar.appendChild(confFill);

    li.appendChild(content);
    li.appendChild(confBar);
    claimsList.appendChild(li);
  });

  // 5. Action Queue
  const queue = document.getElementById('actionQueue');
  queue.innerHTML = '';
  // Sort by priority just in case
  const actions = [...(data.action_queue || [])].sort(
    (a, b) => a.priority - b.priority
  );
  actions.forEach((a) => {
    const li = createElement('li', [`action-urgency-${a.urgency}`]);
    const p = createElement('p', [], a.action);
    const meta = createElement('div', ['action-meta']);
    meta.innerHTML = `<span>Owner: ${a.owner}</span> | <span>Urgency: ${a.urgency}</span> | <span>ETA: ${a.eta_minutes} min</span>`;
    li.appendChild(p);
    li.appendChild(meta);
    queue.appendChild(li);
  });

  // 6. Notify
  const notifyList = document.getElementById('notifyList');
  notifyList.innerHTML = '';
  (data.notify || []).forEach((n) => {
    const li = createElement('li');
    const entity = createElement('span', ['notify-entity'], n.entity);
    const meta = createElement(
      'span',
      ['notify-meta'],
      `Method: ${n.method} | Urgency: ${n.urgency}`
    );
    li.appendChild(entity);
    li.appendChild(meta);
    notifyList.appendChild(li);
  });

  // 7. Auto Tags
  const autoTagsElem = document.getElementById('autoTags');
  autoTagsElem.innerHTML = '';
  (data.auto_tags || []).forEach((t) => {
    autoTagsElem.appendChild(
      createElement('span', ['code-text'], `#${t.replace(/\s+/g, '_')} `)
    );
  });
}

/**
 * Updates the processing state rings and logs
 */
export function updateProcessingState(logMessage) {
  const panel = document.getElementById('processingState');
  panel.classList.remove('hidden');

  const logsContainer = document.getElementById('processingLogs');
  const line = createElement('div', ['log-line'], `> ${logMessage}`);
  logsContainer.appendChild(line);

  // Scroll to bottom of logs
  logsContainer.scrollTop = logsContainer.scrollHeight;
  if (logsContainer.children.length > 5) {
    logsContainer.removeChild(logsContainer.firstChild); // Keep it clean
  }
}

export function clearProcessingLogs() {
  document.getElementById('processingLogs').innerHTML = '';
  document.getElementById('processingState').classList.add('hidden');
}

/**
 * Renders the History Drawer List
 */
export function renderHistory(historyArray) {
  const list = document.getElementById('historyList');
  list.innerHTML = '';
  if (historyArray.length === 0) {
    list.innerHTML = '<li class="code-text">No recorded incidents</li>';
    return;
  }

  historyArray.forEach((item) => {
    const li = createElement('li', ['history-item']);
    li.innerHTML = `
      <div class="history-item-title">${item.data.incident_title}</div>
      <div class="history-item-meta">
        <span>${item.data.severity}</span>
        <span>${new Date(item.timestamp).toLocaleString()}</span>
      </div>
    `;
    list.appendChild(li);
  });
}

/**
 * Render Vision API detected labels dynamically above image drop zone
 */
export function renderVisionLabels(labels) {
  let container = document.getElementById('visionTagsContainer');
  if (!container) {
    const dropZone = document.getElementById('dropZone');
    container = createElement('div', ['tags-container']);
    container.id = 'visionTagsContainer';
    container.style.marginTop = 'var(--space-sm)';
    container.style.marginBottom = 'var(--space-sm)';
    dropZone.parentNode.insertBefore(container, dropZone);
  }
  container.innerHTML = '';
  
  if (!labels || labels.length === 0) return;
  
  labels.forEach(l => {
    container.appendChild(
      createElement('span', ['tag', 'tag-resources'], `👁️ ${l.description}`)
    );
  });
}
