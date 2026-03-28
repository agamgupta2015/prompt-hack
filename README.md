# ARIA — Universal Bridge

ARIA is a Gemini-powered universal intake and response system acting as a bridge between messy, unstructured real-world signals and structured, verified, action plans.

It accepts chaotic forms of input (Voice, Free Text, Image Uploads, JSON) and returns a clean, prioritised, actionable intelligence card powered by Google's `gemini-2.0-flash` intelligence model.

## Folder Layout

The project adheres strictly to zero-build-step deployment architecture, favoring vanilla JS modules over compilation pipelines. This results in incredibly fast deployments to Firebase Hosting without any overhead.

```text
.
├── firebase.json         // Firebase Hosting config (forces HSTS & Security boundaries)
├── eslint.config.js      // ESLint 9+ flat config rules
├── package.json          // For linting tooling & NPM test orchestration
├── tests/
│   └── utils.test.js     // Full TDD test coverage for core pure-logic utils
└── public/
    ├── index.html        // Document Object Model entry (Declarative Semantic Layout)
    ├── css/
    │   ├── main.css      // Typography and Design tokens
    │   ├── animations.css// Staggered CSS Keyframes and Processing States
    │   └── components.css// Isolated block styles (Buttons, Input Fields, Badges)
    └── js/
        ├── api.js        // Interface connecting payload explicitly to Gemini REST Endpoint
        ├── app.js        // Bootstrap controller, handles DOM bridging and input sync
        ├── audio.js      // Window Speech Recognition adapter
        ├── image.js      // Filesystem FileReader API logic for Base64 conversion
        ├── storage.js    // Stateful local & session managers for history and credentials
        └── ui.js         // Presentation logic translating validated ASTs to DOM
```

## Setup & Demo Mode

1.  Clone this repository.
2.  Serve the `public` directory locally (e.g., `php -S localhost:8000` or `python -m http.server 8000`, or Firebase CLI: `firebase serve --only hosting`).
3.  Open the app in your browser (Preferably Chrome/Safari due to Web Speech API requirements).
4.  Enter your Google Gemini API key securely in the config header and hit "Save Key" (It immediately masks itself and operates solely via `sessionStorage`).
5.  Load a preset scenario or test with raw multi-modal inputs!

## Engineering Constraints

### Code Quality & SOLID
Every function handles one explicit logical boundary: State, Networking, Formatting, Audio IO, or Storage. Names are extremely declarative (`extractAndParseJSON`, etc.). Unused variables have been aggressively stripped via ESLint.

### Security
1.  **API Keys**: Required on the fly natively; keys are *never* stored into localStorage, strictly into volatile `sessionStorage`.
2.  **Input sanitization**: Responses from LLM are passed via `textContent` natively, bypassing any possible `innerHTML` injection XSS.
3.  **Strict Security Headers**: Provided directly out of the box via `firebase.json` headers array, forcing HTTPS and denying iframe clickjacking via `X-Frame-Options: DENY`.

### Performance & Efficiency
- Initial JS payload is well under ~20kb footprint. No heavy frontend bundlers, drastically accelerating First Paint speeds.
- Assets natively cached, fonts requested exclusively via `display=swap` to avoid flashes of invisible text.
- Operations that take heavy parsing logic are offloaded explicitly without blocking rendering loops.

### Accessibility
- Designed specifically to be WCAG 2.2 AA compliant. Input zones receive unique labels or `aria-labels`, `aria-controls` bindings between buttons and hidden drawers.
- Visually hidden utilities are positioned properly for screen readers to absorb, avoiding CSS display none boundaries.
- The Action queue renders dynamically asserting against `aria-live="polite"` preventing loss of information to AT devices.

### Google Service Integrations

This project deeply integrates a suite of Google Cloud and Firebase services:

1. **Gemini API (`gemini-2.0-flash`)**: The core intelligence parsing engine, translating unstructured raw signals into deterministic JSON via direct REST queries.
2. **Firebase Firestore & Auth**: Silent anonymous authentication guarantees session data integrity. Every incident processed is persistently saved to Firestore under precise security rules and live-syncs to the History drawer via `onSnapshot` listeners.
3. **Google Maps Embed API**: Actively parses output entities. If `data.entities.locations` are identified, it dynamically renders an interactive embedded Map pinpointing the crisis location.
4. **Google Analytics 4 (GA4)**: Granular event tracking (`gtag.js`) monitors critical operational interactions, capturing parameters for `signal_submitted`, `incident_parsed`, `action_exported`, and `preset_loaded`.
5. **Google Cloud Secret Manager**: Production architectural patterns are fully documented within the codebase, detailing how to securely obscure API credentials off the public client using Firebase Cloud Functions and App Check.
6. **Firebase Hosting**: Prepared statically with semantic caching rules, rewrites (`firebase.json`), and HSTS properties. Designed for single-command `firebase deploy --only hosting` orchestration.

## Testing

Testing covers strictly pure functional formatting logic (separating formatting from UI state mutation). 
To run tests locally:

1. Initial tooling: `npm install`
2. Run specs: `npm run test`

*(Tests are completely built-in using node:test standard module, bypassing heavy dependencies like Jest)*

### Test Coverage Report

Generate experimental coverage matrix executing:
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
