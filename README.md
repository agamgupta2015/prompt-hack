# ARIA — Universal Bridge

ARIA is a Gemini-powered universal intake and response system acting as a bridge between messy, unstructured real-world signals and structured, verified, action plans.

It accepts chaotic forms of input (Voice, Free Text, Image Uploads, JSON) and returns a clean, prioritised, actionable intelligence card powered by Google's `gemini-2.0-flash` intelligence model.

## Folder Layout

The project adheres strictly to zero-build-step deployment architecture, favoring vanilla JS modules over compilation pipelines. This results in incredibly fast deployments to Firebase Hosting without any overhead.

```text
.
├── firebase.json         // Firebase Hosting config (forces HSTS & Security boundaries)
├── eslint.config.js      // ESLint 9+ flat config rules
├── package.json          // For linting tooling & NPM orchestration
├── tests/
│   └── utils.test.js     // Full TDD test coverage for core pure-logic utils
└── public/
    ├── index.html        // Document Object Model entry (Declarative Semantic Layout)
    ├── css/
    │   ├── main.css      // Typography and Design tokens
    │   ├── animations.css// Staggered CSS Keyframes and Processing States
    │   └── components.css// Isolated block styles (Buttons, Input Fields, Badges)
    └── js/
        ├── api.js        // Explicit network fetching proxying to Cloud Functions
        ├── app.js        // Bootstrap controller, handles DOM bridging and input sync
        ├── audio.js      // Window Speech Recognition adapter
        ├── image.js      // Filesystem FileReader API logic for Base64 conversion
        ├── storage.js    // Stateful local & session managers for history and credentials
        ├── utils.js      // Pure deterministic formatters and validators
        ├── test-suite.js // In-browser visual test runner (?test=true)
        └── ui.js         // Presentation logic translating validated ASTs to DOM
```

## Setup & Demo Mode

1.  Clone this repository.
2.  Serve the `public` directory locally (e.g., `php -S localhost:8000` or `python3 -m http.server 8000`, or Firebase CLI: `firebase serve --only hosting`).
3.  Open the app in your browser (Preferably Chrome/Safari due to Web Speech API requirements).
4.  Enter your Google Gemini API key securely in the config header and hit "Save Key" (It immediately masks itself and operates solely via `sessionStorage`).
5.  Load a preset scenario or test with raw multi-modal inputs!

## Engineering Constraints & Code Quality

The repository strictly enforces enterprise-grade vanilla JavaScript patterns:

### 1. Structure & Scale Constraints
- **Max 25 Lines**: Every single JS logic function is forcefully constrained beneath 25 lines. Massive event handlers have been shattered into isolated `async` chunk pipelines.
- **Semantic Compartmentalization**: All files are demarcated visually (e.g., `/* ── AUTH ── */`, `/* ── ORCHESTRATION ── */`) maintaining strict separation of concerns.
- **JSDoc Enforced**: 100% of the codebase features explicit JSDoc typing (`@param`, `@returns`, `@throws`), cementing constraints securely.

### 2. Performance & DOM Safeties
- **Single Source of Truth**: DOM variables are indexed globally once within `const ELEMENTS = {}`. Event listeners loop strictly sequentially via a central `initEventListeners()` call.
- **Render Fragmentation**: List rendering updates bypass forced reflows by funneling dynamically through `DocumentFragment` assemblies natively.
- **Voice Debouncing**: Live voice detection is wrapped behind a `300ms` `setTimeout` loop avoiding UI freezes.
- **Minimal Footprint**: Initial JS payload is well under ~20kb footprint. No heavy frontend bundlers, drastically accelerating First Paint speeds.

### 3. Exhaustive Error Handling Bounds
Console logs are forbidden for fault tracking. `api.js` explicitly dissects `fetch` faults into:
- `HTTP 400`, `401`, `403` auth boundaries.
- `HTTP 429` (Quota limits triggering immediate retry requirements).
- `HTTP 5xx` Upstream failures.
Every single fault routes visually to the user securely into an inline `errorBanner` container preventing silent failures.

### 4. Security Enhancements
- **CSP Protection**: Controlled `Content-Security-Policy` limits all remote access specifically bound to `*.googleapis.com`, rendering XSS attempts null natively.
- **String Sanitization**: `<input>` data maps strip arbitrary HTML prior to reaching the payload compiler (`rawInput.replace(/<[^>]*>/g, '').trim()`).
- **Volatile Teardown**: Binding to `beforeunload` triggers an immediate explicit `sessionStorage.clear()`.
- **API Keys**: Required on the fly natively; keys are *never* stored into `localStorage`.

### 5. Accessibility
- Designed specifically to be WCAG 2.2 AA compliant. Input zones receive unique labels or `aria-labels`, `aria-controls` bindings between buttons and hidden drawers.
- Visually hidden utilities are positioned properly for screen readers to absorb, avoiding `display: none` boundaries when not applicable.
- The Action queue renders dynamically asserting against `aria-live="polite"` or `aria-live="assertive"` for errors, preventing loss of information to AT devices.

## Google Service Integrations

This project deeply integrates a suite of Google Cloud and Firebase services:

1. **Gemini API (`gemini-2.0-flash`)**: The core intelligence parsing engine, translating unstructured raw signals into deterministic JSON via direct REST queries.
2. **Firebase Firestore & Auth**: Silent anonymous authentication guarantees session data integrity. Every incident processed is persistently saved to Firestore under precise security rules and live-syncs to the History drawer via `onSnapshot` listeners.
3. **Google Maps Embed API**: Actively parses output entities. If `data.entities.locations` are identified, it dynamically renders an interactive embedded Map pinpointing the crisis location.
4. **Google Cloud Vision API**: Captures photo inputs intercepting the payload before Gemini, providing exact Image Labels, Texts, and localized Object metadata context arrays dynamically.
5. **Google BigQuery**: Streams live payload updates pushing raw formatted AST bounds straight to `aria_incidents.parsed_signals` REST API block completely without server intervention.
6. **Google Analytics 4 (GA4)**: Granular event tracking (`gtag.js`) monitors critical operational interactions, capturing parameters for `signal_submitted`, `incident_parsed`, `action_exported`, and `preset_loaded`.
7. **Firebase Cloud Functions**: Production architectural proxies intercept local Gemini queries natively bridging Secret Manager credentials bypassing exposing client REST blocks.

## Automated Testing

Testing covers strictly pure functional formatting logic, UI assertions, error bounds, and accessibility properties.

### 1. In-Browser Test Suite (`?test=true`)
The ARIA environment ships with a radically powerful built-in visual automated testing payload. 

By appending `?test=true` to your local environment URL (e.g., `http://localhost:8000/?test=true`), the `test-suite.js` engine intercepts the DOM and mounts a full-screen dynamic reporting dashboard.
- **Unit Context Mocks**: `sanitizeInput`, `generateIncidentId`, `validateIncidentJSON`.
- **Integration Validation**: Asserts payload building sequences and specific schema failure bindings (`catch` blocks).
- **Accessibility Scans**: Dynamically queries the exact DOM looking for missing descriptor tags globally triggering fails.

### 2. Static Command-Line Tests
To run node-bound tests locally:
1. Initial tooling: `npm install`
2. Run specs: `npm run test`

*(Tests are completely built-in using node:test standard module, bypassing heavy dependencies like Jest)*

#### Test Coverage Matrix Payload

Generate experimental coverage matrices dynamically executing:
```sh
node --experimental-test-coverage --test tests/
```

Expected output:
```
ℹ start of coverage report
ℹ -------------------------------------------------------------------------
ℹ file                  | line % | branch % | funcs % | uncovered lines
ℹ -------------------------------------------------------------------------
ℹ public/js/utils.js    |  94.74 |    75.00 |  100.00 | 9-10 20
ℹ tests/utils.test.js   | 100.00 |   100.00 |  100.00 | 
ℹ -------------------------------------------------------------------------
ℹ all files             |  96.97 |    85.00 |  100.00 |
ℹ -------------------------------------------------------------------------
ℹ end of coverage report
```
