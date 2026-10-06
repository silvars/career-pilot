# CareerPilot — Chrome Extension Shell SDD

**Status:** IMPLEMENTED — 2026-10-06. All logical and manual DoD items confirmed (EXT-014 verified by the user on a real job page, see 26.1).
**Phase:** FASE 3 — Chrome Extension Shell
**Previous phases:** FASE 1 — Profile Reader ✅ | FASE 2 — Job Match (logic) ✅
**Next phase:** FASE 4 — Job Match + Chrome
**Scope:** Extension infrastructure only

---

## 1. Objective

Transform `career-pilot` from a Node.js library into a functional **Chrome Extension using Manifest V3**, establishing the runtime shell required for the future integration of Job Match and Form Intelligence.

This phase creates the extension infrastructure but does **not** implement real job-page analysis or browser-based Job Match.

The extension must be loadable in Chrome, communicate correctly between its contexts, and execute the existing local application modules without requiring a backend.

---

## 1.1 Decisions closed (2026-10-06)

Validated against the real `career-pilot` repository state before implementation:

- **Folder names**: the diagram in section 6 is illustrative, not literal. The
  real repo uses `src/profile/` (not `src/profile-reader/`) and
  `vendor/profiles/<profileId>/` (not a top-level `profiles/`), per the
  Profile Reader SDD section 6.1. Implementation follows the real names.
- **Bundler**: none exists in the repo today (only `tsc`, `vitest`, `tsx`).
  **esbuild** is introduced as an explicit **direct devDependency**
  (`npm install -D esbuild`) — lightweight, zero-config. Corrected
  2026-10-06: do not rely on it merely being present transitively via
  vitest/vite; the build now depends on it directly, so it must be declared
  directly.
- **Content script `matches`**: restricted to `["http://*/*", "https://*/*"]`
  instead of the `<all_urls>` in section 7's example, per section 7's own
  caution against broad permissions. No `"permissions"` entry is needed for
  this (corrected 2026-10-06): `chrome.tabs.sendMessage(tabId, ...)` does not
  require `activeTab`/`tabs` permission when the content script is already
  statically declared via `content_scripts` — that permission is only needed
  for dynamic injection (`chrome.scripting.executeScript`) or for reading
  `tab.url`/`tab.title` via `chrome.tabs.query`, neither of which FASE 3 does
  (the content script supplies its own URL/title in its response).
- **`ChromeProfileLoader`**: `FsProfileLoader` (FASE 1) uses `node:fs`, which
  does not exist in a service worker. A new `ChromeProfileLoader` —
  implementing the existing `ProfileLoader` interface via
  `chrome.runtime.getURL(...) + fetch(...)` — is created under
  `src/extension/`, not `src/profile/` (principle 11: Chrome-specific code
  stays in the extension layer). This is an additional adapter, not a second
  profile-loading mechanism (section 13 still holds).
- **Build asset copy**: `vendor/profiles/**` must be copied into `dist/` as
  static assets — the extension can only `fetch()` files inside its own
  packaged output, not arbitrary repo paths.
- **Testing without a real browser**: no `jsdom`/`sinon-chrome` added. Popup
  logic is written as pure functions (state → render data) testable without a
  real DOM; a minimal hand-rolled mock of `chrome.runtime`/`chrome.tabs`
  covers messaging tests.
- **`npm run build`**: today it only runs `tsc --noEmit`. It is repurposed to
  produce the real extension `dist/`; the existing type-check moves to
  `npm run typecheck`.
- **Manual Chrome validation**: the agent validates manifest shape, build
  output and automated tests. Actually loading `dist/` via "Load unpacked" and
  confirming popup/content-script behavior in a real Chrome window is
  confirmed manually by the user (section 27 checklist items are annotated
  accordingly).

---

## 2. Roadmap

```text
FASE 1 — Profile Reader
    ✅ CONCLUÍDA
          ↓
FASE 2 — Job Match (lógica pura)
    ✅ CONCLUÍDA
          ↓
FASE 3 — Chrome Extension Shell
    ⏳ THIS SDD
          ↓
FASE 4 — Job Match + Chrome
    ⏳ FUTURE
          ↓
FASE 5 — Form Intelligence
    ⏳ FUTURE
          ↓
FASE 6 — Autofill com revisão
    ⏳ FUTURE
```

---

## 3. Scope

### 3.1 In scope

- Chrome Manifest V3
- Extension build structure
- `manifest.json`
- Background Service Worker
- Content Script
- Popup
- Typed message protocol
- Communication between Popup, Service Worker and Content Script
- Extension lifecycle/state model
- Local execution boundary for existing Profile Reader and Job Match
- Development and production build
- Local loading in Chrome
- Unit and messaging tests
- Security baseline
- Error handling
- Extension packaging

### 3.2 Explicitly out of scope

- Real job-page extraction
- Job-page semantic analysis
- Platform-specific adapters
- LinkedIn/Indeed/Greenhouse/Lever adapters
- Real Job Match execution against the current browser page
- Final Match UI/results UI
- Form Intelligence
- Form-field detection
- Autofill
- Automatic form submission
- Job application automation
- Job scraping
- External APIs
- Backend
- Database
- Candidate-data persistence
- Cloud LLM
- Local LLM integration
- Embeddings/vector database
- Authentication
- User account system

These belong to later phases or future architecture decisions.

---

## 4. Architectural Principles

1. Local-first.
2. No backend.
3. No database.
4. No candidate-data persistence.
5. No external runtime profile download.
6. Profile data is bundled/vendorized locally.
7. Job content is treated as untrusted input.
8. No automatic application submission.
9. Explicit user interaction for future actions.
10. Domain logic remains independent from Chrome APIs.
11. Chrome-specific code belongs to the extension layer.
12. The architecture must remain testable outside Chrome.

---

## 5. Target Architecture

```text
                    Chrome Browser
                          │
             ┌────────────┴────────────┐
             │                         │
        Popup UI                 Current Web Page
             │                         │
             │                    Content Script
             │                         │
             └──────────┬──────────────┘
                        │
                  Message Protocol
                        │
                Service Worker
                        │
             ┌──────────┴──────────┐
             │                     │
       Profile Reader          Job Match
             │                     │
             └──────────┬──────────┘
                        │
                 Local Profile
```

The Service Worker is the orchestration boundary.

The existing domain modules must not depend directly on Chrome APIs.

---

## 6. Proposed Project Structure

The exact structure may be adjusted during implementation if required by the existing repository, but the architectural separation must be preserved.

Real repo names (see section 1.1) — not the illustrative `profile-reader`/
top-level `profiles/` used elsewhere in this document:

```text
career-pilot/
├── src/
│   ├── profile/              (existing, FASE 1 — unchanged)
│   ├── job-match/             (existing, FASE 2 — unchanged)
│   └── extension/
│       ├── background/
│       │   └── service-worker.ts
│       ├── content/
│       │   └── content-script.ts
│       ├── popup/
│       │   ├── popup.html
│       │   ├── popup.ts
│       │   └── popup.css
│       ├── messaging/
│       │   ├── messages.ts
│       │   └── message-handler.ts
│       ├── state/
│       │   └── extension-state.ts
│       └── profile/
│           └── chromeProfileLoader.ts   (implements ProfileLoader)
│
├── vendor/
│   └── profiles/<profileId>/  (existing, FASE 1 — copied into dist/ at build time)
├── tests/
│   ├── extension/
│   └── ...                    (existing profile/job-match tests — unchanged)
│
├── manifest.json
├── esbuild.config.mjs          (or equivalent build script)
├── package.json
├── tsconfig.json
└── ...
```

Do not duplicate Profile Reader or Job Match implementation inside `extension/`.

---

## 7. Manifest V3

The extension must use **Manifest V3**.

The manifest must define only the permissions actually required by FASE 3.

Conceptual structure:

```json
{
  "manifest_version": 3,
  "name": "CareerPilot",
  "version": "0.1.0",
  "description": "Local career assistance for job applications.",
  "background": {
    "service_worker": "service-worker.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup.html"
  },
  "content_scripts": [
    {
      "matches": ["http://*/*", "https://*/*"],
      "js": ["content-script.js"],
      "run_at": "document_idle"
    }
  ]
}
```

`matches` is restricted to `http`/`https` (excludes `file://`,
`chrome-extension://`, etc.) rather than the broader `<all_urls>`; this is
decision 1.1. No `"permissions"` key is declared (corrected 2026-10-06): the
static `content_scripts` declaration is sufficient, and `chrome.tabs.sendMessage`
to a known tab id does not require `activeTab`/`tabs` permission.

Do not add broad permissions simply for future functionality.

The final manifest must be validated by Chrome (manual confirmation by the
user — section 1.1).

---

## 8. Service Worker

The Service Worker is the extension's background orchestration layer.

Responsibilities:

- initialize extension runtime
- receive messages
- validate and route messages
- maintain transient runtime state
- invoke domain services when explicitly requested
- respond to Popup
- communicate with Content Script
- handle extension-level errors

It must NOT:

- scrape jobs continuously
- monitor tabs continuously
- submit forms
- persist candidate data
- call external services
- download profiles
- execute arbitrary page code

Conceptual interface:

```ts
interface ExtensionRuntime {
  initialize(): Promise<void>;
  handleMessage(message: ExtensionMessage): Promise<ExtensionResponse>;
}
```

---

## 9. Content Script

The Content Script is the bridge to the current web page.

In FASE 3 it has only shell responsibilities.

It may:

- confirm that the script is loaded
- return basic page metadata required to validate communication
- respond to health/status requests

It must NOT yet:

- extract job descriptions
- identify job platforms
- analyze requirements
- execute Job Match
- modify forms
- fill fields
- submit forms

Future page extraction belongs to FASE 4.

Example:

```ts
interface PageContext {
  url: string;
  title: string;
}
```

The Content Script must not send complete page content to the Service Worker during normal shell operation.

---

## 10. Popup

The Popup provides the initial extension UI.

FASE 3 popup is intentionally minimal.

It should display:

- CareerPilot name
- extension status
- active profile
- current page availability/status
- basic diagnostic information
- optional "Check connection" action

Example:

```text
CareerPilot

Profile
Rodrigo Matos

Extension
Ready

Current page
Connected

Job Match
Available in next phase
```

The popup must not implement the final Job Match result UI.

---

## 11. Message Protocol

All communication between extension contexts must use a typed message protocol.

Example:

```ts
type ExtensionMessage =
  | { type: "GET_EXTENSION_STATUS" }
  | { type: "GET_ACTIVE_PROFILE" }
  | { type: "PING_CONTENT_SCRIPT" }
  | { type: "GET_PAGE_CONTEXT" };
```

Responses:

```ts
interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ExtensionError;
}
```

Errors:

```ts
type ExtensionError =
  | { code: "CONTENT_SCRIPT_UNAVAILABLE"; message: string }
  | { code: "PROFILE_NOT_LOADED"; message: string }
  | { code: "INVALID_MESSAGE"; message: string }
  | { code: "INTERNAL_ERROR"; message: string };
```

Unknown messages must fail safely.

Messages must never be treated as executable code.

---

## 12. Runtime State

FASE 3 requires only transient runtime state.

Example:

```ts
interface ExtensionState {
  initialized: boolean;
  activeProfileId: string | null;
  currentPage: PageContext | null;
  contentScriptConnected: boolean;
}
```

State may live in Service Worker memory.

Do not introduce persistent storage unless explicitly justified and approved in a future SDD.

The extension must work after Service Worker restarts.

---

## 13. Profile Integration

The extension must reuse the existing Profile Reader.

The extension must not create a second profile-loading **mechanism** — but it
does need a second `ProfileLoader` **implementation** (decision 1.1):
`FsProfileLoader` (FASE 1) depends on `node:fs`, unavailable in a service
worker. `ChromeProfileLoader` (`src/extension/profile/chromeProfileLoader.ts`)
implements the same `ProfileLoader` interface via `chrome.runtime.getURL(...)
+ fetch(...)`, mirroring `FsProfileLoader`'s logic exactly. `ProfileManager`,
`ProfileLoader` (interface), chunking, indexing and retrieval are all reused
unchanged from `src/profile/`.

Conceptually:

```text
Extension (service worker)
    ↓
ProfileManager                      (existing, src/profile/)
    ↓
ProfileLoader (interface)           (existing, src/profile/)
    ↓
ChromeProfileLoader (implementation) (new, src/extension/profile/)
    ↓
chrome.runtime.getURL + fetch
    ↓
dist/vendor/profiles/<profileId>/   (copied at build time — section 16)
```

The active profile is selected from locally bundled profiles.

For FASE 3, the goal is validating that the extension can load the existing profile correctly.

No profile editing UI is required.

---

## 14. Job Match Integration Boundary

Job Match already exists as domain logic from FASE 2.

FASE 3 must preserve its API and keep it independent of Chrome.

```text
Chrome-specific layer
        ↓
Service Worker
        ↓
Job Match domain
```

Do not introduce:

```text
Job Match → Chrome API
```

Correct dependency direction:

```text
Extension → Domain
Domain → no Chrome dependency
```

Real browser Job Match integration belongs to FASE 4.

---

## 15. Browser Context Boundaries

```text
Popup
  - short-lived
  - UI only

Content Script
  - page context bridge
  - DOM access

Service Worker
  - background orchestration
  - no DOM

Domain
  - pure application logic
  - no Chrome API
```

No domain module should assume access to `window`, `document`, `chrome.tabs`, or other browser-specific globals.

---

## 16. Build

The project must support a reproducible extension build.

Required conceptual commands:

```bash
npm run typecheck   # tsc --noEmit (existing script, renamed — decision 1.1)
npm run build       # esbuild bundles service-worker/content-script/popup,
                     # then copies vendor/profiles/** into dist/
npm test
```

**esbuild** is the bundler (decision 1.1), added as an explicit **direct
devDependency** (`npm install -D esbuild`) — no bundler exists in the repo
today, and it must not be relied upon merely as a transitive dependency of
vitest/vite (corrected 2026-10-06).

The build must, at minimum:

1. type-check the whole project (reuse `npm run typecheck`);
2. bundle each entry point (`service-worker.ts`, `content-script.ts`,
   `popup.ts`) into a single self-contained file per entry — no runtime
   module-resolution surprises inside the service worker/content script;
3. copy `popup.html`/`popup.css` and `manifest.json` into `dist/`;
4. copy `vendor/profiles/**` into `dist/vendor/profiles/**` (section 13) —
   the extension can only `fetch()` files inside its own packaged output.

The extension build must generate a directory suitable for:

```text
Chrome
→ chrome://extensions
→ Developer mode
→ Load unpacked
→ select dist/
```

Do not introduce a build system heavier than necessary for this shell
(no webpack/vite dev server — esbuild's build API is sufficient).

---

## 17. Development Workflow

```text
1. npm install
2. npm run build
3. Open chrome://extensions
4. Enable Developer mode
5. Load unpacked
6. Select generated dist/
7. Open a test page
8. Open CareerPilot popup
9. Verify extension status
10. Verify Content Script communication
```

The extension must run without backend infrastructure.

---

## 18. Testing Strategy

### 18.1 Unit tests

Test:

- message validation
- message routing
- response serialization
- state transitions
- profile integration boundary
- error handling

### 18.2 Content Script tests

Verify:

- script initialization
- page context retrieval
- message response
- safe behavior on unsupported contexts

### 18.3 Popup tests

Verify:

- initial rendering
- status rendering
- profile rendering
- error rendering
- communication with Service Worker

No `jsdom` is introduced (decision 1.1): popup logic is split into pure
functions (`state -> render data/DOM-diff description`) that are unit-tested
directly, and a thin `popup.ts` entry point wires that data to the real DOM
only at runtime (not unit-tested, since it requires a real browser per
section 1.1's manual-validation boundary).

### 18.4 Messaging mocks

No `sinon-chrome` or similar library is introduced (decision 1.1): a minimal
hand-rolled mock of `chrome.runtime`/`chrome.tabs` (covering
`sendMessage`, `onMessage`, `getURL`, `tabs.query`) is enough for the
message-routing and Profile Reader integration tests in sections 18.1-18.2.

### 18.5 Build validation

CI/local validation must confirm:

- TypeScript compilation
- unit tests
- extension build
- manifest existence
- manifest validity
- required generated assets exist

---

## 19. Security

The extension must follow least privilege.

Requirements:

- minimum Chrome permissions
- no unnecessary host permissions
- no remote code execution
- no `eval`
- no dynamic executable code from page content
- no external script injection
- no credential access
- no candidate-data transmission
- no automatic form submission
- no background scraping

Web page content is always untrusted input.

A malicious page must not be able to:

- alter profile files
- alter extension configuration
- execute extension code
- invoke privileged operations without validated messages
- access candidate profile data beyond explicitly authorized flows

---

## 20. Privacy

FASE 3 preserves the local-first privacy model.

The extension must not:

- send profile data to external servers
- send page content to external servers
- persist candidate information
- create analytics containing job application data
- create tracking infrastructure

No telemetry is required for FASE 3.

---

## 21. Error Handling

Minimum error categories:

```text
EXTENSION_INITIALIZATION_FAILED
INVALID_MESSAGE
CONTENT_SCRIPT_UNAVAILABLE
PROFILE_NOT_LOADED
PROFILE_LOAD_FAILED
PAGE_CONTEXT_UNAVAILABLE
INTERNAL_ERROR
```

Errors must not expose sensitive information.

The popup should display user-friendly messages while local development logs may contain diagnostic details.

---

## 22. Unsupported Pages

Some Chrome pages cannot host ordinary content scripts.

The extension must fail gracefully.

Examples:

```text
chrome://*
chrome-extension://*
other restricted browser pages
```

The popup should report that the current page is unavailable rather than treating it as an application failure.

---

## 23. No Persistent Candidate Data

Do not introduce:

- IndexedDB
- localStorage for profile/job data
- cookies
- remote databases
- browser sync storage
- analytics storage

for candidate or job data in this phase.

Transient extension state is sufficient.

---

## 24. Versioning

The extension version must be explicitly defined in `manifest.json`.

Versioning must follow the existing project strategy.

Do not automatically increment the version on every commit.

Release version changes remain an explicit development/release action.

---

## 25. Backward Compatibility

FASE 3 must not break:

- Profile Reader tests
- Job Match tests
- existing Node library behavior
- existing domain APIs

Existing tests must continue to pass.

The extension is an additional runtime layer, not a replacement for the domain library.

---

## 26. Implementation Backlog

Status geral: **implementado e testado em 2026-10-06** — `src/extension/`,
39 testes novos (113 no total do career-pilot). EXT-014 (Chrome real)
permanece pendente de confirmação manual pelo usu\u00e1rio (decision 1.1).

| ID | Item | Status |
|---|---|---|
| EXT-001 | Define Chrome MV3 manifest | ✅ DONE — `manifest.json`, sem `permissions`, `content_scripts.matches` restrito a `http`/`https` |
| EXT-002 | Create extension directory structure | ✅ DONE — `src/extension/{background,content,popup,messaging,state,profile}` |
| EXT-003 | Implement Service Worker shell | ✅ DONE — `src/extension/background/service-worker.ts` |
| EXT-004 | Implement Content Script shell | ✅ DONE — `src/extension/content/content-script.ts` |
| EXT-005 | Implement Popup shell | ✅ DONE — `src/extension/popup/{popup.html,popup.ts,popup.css,popupViewModel.ts}` |
| EXT-006 | Define typed message protocol | ✅ DONE — `src/extension/messaging/messages.ts` |
| EXT-007 | Implement message routing | ✅ DONE — `src/extension/messaging/message-handler.ts` (chrome-agnostic, pure) |
| EXT-008 | Implement transient extension state | ✅ DONE — `src/extension/state/extension-state.ts` |
| EXT-009 | Integrate Profile Reader boundary (`ChromeProfileLoader` in `src/extension/profile/`, implementing the existing `ProfileLoader` interface) | ✅ DONE — also required extracting `parseManifestJson`/`validateManifestShape` out of `profileLoader.ts` into a new dependency-free `src/profile/manifestParser.ts` (see implementation notes below) |
| EXT-010 | Define build pipeline (esbuild; bundle service-worker/content-script/popup; copy `vendor/profiles/**` into `dist/`) | ✅ DONE — `scripts/build-extension.mjs`, `esbuild` added as a **direct** devDependency |
| EXT-011 | Add extension unit tests | ✅ DONE — `tests/extension/` (messages, state, message-handler, popup view model) |
| EXT-012 | Add messaging integration tests | ✅ DONE — `tests/extension/serviceWorker.test.ts`, `tests/extension/contentScript.test.ts` (hand-rolled `chrome.*` mocks, no `sinon-chrome`) |
| EXT-013 | Validate manifest/build | ✅ DONE — `tests/extension/manifest.test.ts` (structural) + manual `npm run build` run, `dist/` inspected |
| EXT-014 | Validate local Chrome installation | ✅ DONE — confirmed manually by the user 2026-10-06: popup loaded on a real job posting (Akad Seguros, "Engineering Manager"), showing Profile "Rodrigo Matos Silva", Extension "Ready", Current page "Connected" |
| EXT-015 | Security review | ✅ DONE — no `permissions`, no `eval`, no remote code, content script only reports `{url,title}`, job/page text never sent externally (reuses FASE 2's untrusted-input handling) |
| EXT-016 | Documentation | ✅ DONE — `README.md` (setup, test, typecheck, sync-profile, build, load-unpacked steps) |

Explicitly NOT part of this backlog:

- Job Match + Chrome
- Platform Adapter
- Job page extraction
- Form Intelligence
- Autofill
- Submit
- AI/LLM/embeddings

### 26.1 Implementation notes (real findings, not hypothetical)

- **`node:fs` leaking into the browser bundle**: `parseManifestJson`/
  `validateManifestShape` originally lived inside `profileLoader.ts`, the
  same file as `FsProfileLoader`'s `import { promises as fs } from
  "node:fs"`. `ChromeProfileLoader` imported `parseManifestJson` as a real
  (value) import from that file, so esbuild tried to bundle the whole module
  — including `node:fs` — for the browser, and failed to resolve it. Fixed
  by extracting both functions into a new dependency-free
  `src/profile/manifestParser.ts`; `profileLoader.ts` now re-exports them for
  backward compatibility, and `ChromeProfileLoader` imports directly from the
  pure module.
- **Double profile load on cold start**: the service worker's module-level
  bootstrap originally called `initialize()` directly instead of
  `ensureInitialized()`, bypassing the cached `initPromise` used by the
  message listener. A message arriving right after a service worker wake-up
  could trigger a second, redundant `profileManager.load(...)`. Fixed by
  routing the module-level bootstrap through `ensureInitialized()` too, so
  there is exactly one cached initialization promise; covered by a
  regression test asserting `profile.json` is fetched exactly once even
  across multiple messages.
- `tsconfig.extension.json` (DOM lib + `@types/chrome`) is kept separate from
  the domain `tsconfig.json` specifically to avoid `lib.dom.d.ts` vs
  `@types/node` global conflicts (e.g. `fetch`/`Response`) leaking into
  `src/profile`/`src/job-match`'s type-checking.

---

## 27. Definition of Done — Logical

FASE 3 is logically complete when:

Agent-verifiable automatically (build output, manifest shape, test suite):

- [x] Manifest V3 exists and is valid (structurally: required keys, `content_scripts.matches`, and no unnecessary permissions).
- [x] Extension builds successfully (`npm run build` produces `dist/` with `manifest.json`, `service-worker.js`, `content-script.js`, `popup.html`/`.js`/`.css`, `vendor/profiles/**`).
- [x] Message protocol is typed and validated.
- [x] Active profile can be identified (via `ChromeProfileLoader` unit/mocked tests).
- [x] Existing Profile Reader remains reusable (FASE 1 tests still pass; `profileLoader.ts` had a non-behavioral refactor extracting manifest parsing — see 26.1).
- [x] Existing Job Match tests continue passing (FASE 2 tests still pass, unmodified).
- [x] Extension-specific tests pass (service worker, messaging, popup pure functions, `ChromeProfileLoader` against a mocked `chrome.*`).
- [x] No candidate data is persisted (no `localStorage`/`IndexedDB`/cookies in the new code).
- [x] No external service is required (no `fetch` to non-`chrome-extension://` origins in the new code).
- [x] No unnecessary Chrome permission is requested (manifest declares no `"permissions"` at all — only the restricted `content_scripts.matches`).
- [x] No Job Match browser integration is implemented (no `ChromeJobPageSource`).
- [x] Documentation describes how to build and load the extension.

Requires **manual confirmation by the user** in a real Chrome window (decision 1.1) — **confirmed 2026-10-06** (screenshot: real job posting, popup showing Profile/Extension Ready/Current page Connected):

- [x] Generated build can be loaded unpacked in Chrome.
- [x] Service Worker starts correctly.
- [x] Content Script loads on supported (http/https) pages.
- [x] Popup opens correctly.
- [x] Popup communicates with Service Worker.
- [x] Service Worker communicates with Content Script.

---

## 28. Definition of Done — Product

Product-level Job Match behavior is **not** part of FASE 3.

The following remain for FASE 4:

```text
Current job page
      ↓
JobPageSource
      ↓
Job Analyzer
      ↓
Job Requirements
      ↓
Profile Retriever
      ↓
Match Engine
      ↓
Match Result
      ↓
Chrome UI
```

FASE 3 completion must NOT be interpreted as "Job Match works on LinkedIn/Indeed/etc."

---

## 29. Future Phase Boundary

**FASE 4 — Job Match + Chrome** will define:

- ChromeJobPageSource
- page extraction
- platform detection
- Job Analyzer integration
- real Job Match invocation
- match result UI
- supported-platform strategy
- page-content security
- user-triggered analysis

FASE 4 must have its own SDD.

---

## 30. Non-Goals

This phase must not become:

- a job scraper
- a job search engine
- an auto-apply bot
- an application automation system
- a browser automation framework
- an AI agent
- a backend application
- a candidate database
- a telemetry platform

The purpose is only to establish the **Chrome Extension Shell** required by later phases.

---

## 31. Implementation Rule

When implementing this SDD:

> Implement only FASE 3.

Do not implement FASE 4, FASE 5 or FASE 6.

Do not add speculative architecture that is not necessary for the shell.

If a requirement belongs to a future phase, document the boundary instead of implementing it.

The existing Profile Reader and Job Match implementations must remain unchanged unless a minimal integration adapter is strictly required by the extension boundary.

---

## 32. Suggested Agent Instruction

Use this instruction when submitting the SDD to the coding agent:

```text
Implementar a FASE 3 conforme o arquivo
CAREER_PILOT_EXTENSION_SHELL_SDD.md.

Objetivo:
transformar o career-pilot em uma Chrome Extension Manifest V3 funcional,
mantendo Profile Reader e Job Match como domínio independente de Chrome.

Implementar somente o que está dentro do escopo da FASE 3.

Obrigatório:
- Manifest V3
- Service Worker
- Content Script
- Popup
- typed message protocol
- transient extension state
- integração mínima com Profile Reader
- build da extensão
- testes
- validação do manifest
- documentação para carregar a extensão localmente

Não implementar:
- Job Match real contra página
- Platform Adapter
- Job page extraction
- Form Intelligence
- Autofill
- Submit
- scraping
- backend
- database
- LLM
- embeddings
- cloud services

Não quebrar os testes existentes de Profile Reader e Job Match.

Ao final:
1. executar todos os testes;
2. executar o build;
3. validar o manifest;
4. atualizar o backlog EXT-001..EXT-016;
5. registrar claramente qualquer gap restante;
6. não avançar para a FASE 4.
```

---

## 33. Final Architectural State

After FASE 3 the repository should conceptually provide:

```text
                    CAREER PILOT
                         │
          ┌──────────────┴──────────────┐
          │                             │
      DOMAIN LAYER                 EXTENSION LAYER
          │                             │
   ┌──────┴──────┐              ┌───────┼────────┐
   │             │              │       │        │
Profile Reader Job Match       Popup  Content  Worker
   │             │                      │        │
   └─────────────┴──────────────────────┴────────┘
                         │
                  Typed Messaging
```

The important architectural property is:

```text
Chrome Extension
      ↓
Domain APIs
      ↓
Pure/Testable Logic
```

and never:

```text
Domain Logic
      ↓
Chrome APIs
```
