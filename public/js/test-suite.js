/**
 * ARIA AUTOMATED TEST SUITE
 * Triggers cleanly when ?test=true
 */

import { sanitizeInput, parseSeverity, formatTimestamp, validateIncidentJSON, calculateConfidenceColor } from './utils.js';
import { buildGeminiPayload } from './api.js';

if (window.location.search.includes('test=true')) {
  document.addEventListener('DOMContentLoaded', runTests);
}

const TESTS = [];
let passCount = 0;
let failCount = 0;

function describe(name, fn) {
  try {
    fn();
    TESTS.push({ name, status: 'PASS' });
    passCount++;
  } catch (err) {
    TESTS.push({ name, status: 'FAIL', reason: err.message });
    failCount++;
  }
}

function expect(actual) {
  return {
    toBe: (expected) => { if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`); },
    toContain: (expected) => { if (!actual.includes(expected)) throw new Error(`String missing ${expected}`); },
    toEqual: (expected) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Object mismatch`); },
    toBeTruthy: () => { if (!actual) throw new Error(`Expected truthy, got falsy`); },
    toBeFalsy: () => { if (actual) throw new Error(`Expected falsy, got truthy`); }
  };
}

function renderDashboard() {
  const html = `
    <div id="test-dashboard" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(10,10,12,0.95);z-index:9999;color:#fff;overflow-y:auto;padding:40px;font-family:monospace;">
      <h1 style="color:#00ff9d;margin-bottom:20px;">ARIA TEST SUITE EXECUTION</h1>
      <div style="display:flex;gap:20px;margin-bottom:30px;font-size:1.2rem;">
        <span style="color:#00ff9d">PASSED: ${passCount}</span>
        <span style="color:#ff3366">FAILED: ${failCount}</span>
        <span>TOTAL: ${TESTS.length}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${TESTS.map(t => `
          <div style="padding:10px;border-left:4px solid ${t.status === 'PASS' ? '#00ff9d' : '#ff3366'};background:#111;">
            <strong>${t.status}</strong> — ${t.name}
            ${t.reason ? `<div style="color:#ff3366;margin-top:5px;font-size:0.9em;">↳ ${t.reason}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
  console.log(`ARIA Test Suite: ${passCount}/${TESTS.length} passed`);
}

function runTests() {
  console.log('Initiating test sequence...');

  // UNIT TESTS
  describe('sanitizeInput: strips HTML and whitespace', () => {
    expect(sanitizeInput('  <script>alert()</script>test  ')).toBe('test');
    expect(sanitizeInput('')).toBe('');
  });

  describe('parseSeverity: maps standard and fallback', () => {
    expect(parseSeverity('CRITICAL')).toBe('CRITICAL');
    expect(parseSeverity('hIgh')).toBe('HIGH');
    expect(parseSeverity('foo')).toBe('UNKNOWN');
  });

  describe('buildGeminiPrompt: merges schema and input', () => {
    const p = buildGeminiPayload({ text: 'Fire on 5th' });
    expect(typeof p).toBe('object');
    // Testing system instruction binding
    expect(p.systemInstruction.parts[0].text).toContain('JSON');
  });

  describe('formatTimestamp: outputs cleanly', () => {
    const time = new Date(1700000000000).toLocaleTimeString(); // generic check
    expect(formatTimestamp(1700000000000)).toBe(time);
  });

  describe('validateIncidentJSON: robust schema bounding', () => {
    expect(validateIncidentJSON({ severity: 'LOW', incident_title: 'A', incident_type: 'B', confidence_score: 0.5 })).toBeTruthy();
    expect(validateIncidentJSON({ severity: 'LOW' })).toBeFalsy();
    expect(validateIncidentJSON(null)).toBeFalsy();
  });

  describe('calculateConfidenceColor: explicit ranges', () => {
    expect(calculateConfidenceColor(0.9)).toBe('var(--c-accent-green)');
    expect(calculateConfidenceColor(0.5)).toBe('var(--c-accent-amber)');
    expect(calculateConfidenceColor(0.1)).toBe('var(--c-accent-red)');
    expect(calculateConfidenceColor('invalid')).toBe('var(--c-text-muted)');
  });

  // INTEGRATION BLOCKS (Mocks)
  describe('Integration: UI Auth State reacts cleanly', () => {
    // Ensuring variables bound
    const ind = document.getElementById('sessionIndicator');
    expect(ind.classList.contains('offline')).toBeTruthy(); 
  });

  // ERROR BLOCKS
  describe('Error Scenario: Malformed LLM string catches safely', () => {
    let thrown = false;
    try {
      if(!validateIncidentJSON({})) throw new Error('Caught invalid json gracefully');
    } catch { thrown = true; }
    expect(thrown).toBeTruthy();
  });

  // ACCESSIBILITY BLOCKS
  describe('A11y: All buttons must have aria-labels or text', () => {
    document.querySelectorAll('button').forEach(b => {
      const hasAria = b.hasAttribute('aria-label') || b.textContent.trim().length > 0;
      expect(hasAria).toBeTruthy();
    });
  });

  renderDashboard();
}
