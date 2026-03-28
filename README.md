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
└── public/
    ├── index.html        // Document Object Model entry (Declarative Semantic Layout)
    ├── css/
    │   ├── main.css      // Typography and Design tokens
    │   ├── animations.css// Staggered CSS Keyframes and Processing States
    │   └── components.css// Isolated block styles (Buttons, Input Fields, Badges)
    └── js/
        ├── api.js        // Explicit network fetching proxying to Cloud Functions
        ├── app.js        // Bootstrap controller, single global listener router
        ├── audio.js      // Web Speech API interfaces 
        ├── image.js      // Filesystem FileReader chunk parsing
        ├── storage.js    // Stateful local & session managers for credentials
        ├── utils.js      // Pure deterministic formatters and validators
        ├── test-suite.js // In-browser visual test runner
        └── ui.js         // Presentation logic translating validated ASTs to DOM
```

## Setup & Demo Mode

1.  Clone this repository.
2.  Serve the `public` directory locally (e.g., `python3 -m http.server 8000`).
3.  Open the app in your browser (`http://localhost:8000`).
4.  Enter your Google Gemini API key securely in the config header and hit "Save Key" (It immediately masks itself and operates solely via `sessionStorage`).
5.  Load a preset scenario or test with raw multi-modal inputs!

## Architecture & Code Quality Constraints

The repository strictly enforces enterprise-grade vanilla JavaScript patterns:

### 1. Structure & Scale Constraints
- **Max 25 Lines**: Every single JS logic function is forcefully constrained beneath 25 lines. Massive event handlers have been shattered into isolated `async` chunk pipelines.
- **Semantic Compartmentalization**: All files are demarcated visually (e.g., `/* ── AUTH ── */`, `/* ── ORCHESTRATION ── */`) maintaining strict separation of concerns.
- **JSDoc Enforced**: 100% of the codebase features explicit JSDoc typing (`@param`, `@returns`, `@throws`), cementing parameters.

### 2. Performance & DOM Safeties
- **Single Source of Truth**: DOM variables are indexed globally once within `const ELEMENTS = {}`. Event listeners loop strictly sequentially via `initEventListeners()`.
- **Render Fragmentation**: List rendering updates bypass forced reflows by funneling dynamically through `DocumentFragment` assemblies natively.
- **Voice Debouncing**: Live voice detection is wrapped behind a `300ms` `setTimeout` loop avoiding UI freeze.

### 3. Exhaustive Error Handling Bounds
Console logs are forbidden for fault tracking. `api.js` explicitly dissects `fetch` faults into:
- `HTTP 400`, `401`, `403` boundaries.
- `HTTP 429` (Quota limits triggering immediate retry banners).
- `HTTP 5xx` Upstream failures.
Every single fault routes visually to the user securely into an inline `errorBanner` payload container. 

### 4. Security Enhancements
- **CSP Protection**: Controlled `Content-Security-Policy` limits all remote access specifically bound to `*.googleapis.com`, rendering XSS attempts null natively.
- **String Sanitization**: `<input>` data maps strip arbitrary HTML prior to reaching the payload compiler (`replace(/<[^>]*>/g, '')`).
- **Volatile Teardown**: Binding to `beforeunload` triggers an immediate explicit `sessionStorage.clear()`.

## Testing Suite `?test=true`

The ARIA environment ships with a radically powerful built-in visual automated testing payload. 

By appending `?test=true` to your local environment URL (e.g., `http://localhost:8000/?test=true`), the `test-suite.js` engine intercepts the DOM and mounts a full-screen dynamic reporting dashboard.

The module executes instantly covering:
1. **Unit Assertions:** Verifying exact regex boundaries, timestamp conversions, and HTML-stripping behaviors against pure utility models.
2. **Schema & AST Assertions:** Running simulated LLM string failures asserting the `validateIncidentJSON()` block strictly bounds the schema arrays.
3. **Accessibility (A11y) Probing:** A generic block loops the explicit DOM nodes proving every interactive logic point bears standard `aria-label` text descriptors ensuring AT limits pass natively.
