# ARIA — Universal Bridge
### Gemini-Powered Emergency Intelligence System

> Turning chaotic real-world signals into structured, verified, life-saving action — in under 3 seconds.

![Score](https://img.shields.io/badge/AI%20Eval%20Score-91.36%25-blue)
![Gemini](https://img.shields.io/badge/Powered%20by-Gemini%202.0%20Flash-orange)
![Firebase](https://img.shields.io/badge/Backend-Firebase-yellow)
![Status](https://img.shields.io/badge/Status-Production%20Ready-green)

---

## What is ARIA?

ARIA (Adaptive Response Intelligence Assistant) is a universal bridge between human intent and complex emergency systems. It accepts **any form of unstructured real-world input** — voice transcripts, weather dumps, traffic reports, news snippets, photo descriptions, sensor data, or panicked free-form text — and instantly converts it into a clean, prioritized, actionable intelligence card.

---

## Problem Statement

In real emergencies, information arrives messy. A caller is panicking. A weather feed is raw JSON. A field medic is typing with one hand. A social media post has missing context. Traditional systems cannot process this chaos. **ARIA bridges that gap.**

---

## Live Demo

```
Input:  "theres fire at the building near 5th and main smoke everywhere 
         people on 3rd floor electricity sparking one guy is down near door"

Output: CRITICAL — Active Structure Fire
        → Call Fire Department (IMMEDIATE, 3 min)
        → Dispatch Ambulance to Main & 5th (IMMEDIATE, 5 min)  
        → Notify Power Utility re: electrical hazard (URGENT, 10 min)
        → Evacuate floors 1–2 via stairwell B (IMMEDIATE)
```

---

## Workflow — How We Built This

### Phase 1 — Concept & Architecture

**Goal:** Define what ARIA does and how it works end-to-end.

- Defined the core problem: unstructured input → structured life-saving output
- Chose Gemini 2.0 Flash as the AI engine for its speed and instruction-following
- Designed the JSON output schema: severity, entities, verified facts, action queue, notify list
- Planned 4 input modes: Text, Voice (Web Speech API), Photo (Cloud Vision), Data Paste
- Decided on single-file HTML + Vanilla JS — no framework, no build step, instant deploy

---

### Phase 2 — Prompt Engineering

**Goal:** Get Gemini to reliably output structured JSON from any messy input.

Engineered a precision system prompt that instructs Gemini to:
- Always return valid JSON only — no surrounding text
- Classify severity as CRITICAL / HIGH / MEDIUM / LOW
- Separate verified facts from unverified claims with confidence scores
- Build a prioritized action queue with owner roles and ETA in minutes
- Generate a plain-English summary readable in 5 seconds by anyone

```
System Prompt Pattern:
  You are ARIA, an emergency intelligence parsing system...
  Always respond with ONLY valid JSON in this exact schema: { ... }
  Never include any text outside the JSON.
  Be decisive. Lower confidence score rather than omitting data.
```

---

### Phase 3 — Core Application Build

**Goal:** Build the functional interface and Gemini integration.

**Input System:**
- 4 input modes with distinct UI states
- 6 preset scenario buttons (Building Fire, Cyclone Warning, Mass Casualty, Bridge Failure, Flash Flood, Gas Leak)
- Voice recording via Web Speech API with live transcript
- Photo upload with drag-and-drop zone

**Gemini Integration:**
- REST call to `gemini-2.0-flash:generateContent`
- Raw user input passed as user message
- JSON response parsed and validated before rendering

**Output Card:**
- Severity badge (48px Bebas Neue, color-coded, flashing dot for CRITICAL)
- Parsed entities with color-coded tags (people=amber, locations=green, times=blue)
- Verified facts ✓ vs unverified claims ~ with confidence bars
- Numbered action queue with urgency colors
- Notify list with method and urgency
- Plain-English summary in high-contrast box

---

### Phase 4 — Google Services Integration

**Goal:** Deepen Google Cloud usage across the full stack.

| Service | What It Does in ARIA |
|---|---|
| **Gemini 2.0 Flash** | Core AI engine — parses all unstructured input |
| **Firebase Cloud Functions** | Secure server-side proxy for Gemini API calls |
| **Google Cloud Secret Manager** | Stores GEMINI_API_KEY at runtime, never in frontend |
| **Firebase Firestore** | Saves every incident card, real-time History drawer |
| **Firebase Authentication** | Anonymous sign-in, per-user data isolation |
| **Firebase Hosting** | Single-command deployment (`firebase deploy`) |
| **Google Cloud Vision API** | Pre-processes uploaded photos before Gemini |
| **Google Analytics 4** | Tracks signal_submitted, incident_parsed, action_exported |
| **Google Maps Embed** | Renders location context map when location is detected |

**Key architectural decision:** All Gemini API calls go through a Cloud Function — the API key never touches the frontend. Cloud Function reads the key from Secret Manager at runtime.

---

### Phase 5 — Code Quality Overhaul

**Goal:** Raise code quality from good to production-grade.

- **Section architecture:** JS divided into labeled sections — AUTH / GEMINI / FIRESTORE / BIGQUERY / VISION / UI / ANALYTICS
- **Single responsibility:** Every function does exactly one thing, max 25 lines
- **Naming conventions:** camelCase verbs for functions, SCREAMING_SNAKE_CASE for constants
- **DOM management:** All selectors in single `ELEMENTS = {}` object at top of JS
- **Event listeners:** All registered in single `initEventListeners()` on DOMContentLoaded
- **JSDoc:** `@param`, `@returns`, `@throws` documented on every function
- **Input sanitization:** All user input stripped of HTML tags before Gemini call
- **Content Security Policy:** Meta tag restricting all resource origins
- **Error handling:** Every fetch() handles network failure, 4xx, 429 (with countdown), 5xx, and JSON parse failure

---

### Phase 6 — Testing Suite

**Goal:** Add comprehensive test coverage accessible via URL parameter.

Run tests by appending `?test=true` to the URL.

**Unit Tests:**
- `sanitizeInput()` — HTML tags, empty string, whitespace edge cases
- `parseSeverity()` — all 4 severity values + unknown fallback
- `buildGeminiPrompt()` — system prompt + user input structure
- `validateIncidentJSON()` — valid schema, missing fields, wrong types
- `calculateConfidenceColor()` — all confidence ranges

**Integration Tests:**
- Gemini response → JSON parse → DOM render
- Firestore write → onSnapshot → History drawer update
- File upload → FileReader → Vision API payload
- Auth state change → header UI update

**Error Scenario Tests:**
- Network offline → correct error banner
- Malformed Gemini JSON → fallback error card
- Empty input → validation message, no API call fired
- Image >5MB → rejection message

**Accessibility Tests:**
- ARIA labels on all interactive elements
- Tab order validation
- Colour contrast ratio checks (4.5:1 minimum)
- Focus visibility on all controls

---

### Phase 7 — Score Optimisation

**Goal:** Maximise AI evaluation score across all 6 pillars.

| Metric | V1 | V2 | Target |
|---|---|---|---|
| Code Quality | 86.25% | 95%+ | 95%+ |
| Security | 92.5% | 92.5% | 92.5% |
| Efficiency | 100% | 100% | 100% |
| Testing | 86.25% | 95%+ | 95%+ |
| Accessibility | 97.5% | 97.5% | 97.5% |
| Google Services | 25% → 75% | 95%+ | 95%+ |
| Problem Statement | 96.5% | 96.5% | 96.5% |
| **Overall** | **86.36%** | **91.36%** | **96%+** |

**What was intentionally left unchanged:** Efficiency (100%), Accessibility (97.5%), Security (92.5%), and Problem Statement Alignment (96.5%) were not touched to avoid regression.

---

## Tech Stack

```
Frontend        HTML5 + CSS3 + Vanilla JavaScript (zero dependencies)
AI Engine       Google Gemini 2.0 Flash (REST API)
Auth            Firebase Anonymous Authentication
Database        Firebase Firestore (real-time)
Functions       Firebase Cloud Functions (Gemini proxy)
Storage         Google Cloud Secret Manager
Vision          Google Cloud Vision API
Analytics       Google Analytics 4 (gtag.js)
Maps            Google Maps Embed API
Hosting         Firebase Hosting
Testing         Custom suite via ?test=true
```

---

## Project Structure

```
aria-universal-bridge/
├── index.html          # Complete single-file application
├── firebase.json       # Firebase Hosting config + rewrite rules
├── .firebaserc         # Firebase project alias
├── .env.example        # Environment variable reference (no secrets)
└── README.md           # This file
```

---

## Setup & Deployment

### Prerequisites
- Google Cloud project with billing enabled
- Firebase project linked to Google Cloud
- Gemini API key stored in Secret Manager

### Local Development
```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/aria-universal-bridge.git
cd aria-universal-bridge

# Install Firebase CLI
npm install -g firebase-tools

# Login and init
firebase login
firebase use YOUR_PROJECT_ID

# Serve locally
firebase serve
```

### Configure Firebase
Replace placeholders in `index.html` under `firebaseConfig`:
```javascript
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "G-XXXXXXXXXX"
};
```

### Deploy
```bash
firebase deploy --only hosting
```

---

## Security

- Gemini API key stored in Google Cloud Secret Manager — never in frontend code
- All Gemini calls proxied through Firebase Cloud Functions
- Firestore Security Rules enforce per-user data isolation
- Content Security Policy meta tag restricts all resource origins
- All user input sanitized before any API call
- Firebase API key restricted by HTTP referrer

---

## Input Modes

| Mode | Description |
|---|---|
| Text | Terminal-style textarea with blinking cursor |
| Voice | Web Speech API with live waveform animation |
| Photo | Drag-drop upload → Cloud Vision pre-processing → Gemini |
| Paste | Raw data dump (JSON, CSV, logs) with monospaced display |

---

## Preset Scenarios

Click any preset to load a real-world example signal:

1. **Building Fire** — messy voice transcript with typos
2. **Cyclone Warning** — raw weather API data dump
3. **Mass Casualty** — chaotic field medic report
4. **Bridge Failure** — social media posts + sensor readings
5. **Flash Flood** — upstream dam release notice with missing data
6. **Gas Leak** — panicked resident call transcript

---

## What Makes ARIA Different

The severity badge **slams in at 48px** the moment results arrive. The action queue counts down with staggered animation. A Google Map pinpoints the exact crisis location. Every incident is silently saved to Firestore. GA4 tracks every signal. The plain-English summary is readable in 5 seconds by anyone in a crisis.

**ARIA makes chaos legible, persistent, and measurable — in under 3 seconds.**

---

## License

MIT License — built for societal benefit, open to all.
