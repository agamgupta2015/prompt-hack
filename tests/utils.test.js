import test from 'node:test';
import assert from 'node:assert/strict';
import { extractAndParseJSON, validateSchema, createEmptyCard, generateIncidentId } from '../public/js/utils.js';

test('Utils - extractAndParseJSON handles raw JSON', (t) => {
  const input = '{"severity":"HIGH", "incident_title":"Test"}';
  const parsed = extractAndParseJSON(input);
  assert.equal(parsed.severity, "HIGH");
  assert.equal(parsed.incident_title, "Test");
});

test('Utils - extractAndParseJSON strips markdown blocks', (t) => {
  const input = '```json\n{"severity":"CRITICAL", "incident_title":"Markdown"}\n```';
  const parsed = extractAndParseJSON(input);
  assert.equal(parsed.severity, "CRITICAL");
  assert.equal(parsed.incident_title, "Markdown");
});

test('Utils - extractAndParseJSON handles leading and trailing text', (t) => {
  const input = 'Here is the JSON you explicitly asked for:\n```\n{"severity":"CRITICAL"}\n```\nPlease act immediately.';
  const parsed = extractAndParseJSON(input);
  assert.equal(parsed.severity, "CRITICAL");
});

test('Utils - validateSchema passes on complete schema', (t) => {
  const valid = {
    severity: "CRITICAL",
    incident_title: "Fire",
    incident_type: "Fire",
    confidence_score: 0.9,
    action_queue: []
  };
  assert.equal(validateSchema(valid), true);
});

test('Utils - validateSchema fails on incomplete schema', (t) => {
  const invalid = {
    severity: "CRITICAL",
    incident_title: "Fire",
  };
  assert.equal(validateSchema(invalid), false);
});

test('Utils - generateIncidentId creates string matching prefix', (t) => {
  const id1 = generateIncidentId();
  const id2 = generateIncidentId();
  assert.match(id1, /^INC-[A-Z0-9]+-[A-Z0-9]+$/);
  assert.notEqual(id1, id2);
});

test('Utils - createEmptyCard returns default schema', (t) => {
  const empty = createEmptyCard();
  assert.equal(empty.severity, 'LOW');
  assert.equal(empty.confidence_score, 0);
  assert.deepEqual(empty.unverified_claims, []);
});
