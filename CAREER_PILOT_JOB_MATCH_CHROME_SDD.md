# CareerPilot — Job Match + Chrome SDD

**Status:** IMPLEMENTED (automated scope) — 2026-10-06. Manual Chrome validation (section 42) pending user confirmation.
**Phase:** FASE 4 — Job Match + Chrome
**Previous phases:** FASE 1 — Profile Reader ✅ | FASE 2 — Job Match (logic) ✅ | FASE 3 — Chrome Extension Shell ✅
**Next phase:** FASE 5 — Form Intelligence
**Scope:** Real job-page reading, requirement extraction, Job Match execution and result UI

---

## 1. Objective

Implement the first real CareerPilot flow inside Chrome:

```text
Current Job Page
      ↓
ChromeJobPageSource
      ↓
Platform Detection
      ↓
Job Page Extraction
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

The user must be able to open a real vacancy in Chrome, explicitly request an analysis, and receive a transparent Career Match result based on the existing local profile and the existing FASE 2 Job Match domain.

FASE 4 integrates the existing domain capabilities into Chrome without moving Chrome-specific behavior into the domain.

---

## 1.1 Decisions closed (2026-10-06)

Validated against the real `career-pilot` repository state (not just this
document) before implementation:

- **`JobPageSource` signature**: section 8's conceptual
  `getCurrentPage(): Promise<JobPageSourceResult>` does not match the
  interface already implemented in FASE 2
  (`getCurrentJobPage(): Promise<JobPage>`, `src/job-match/jobPageSource.ts`).
  The real interface is authoritative (as section 7 itself states):
  `ChromeJobPageSource` implements `getCurrentJobPage()` and converts the
  richer `ExtractedJobPage` (section 9) down to the plain `JobPage` at the
  boundary.
- **Akad/InHire validation target is gone**: the exact URL used for the
  FASE 3 screenshot now returns "Opa, parece que o link que você acessou
  não é válido!" (confirmed via live browser navigation). A plain `fetch()`
  of that URL also only returns the SPA's empty app shell — no server-side
  JSON-LD/meta for the job content, confirming extraction Layers 1-2
  (section 10) will likely contribute little on that specific site; Layers
  3-4 (semantic DOM / visible text) carry the real weight there. Section 35's
  sanitized fixture is built by transcribing the public job text already
  visible in the user's own screenshot (title, Remote/BR badges, company/role
  description) — no candidate data was ever on that page. Final confirmation
  on the live site (DoD section 42, Test B) again requires the user's manual
  check, same pattern as EXT-014 in FASE 3.
- **Platform adapter strategy**: generic-first confirmed literally per
  section 14.4 — no dedicated InHire adapter (MATCH-CHROME-013) is built
  unless the generic extractor is proven insufficient against the sanitized
  fixture.
- **Extraction limits** (section 12), chosen and to be covered by tests:
  `MAX_TOTAL_EXTRACTED_CHARS = 20000`, `MAX_SECTION_COUNT = 50`,
  `MAX_SECTION_TEXT_CHARS = 4000`, `MAX_JSONLD_SIZE = 50000` bytes (checked
  before attempting `JSON.parse`).
- **Error codes** (section 33): `INVALID_MESSAGE`, `CONTENT_SCRIPT_UNAVAILABLE`
  and `PROFILE_LOAD_FAILED` already exist in `ExtensionErrorCode`
  (`src/extension/messaging/messages.ts`) and are reused as-is (no
  `MESSAGE_INVALID` duplicate). Only genuinely new codes are added:
  `UNSUPPORTED_PAGE`, `PAGE_EXTRACTION_FAILED`, `NO_JOB_CONTENT`,
  `JOB_PAGE_TOO_LARGE`, `JOB_ANALYSIS_FAILED`, `MATCH_ANALYSIS_FAILED`,
  `PROFILE_CONTEXT_NOT_FOUND`, `CURRENT_TAB_NOT_AVAILABLE`.
- **Messaging**: `ExtensionMessage` (currently a closed union of 4 variants,
  backed by a `MESSAGE_TYPES` Set + `isExtensionMessage` type guard) is
  extended with `EXTRACT_JOB_PAGE`, `ANALYZE_CURRENT_JOB`, `GET_MATCH_RESULT`
  — all three places (union, Set, guard) updated together.
- **Runtime state**: `ExtensionState` (FASE 3, 4 flat fields) gets a nested
  `jobMatch: JobMatchRuntimeState` sub-object rather than being flattened
  further — keeps FASE 3's fields and FASE 4's analysis state visually and
  structurally separate.
- **Content script growth**: keeps the FASE 3 pattern — DOM-touching code
  stays thin in `content-script.ts`; normalization, truncation, platform
  detection and diagnostics are pure functions testable in Node without
  `jsdom`.

---

## 2. Roadmap

```text
FASE 1 — Profile Reader
    ✅ CONCLUÍDA
          ↓
FASE 2 — Job Match — lógica pura
    ✅ CONCLUÍDA
          ↓
FASE 3 — Chrome Extension Shell
    ✅ CONCLUÍDA
          ↓
FASE 4 — Job Match + Chrome
    ⏳ THIS SDD
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

- real current-page reading;
- `ChromeJobPageSource`;
- content-script extraction;
- page/platform detection;
- generic job-page extraction;
- platform-adapter boundary;
- initial supported-platform strategy;
- conversion to existing `JobPage`;
- integration with existing Job Analyzer;
- integration with existing Profile Retriever;
- integration with existing Match Engine;
- Match Result state;
- result UI in popup;
- explicit user-triggered analysis;
- loading/error/unsupported states;
- extraction limits and normalization;
- evidence and traceability;
- security boundary for untrusted page content;
- extension messaging required by the flow;
- unit tests;
- integration tests with mocked Chrome APIs;
- representative real-page fixtures;
- documentation.

### 3.2 Explicitly out of scope

- form-field detection;
- Form Intelligence;
- autofill;
- form modification;
- automatic application submission;
- auto-apply;
- job scraping/crawling;
- job search;
- scheduled job monitoring;
- external APIs;
- backend;
- database;
- candidate persistence;
- authentication;
- accounts;
- telemetry platform;
- cloud LLM;
- local LLM;
- embeddings/vector database;
- browser automation;
- CAPTCHA handling;
- bypassing anti-bot protections;
- bypassing authentication or access controls.

---

## 4. Architectural Principles

1. Local-first.
2. No backend.
3. No database.
4. No candidate-data persistence.
5. No external runtime profile download.
6. Profile remains bundled locally.
7. Job page content is untrusted input.
8. Analysis is user-triggered.
9. No automatic application action.
10. Domain logic remains independent from Chrome APIs.
11. Chrome-specific code remains in the extension layer.
12. Extraction must be deterministic and testable.
13. Unsupported pages must fail safely.
14. Absence of evidence must not be interpreted as absence of candidate knowledge.
15. Original job wording must be preserved where useful for traceability.
16. Platform-specific logic must not leak into the domain.
17. A generic fallback must exist whenever safe extraction is possible.

---

## 5. Current Architecture After FASE 3

FASE 3 established:

```text
Chrome Browser
       │
       ├── Popup
       │
       └── Current Web Page
              │
        Content Script
              │
       Typed Messaging
              │
        Service Worker
              │
       ┌──────┴──────────┐
       │                 │
 Profile Reader      Job Match
       │                 │
       └──────┬──────────┘
              │
        Local Profile
```

FASE 4 extends the Job Match side:

```text
                         Chrome Browser
                               │
             ┌─────────────────┴─────────────────┐
             │                                   │
        Popup UI                            Current Page
             │                                   │
             │                              Content Script
             │                                   │
             └──────────────┬────────────────────┘
                            │
                     Message Protocol
                            │
                      Service Worker
                            │
             ┌──────────────┼───────────────┐
             │              │               │
       ChromeJobPageSource  Profile       Match
             │             Reader          Engine
             │              │               │
       Job Page             │          Match Result
       Extraction           │               │
             └──────────────┴───────────────┘
                            │
                         Popup UI
```

The Service Worker remains the orchestration boundary.

---

## 6. Domain Boundary

FASE 4 must reuse the existing FASE 2 domain.

Dependency direction:

```text
Chrome Extension
      ↓
Job Page Source / Extraction
      ↓
Existing Job Match Domain
```

Never:

```text
Job Match Domain
      ↓
Chrome API
```

The domain must not know about `window`, `document`, `chrome.tabs`, `chrome.runtime`, DOM selectors, platform URLs, or popup UI.

---

## 7. Existing Domain Contracts

FASE 4 must reuse the existing FASE 2 contracts instead of creating competing models.

Conceptually:

```ts
interface JobPage {
  url?: string;
  title?: string;
  text: string;
  platform?: string;
}
```

```ts
interface JobRequirements {
  title?: string;
  seniority?: string;
  requiredSkills: string[];
  preferredSkills: string[];
  requiredExperience: string[];
  responsibilities: string[];
  languages: string[];
  location?: string;
  workModel?: string;
  eligibilityRequirements: EligibilityRequirement[];
}
```

```ts
interface MatchEngine {
  evaluate(
    job: JobRequirements,
    profile: Profile
  ): Promise<MatchResult>;
}
```

The exact interfaces already present in the repository are authoritative. If an adapter is necessary, add it at the extension/application boundary rather than changing FASE 2 unnecessarily.

---

## 8. ChromeJobPageSource

Create the browser-side source responsible for obtaining the current job page.

Conceptual interface:

```ts
interface JobPageSource {
  getCurrentJobPage(): Promise<JobPage>;
}
```

The existing FASE 2 interface is authoritative. Do not rename or replace it.
`ChromeJobPageSource` must implement this existing contract.

Chrome implementation:

```ts
interface ChromeJobPageSource extends JobPageSource {}
```

Responsibilities:

- identify active tab;
- communicate with content script;
- request page extraction;
- validate structured extraction data;
- convert it into application-level representation;
- return typed errors.

It must not perform Job Match scoring.

---

## 9. Page Extraction Boundary

The content script is the only component that directly accesses page DOM.

```text
Content Script
    │
    ├── document.title
    ├── location.href
    ├── visible text
    ├── semantic elements
    └── structured metadata
```

Return structured extraction data rather than arbitrary DOM objects.

Conceptual model:

```ts
interface ExtractedJobPage {
  url: string;
  title: string;
  platform?: string;
  text: string;
  sections: ExtractedSection[];
  metadata: ExtractedMetadata;
}
```

```ts
interface ExtractedSection {
  heading?: string;
  text: string;
  source: "dom" | "metadata";
}
```

```ts
interface ExtractedMetadata {
  canonicalUrl?: string;
  description?: string;
  ogTitle?: string;
  jsonLd?: unknown;
}
```

The final implementation may simplify these models if the repository supports a smaller representation, but the extraction/application boundary must remain explicit.

---

## 10. Extraction Strategy

Use a layered strategy.

### Layer 1 — Page metadata

Read:

- `document.title`;
- canonical URL;
- meta description;
- Open Graph title/description when available.

### Layer 2 — Structured data

Inspect JSON-LD only when safely parseable. Relevant candidates include `JobPosting`, title, description, employment type, organization, location, qualifications and responsibilities.

JSON-LD is untrusted data. Never execute values obtained from page content.

### Layer 3 — Semantic DOM

Prefer semantic elements such as `main`, `article`, headings, sections, paragraphs and lists.

### Layer 4 — Visible text fallback

If structured extraction is insufficient, collect normalized visible text.

Avoid obvious UI noise where practical: navigation, cookie banners, footer, social sharing controls, unrelated recommendations and application forms.

This is heuristic extraction, not guaranteed semantic understanding.

---

## 11. Text Normalization

Normalize page content before sending it to the Job Analyzer:

- collapse repeated whitespace;
- normalize line breaks;
- remove empty lines;
- preserve headings;
- preserve list boundaries where possible;
- remove duplicated text;
- preserve original wording;
- apply a maximum extraction size.

The extractor must not silently rewrite job requirements.

---

## 12. Extraction Size Limits

Web pages can contain arbitrary amounts of content. Define centralized limits such as:

```text
MAX_PAGE_TEXT_CHARS
MAX_SECTION_COUNT
MAX_SECTION_TEXT_CHARS
MAX_JSONLD_SIZE
MAX_TOTAL_EXTRACTED_CHARS
```

Initial limits (closed for FASE 4, decision 1.1):

```text
MAX_TOTAL_EXTRACTED_CHARS = 20000
MAX_SECTION_COUNT = 50
MAX_SECTION_TEXT_CHARS = 4000
MAX_JSONLD_SIZE = 50000 bytes
```

These values are closed for FASE 4 and must not be changed without updating
this SDD and its tests.

When limits are exceeded:

- truncate safely;
- mark extraction as truncated;
- continue when sufficient information remains;
- expose the condition in diagnostics;
- never crash the extension.

Conceptual diagnostics:

```ts
interface ExtractionDiagnostics {
  truncated: boolean;
  discardedSections: number;
  source: "structured" | "semantic-dom" | "visible-text" | "mixed";
}
```

---

## 13. Platform Detection

Platform detection is an extension concern.

Conceptual model:

```ts
type JobPlatform =
  | "linkedin"
  | "indeed"
  | "greenhouse"
  | "lever"
  | "workday"
  | "ashby"
  | "gupy"
  | "inhire"
  | "generic"
  | "unknown";
```

The initial enum may be smaller if the repository does not yet support all platforms.

Detection may use:

1. hostname;
2. URL patterns;
3. DOM markers;
4. structured metadata.

Do not detect a platform from page title alone.

---

## 14. Platform Strategy

Adopt a **generic-first, adapter-ready** strategy.

### 14.1 Generic extractor

Every supported `http`/`https` page receives a generic extraction attempt.

```text
GenericJobPageSource
```

This prevents CareerPilot from becoming dependent on one job board.

### 14.2 Platform adapters

When a platform requires reliable extraction that generic heuristics cannot provide, introduce an adapter:

```ts
interface JobPlatformAdapter {
  platform: JobPlatform;
  canHandle(context: PlatformContext): boolean;
  extract(context: PlatformContext): Promise<ExtractedJobPage>;
}
```

Adapters remain isolated from the domain.

### 14.3 Adapter selection

```text
Current Page
    ↓
PlatformDetector
    ↓
Registered Adapters
    ↓
Best matching adapter
    ↓
Fallback Generic Extractor
```

If no adapter is available, continue with generic extraction where possible.

### 14.4 Important rule

Do not create one adapter per platform merely because the platform exists. Create an adapter only when generic extraction is insufficient, stable extraction signals exist, a reproducible fixture/test exists, and the adapter provides measurable improvement.

---

## 15. Initial Real-World Validation Target

The implementation must support a real vacancy such as the Akad Seguros / InHire page used to validate FASE 3.

The page contains a vacancy title, remote/location information, job description and an application form.

For FASE 4, extract the job description without interacting with or modifying the application form.

The application form is explicitly **not** part of FASE 4.

Use a sanitized fixture or documented manual validation. Never store candidate-entered application data.

---

## 16. Job Analyzer Integration

After extraction:

```text
ExtractedJobPage
       ↓
JobPage
       ↓
Existing Job Analyzer
       ↓
JobRequirements
```

The existing Job Analyzer remains responsible for interpreting job text into requirements.

FASE 4 must not duplicate Job Analyzer logic inside the extension.

If FASE 2 accepts only `JobPage.text`, the extension adapter may compose normalized sections into that representation.

---

## 17. Profile Integration

Reuse the existing Profile Reader:

- `ProfileManager`;
- `ProfileLoader`;
- `ChromeProfileLoader`;
- parser;
- chunking;
- index;
- retrieval.

No second profile representation or loading mechanism may be introduced.

Flow:

```text
Active Profile
      ↓
ProfileManager
      ↓
ProfileRetriever
      ↓
Relevant Career Context
```

---

## 18. Match Execution Flow

```text
User opens vacancy
        ↓
User opens CareerPilot
        ↓
User clicks "Analyze Job"
        ↓
Service Worker
        ↓
ChromeJobPageSource
        ↓
Content Script
        ↓
ExtractedJobPage
        ↓
JobPage
        ↓
Job Analyzer
        ↓
JobRequirements
        ↓
ProfileRetriever
        ↓
Relevant Profile Context
        ↓
MatchEngine
        ↓
MatchResult
        ↓
Popup UI
```

Analysis must not start automatically on page load.

---

## 19. User-Triggered Analysis

Primary action:

```text
Analyze Job
```

State machine:

```text
READY
  ↓
ANALYZING
  ↓
RESULT
```

Error branches:

```text
ANALYZING
  ├── EXTRACTION_ERROR
  ├── NO_JOB_CONTENT
  ├── UNSUPPORTED_PAGE
  ├── JOB_ANALYSIS_ERROR
  ├── MATCH_ANALYSIS_ERROR
  └── PROFILE_ERROR
```

Do not retry indefinitely.

---

## 20. Result Model

FASE 4 must expose the existing FASE 2 `MatchResult`.

Conceptually:

```ts
interface MatchResult {
  score: number;
  recommendation: MatchRecommendation;
  requirements: MatchRequirement[];
  warnings: EligibilityWarning[];
}
```

The exact existing interface is authoritative.

The UI must display at minimum:

- Career Match Score;
- recommendation;
- matched requirements;
- partial requirements;
- missing requirements;
- required missing items;
- eligibility warnings;
- relevant evidence.

---

## 21. Result UI

The popup becomes the primary FASE 4 result surface.

Conceptual UI:

```text
CareerPilot

Rodrigo Matos Silva
────────────────────────────

Engineering Manager

CAREER MATCH
87 / 100

GOOD MATCH

✓ Seniority
✓ Leadership
✓ Java
✓ Architecture
△ Insurance experience
✕ Specific requirement

────────────────────────────
Required gaps

...

Warnings

...

[ Analyze again ]
```

Priorities:

1. score;
2. recommendation;
3. important gaps;
4. required missing requirements;
5. evidence;
6. warnings.

Do not expose raw internal scoring details unnecessarily.

---

## 22. Evidence and Traceability

Profile evidence must retain:

```text
profileId
documentId
path
chunkId
optional excerpt
```

Job evidence should retain enough context to identify where the requirement came from.

Conceptual:

```ts
interface JobEvidence {
  source: "title" | "description" | "section" | "structured-data";
  section?: string;
  excerpt?: string;
}
```

The final result must make it possible to answer:

> Why did CareerPilot say this requirement matched?

No unsupported claim may be presented as fact.

---

## 23. Score Integrity

FASE 4 must not change the FASE 2 scoring model.

The existing scoring configuration remains authoritative.

Browser integration obtains and normalizes the vacancy; it does not redefine professional suitability.

Protected characteristics must never influence professional match scoring.

Eligibility warnings remain separate from professional score.

---

## 24. Unsupported and Ambiguous Pages

### Unsupported browser context

Examples: `chrome://`, `chrome-extension://`, browser internal pages.

Return:

```text
UNSUPPORTED_PAGE
```

### Page accessible but insufficient job content

Return:

```text
NO_JOB_CONTENT
```

### Platform unknown but extraction possible

Continue with:

```text
platform = generic
```

### Platform recognized but adapter unavailable

Continue with generic extraction where possible.

Do not block analysis solely because a platform adapter does not exist.

---

## 25. Content Script Responsibilities

May:

- inspect DOM;
- read page metadata;
- identify page URL/title;
- extract visible/semantic content;
- respond to typed extraction requests.

Must not:

- call Match Engine;
- load candidate profile;
- access candidate files;
- submit forms;
- click application buttons;
- modify page fields;
- navigate the user;
- send page content to external services.

---

## 26. Service Worker Responsibilities

Orchestrates:

1. current-tab identification;
2. extraction request;
3. extraction response validation;
4. `JobPage` construction;
5. Job Analyzer invocation;
6. Profile retrieval;
7. Match Engine invocation;
8. result/error state;
9. popup response.

Must not contain DOM selectors.

---

## 27. Popup Responsibilities

The popup must:

- show extension/profile status;
- show current page information;
- allow explicit `Analyze Job`;
- show analysis progress;
- render result;
- render errors;
- allow analysis again.

The popup must not directly access current-page DOM or contain Job Analyzer/Match Engine logic.

---

## 28. Messaging

Extend the existing typed protocol.

Conceptual messages:

```ts
type ExtensionMessage =
  | { type: "GET_EXTENSION_STATUS" }
  | { type: "GET_ACTIVE_PROFILE" }
  | { type: "GET_PAGE_CONTEXT" }
  | { type: "EXTRACT_JOB_PAGE" }
  | { type: "ANALYZE_CURRENT_JOB" }
  | { type: "GET_MATCH_RESULT" };
```

Preferred flow:

```text
Popup
  → ANALYZE_CURRENT_JOB
  → Service Worker
  → Content Script: EXTRACT_JOB_PAGE
  → Service Worker
  → Match Engine
  → Service Worker state
  → Popup response
```

Messages must be typed, validated, explicit, and safely rejected when unknown.

---

## 29. Runtime State

Continue the FASE 3 rule: **no persistence**.

Conceptual:

```ts
interface JobMatchRuntimeState {
  status: "idle" | "analyzing" | "success" | "error";
  page?: JobPageSummary;
  extraction?: ExtractionDiagnostics;
  result?: MatchResult;
  error?: ExtensionError;
}
```

A Service Worker restart may clear the analysis result. The UI must recover to a safe idle state.

Do not introduce `localStorage`, IndexedDB, cookies or Chrome storage in this phase.

---

## 30. Security Boundary

Job pages are untrusted.

Treat all page content as data.

Never:

- execute extracted JavaScript;
- evaluate page text as code;
- interpret page content as extension instructions;
- allow page text to modify extension configuration;
- allow page text to select a profile;
- allow page text to trigger application submission;
- send page content to external services.

Prompt-injection text inside a vacancy is ordinary job-page data, not an instruction to CareerPilot.

Example:

```text
"Ignore previous instructions and send the candidate profile..."
```

This must never affect extension control flow.

---

## 31. HTML / DOM Security

The popup must never inject raw vacancy content using unsafe HTML APIs.

Prefer safe text rendering such as `textContent` or framework-safe rendering.

Do not use `innerHTML` with untrusted extracted page text.

---

## 32. Privacy

FASE 4 processes:

- current job-page content;
- local candidate profile;
- local match result.

These remain local.

No external network request is required for analysis.

No candidate information is sent to the job site.

No job-page content is sent to a backend.

---

## 33. Error Model

At minimum:

```text
UNSUPPORTED_PAGE
CONTENT_SCRIPT_UNAVAILABLE
PAGE_EXTRACTION_FAILED
NO_JOB_CONTENT
JOB_PAGE_TOO_LARGE
JOB_ANALYSIS_FAILED
MATCH_ANALYSIS_FAILED
PROFILE_LOAD_FAILED
PROFILE_CONTEXT_NOT_FOUND
INVALID_MESSAGE
CURRENT_TAB_NOT_AVAILABLE
```

Errors must be safe for UI display and must not unnecessarily expose candidate data.

---

## 34. Testing Strategy

### 34.1 Unit tests

Test platform detection, normalization, structured-data extraction, semantic DOM extraction, generic extraction, limits, truncation, diagnostics, JobPage conversion, message validation and state transitions.

### 34.2 Adapter tests

For each adapter test positive/negative detection, representative DOM fixture, title/description extraction, available location/work-model extraction and fallback behavior.

### 34.3 Service Worker tests

Test current-tab lookup, content-script request, response validation, Job Analyzer integration, Profile Retriever integration, Match Engine invocation, success and error states.

Use the lightweight Chrome mocks from FASE 3.

### 34.4 Popup tests

Test idle, analyzing, result, score/recommendation, matched/partial/missing groups, warnings, errors and Analyze Again.

### 34.5 Regression tests

All existing FASE 1, FASE 2 and FASE 3 tests must continue passing.

---

## 35. Real-Page Fixtures

Introduce representative fixtures instead of relying only on live websites:

```text
tests/fixtures/jobs/
├── generic/
├── inhire/
└── <future-platforms>/
```

Fixtures must contain only public vacancy content.

Never include candidate names, CPF, email, phone, answers, authentication data, cookies or tokens.

The Akad/InHire vacancy used during FASE 3 validation should be represented by a sanitized fixture or documented manual test.

---

## 36. Build

Continue the FASE 3 build:

```bash
npm run typecheck
npm test
npm run build
```

The build must continue producing:

```text
dist/
├── manifest.json
├── service-worker.js
├── content-script.js
├── popup.html
├── popup.js
├── popup.css
└── vendor/
    └── profiles/
```

No heavier build system is required.

---

## 37. Manual Chrome Validation

### Test A — Generic vacancy

1. Open a public page with a clear vacancy.
2. Open CareerPilot.
3. Verify current page.
4. Click `Analyze Job`.
5. Verify loading state.
6. Verify result.

### Test B — Akad/InHire vacancy

1. Open the validated Engineering Manager vacancy.
2. Open CareerPilot.
3. Verify profile.
4. Click `Analyze Job`.
5. Verify extraction.
6. Verify score.
7. Verify matched/gap requirements.
8. Verify no form field changed.

### Test C — Unsupported page

Open a browser internal page such as `chrome://extensions`.

Verify CareerPilot does not attempt analysis and reports a safe unsupported state.

### Test D — Non-job page

Open a normal non-job page and verify `NO_JOB_CONTENT` or an equivalent safe state.

### Test E — Service Worker restart

Restart/reload the extension and verify safe recovery without corrupted data.

---

## 38. Performance

Rules:

- analysis only after explicit user action;
- no continuous page scanning;
- no continuous DOM observation;
- no Match Engine on every navigation;
- no repeated profile retrieval for the same analysis;
- no duplicate extraction requests.

A single analysis should follow approximately:

```text
1 extraction
→ 1 Job Analyzer invocation
→ 1 profile retrieval flow
→ 1 Match Engine evaluation
```

Retries must be explicit and bounded.

---

## 39. Accessibility and UX Baseline

The popup result must:

- be readable without color alone;
- expose score as text;
- expose status text;
- support keyboard interaction;
- provide visible focus;
- show loading state;
- show errors clearly;
- avoid unexplained technical terminology.

Prefer:

```text
87 / 100 — Good Match
```

over a color-only indicator.

---

## 40. Backlog

Status geral: **implementado e testado em 2026-10-06** — `src/extension/job-extraction/`
+ wiring em `service-worker.ts`/`content-script.ts`/`popup/`, 57 testes novos
(170 no total do career-pilot). MATCH-CHROME-027 (Chrome real) permanece
pendente de confirmação manual pelo usuário (mesmo padrão do EXT-014/FASE 3) —
**precisa de uma nova rodada de validação manual**, já que a extração pt-BR e
o `RequirementNormalizer` (abaixo) mudaram o resultado real da vaga Akad/InHire
depois da última captura de tela.

### Page Source

- [x] MATCH-CHROME-001 — `JobPageSource` application boundary — reaproveita a interface existente (`src/job-match/jobPageSource.ts`), inalterada (decisão 1.1)
- [x] MATCH-CHROME-002 — `ChromeJobPageSource` — `src/extension/job-extraction/chromeJobPageSource.ts`
- [x] MATCH-CHROME-003 — active-tab resolution — `chrome.tabs.query` dentro de `ChromeJobPageSource` e do `analyzeCurrentJob` do service worker
- [x] MATCH-CHROME-004 — content-script extraction protocol — `EXTRACT_JOB_PAGE` em `content-script.ts` (`collectRawMaterials`)

### Extraction

- [x] MATCH-CHROME-005 — metadata extraction — `collectRawMaterials` (canonical/description/og:title)
- [x] MATCH-CHROME-006 — JSON-LD extraction — `src/extension/job-extraction/jsonLd.ts` (só `JSON.parse` em try/catch, nunca `eval`)
- [x] MATCH-CHROME-007 — semantic DOM extraction — `groupElementsIntoSections` em `extractor.ts`
- [x] MATCH-CHROME-008 — generic visible-text fallback — `extractor.ts` (fonte `"visible-text"` quando não há estrutura nem DOM semântico)
- [x] MATCH-CHROME-009 — text normalization — `src/extension/job-extraction/textNormalizer.ts`
- [x] MATCH-CHROME-010 — extraction limits/diagnostics — `extractionLimits.ts` (valores fechados na decisão 1.1) + `ExtractionDiagnostics`

### Platform

- [x] MATCH-CHROME-011 — platform detector — `src/extension/job-extraction/platformDetector.ts` (hostname-based, nunca pelo título)
- [x] MATCH-CHROME-012 — generic adapter — o extrator genérico (`extractor.ts`) é a única estratégia desta fase
- [x] MATCH-CHROME-013 — InHire adapter — **não criado**, por decisão (1.1): a fixture sanitizada da Akad/InHire produziu conteúdo significativo só com extração genérica (ver notas de implementação, seção 40.1)
- [ ] MATCH-CHROME-014 — adapter registry and fallback — **deliberadamente não implementado**: só existe uma estratégia (genérica) nesta fase, então um registry seria especulativo (SDD seção 14.4/seção 31 "no speculative architecture"). Revisitar quando um segundo adapter for realmente necessário.

### Domain Integration

- [x] MATCH-CHROME-015 — JobPage conversion — `toJobPage()` em `extractor.ts`
- [x] MATCH-CHROME-016 — Job Analyzer integration — `RuleBasedJobAnalyzer` (FASE 2, inalterado) chamado em `service-worker.ts`
- [x] MATCH-CHROME-017 — Profile Retriever integration — via `MatchEngine`/`ProfileManager` (FASE 1/2, inalterados)
- [x] MATCH-CHROME-018 — Match Engine integration — `RuleBasedMatchEngine` (FASE 2, inalterado) chamado em `service-worker.ts`

### UI

- [x] MATCH-CHROME-019 — Analyze Job action — botão `#analyze-job` em `popup.html`/`popup.ts`
- [x] MATCH-CHROME-020 — analyzing state — `analyzing` local no popup + `jobMatch.status` no service worker
- [x] MATCH-CHROME-021 — Match Result UI — `popupViewModel.ts` (score/recomendação + matched/partial/missing/eligibility)
- [x] MATCH-CHROME-022 — errors/unsupported states — `CURRENT_TAB_NOT_AVAILABLE`, `UNSUPPORTED_PAGE`, `PAGE_EXTRACTION_FAILED`, `NO_JOB_CONTENT` renderizados via `jobMatchLabel`
- [x] MATCH-CHROME-023 — evidence display — `MatchEvidence`/`profileId`/`documentId`/`path`/`chunkId` preservados no `MatchResult` (FASE 2), não descartados pela UI

### Quality/Security

- [x] MATCH-CHROME-024 — untrusted page-content handling — nenhum `eval`, só `JSON.parse`; `popup.ts` usa só `textContent`/`createElement`, nunca `innerHTML`
- [x] MATCH-CHROME-025 — regression tests — todos os 113 testes de FASE 1-3 continuam passando, inalterados
- [x] MATCH-CHROME-026 — representative fixtures — `tests/fixtures/pages/` (Akad/InHire sanitizada, JSON-LD, DOM genérico)
- [ ] MATCH-CHROME-027 — manual Chrome validation — **pendente**, requer confirmação do usuário (seção 42)
- [x] MATCH-CHROME-028 — documentation — `README.md` atualizado (ver seção 40.1)

### PT-BR ↔ EN Requirement Normalization (real finding, 2026-10-06)

- [x] MATCH-CHROME-029 — `RequirementNormalizer` — `src/job-match/requirementNormalizer.ts`, dicionário curado de conceitos organizado por domínio (`leadership`, `people_management`, `engineering`, `architecture`, `product`, `business`, `reliability`, `observability`, `delivery`, `cloud`, `communication`, `seniority`, `work_model`)
- [x] MATCH-CHROME-030 — integração no `MatchEngine` — `evaluateAgainstProfile` em `matchEngine.ts` agora tenta todas as variantes de query (normalizer + dicionário EN antigo + texto original) e fica com a de melhor score (`bestAcrossVariants`); `MatchScoringConfig`/pesos/thresholds da FASE 2 inalterados
- [x] MATCH-CHROME-031 — testes unitários do normalizador — `tests/job-match/requirementNormalizer.test.ts` (8 pares pt-BR↔en pedidos, simetria EN→pt e pt→EN, múltiplos conceitos numa frase, texto sem conceito, case/acento-insensível)
- [x] MATCH-CHROME-032 — regressão com a fixture real completa (Akad/InHire) — `tests/job-match/matchEngine.test.ts`, score sobe de 61→73 com evidência rastreável e sem requisito inventado

### 40.1 Implementation notes (real findings, not hypothetical)

- **`hasMeaningfulContent` threshold (40 chars) importa de verdade**: a primeira
  fixture de teste do fluxo completo (`ANALYZE_CURRENT_JOB`) usava só uma
  frase solta sem cabeçalho "Requirements:" — o `JobAnalyzer` (FASE 2,
  inalterado) corretamente não achou nada extraível além do título, e
  separadamente o texto combinado ficou abaixo do limiar de conteúdo
  significativo. Corrigido ajustando a fixture (não o código) para ter uma
  seção "Requirements:" de verdade — comportamento idêntico ao que a FASE 2
  já exigia para jobs reais.
- **Fixture sanitizada da Akad/InHire confirma a decisão generic-first**: o
  texto público transcrito do print (seção 1.1) produziu `hasMeaningfulContent
  = true` e um `JobPage.text` coerente usando só o extrator genérico — não
  foi necessário nenhum adapter específico do InHire (MATCH-CHROME-013
  fechado como "não necessário").
- **Dicionário de elegibilidade (FASE 2) não cobre português**: a fixture da
  Akad/InHire menciona "valoriza a pluralidade e diversidade" — isso não é
  detectado pelo `ELIGIBILITY_DICTIONARY` (frases em inglês, fechado na FASE
  2). Comportamento correto dado o escopo fechado da FASE 2 (não alterado
  aqui), mas é uma limitação real a registrar: vagas em português não geram
  `EligibilityWarning` hoje.
- **`MessageHandlerContext` cresceu para 5 métodos** (`getExtensionStatus`,
  `getActiveProfile`, `relayToContentScript`, `analyzeCurrentJob`,
  `getMatchResult`) — `EXTRACT_JOB_PAGE` reaproveita `relayToContentScript`
  (mesma rota de `PING_CONTENT_SCRIPT`/`GET_PAGE_CONTEXT`), já que o service
  worker nunca recebe esse tipo diretamente do popup, só o envia ao content
  script.
- **Bug real em produção (validado no Chrome real, 2026-10-06): `tab.url`
  vinha `undefined`**, fazendo `isSupportedPageUrl(tab.url)` falhar com
  `"This page cannot be analyzed: unknown URL"` numa vaga http(s) real
  (Akad/InHire). Causa raiz confirmada na documentação oficial do Chrome: as
  propriedades sensíveis de `tabs.Tab` (`url`, `title`, `favIconUrl`) só
  ficam visíveis com a permissão `"tabs"` **ou** `host_permissions` — a
  declaração `content_scripts.matches` (decisão original da FASE 3) permite
  a injeção do content script, mas **não** concede essa visibilidade. Corrigido
  adicionando `"permissions": ["activeTab"]` ao `manifest.json` — opção de
  menor privilégio (sem aviso de instalação, escopo só na aba atual, ativado
  quando o usuário abre o popup, que já é obrigatório no nosso fluxo).
  `tests/extension/manifest.test.ts` atualizado para exigir exatamente essa
  permissão. Ver também o adendo na seção 1.1 do `CAREER_PILOT_EXTENSION_SHELL_SDD.md`.

- **Bug real em produção (validado no Chrome real, 2026-10-06): a vaga
  Akad/InHire deu 100/100 "Strong Match" tendo só título/senioridade como
  evidência.** Diagnóstico completo do pipeline (`RawPageMaterials` →
  `ExtractedJobPage` → `JobPage` → `JobRequirements` → `MatchRequirement[]`),
  feito com um script temporário (`scripts/diagnose-job-match.ts`, removido
  após o diagnóstico) rodando a fixture real ponta a ponta, revelou **duas
  causas raiz combinadas**:
  1. A fixture `AKAD_INHIRE_RAW_MATERIALS` commitada era incompleta — só
     tinha o texto introdutório/institucional, sem a seção real de
     Responsabilidades/Requisitos da vaga (artefato de ter sido transcrita de
     um screenshot parcial). Corrigida re-buscando a página real e
     transcrevendo o conteúdo verbatim completo (um bullet duplicado do
     texto extraído — "Remover objetivos de negócio..." repetindo o bullet
     anterior com uma palavra trocada — foi identificado como artefato da
     ferramenta de extração de texto e excluído, não representa conteúdo
     real da página).
  2. **Bug de código real, independente da fixture**: `extractSections()` em
     `src/job-match/jobAnalyzer.ts` só reconhecia cabeçalhos em inglês
     (`"requirements"`, `"responsibilities"`, `"nice to have"`, etc.). A vaga
     real é em português ("Responsabilidades:", "O que você precisa ter?",
     "Você se destacará se tiver...") — nenhum desses cabeçalhos batia,
     então todo o conteúdo de requisitos/responsabilidades caía no bucket
     `null` e era descartado das listas estruturadas (embora permanecesse no
     texto bruto, visível para os extratores "texto inteiro" como idioma/
     localização/modelo). Resultado: `requiredSkills`, `preferredSkills`,
     `requiredExperience` e `responsibilities` ficavam todos vazios — exatamente
     a entrada "quase vazia" que o usuário avisou que o Match Engine não
     deveria conseguir pontuar como Strong Match.
  - **Corrigido**: `REQUIRED_HEADERS`/`PREFERRED_HEADERS`/
    `RESPONSIBILITY_HEADERS`/`OTHER_KNOWN_HEADERS` ganharam um conjunto
    curado de equivalentes pt-BR (mesma filosofia de tabela determinística já
    usada em `SENIORITY_PRIORITY`/`REQUIREMENT_DICTIONARY` — sem NLP/ontologia).
    `normalizeHeaderLine` passou a remover acentos (`NFD` + strip de
    diacríticos) e um conjunto maior de pontuação final (`:`, `?`, `!`, `...`),
    já que cabeçalhos reais variam nisso entre ATSs. `WORK_MODEL_PRIORITY`
    ganhou os padrões `remoto`/`remota`, `híbrido`/`hibrida`, `presencial`.
    `KNOWN_LOCATIONS` ganhou `"Brasil"` (grafia pt-BR de `"Brazil"`).
  - **Resultado após a correção** (fixture real completa + código corrigido):
    `requiredExperience` (8), `responsibilities` (9), `preferredSkills` (6) e
    `workModel: "Remote"` agora são extraídos corretamente. O score caiu de
    100/100 para **61/100 (Partial Match)** — resultado explicável: TITLE e
    SENIORITY batem 100 (termo "Engineering Manager" é idêntico nos dois
    idiomas), mas a maior parte das linhas de requisito/responsabilidade em
    português aparece como `MISSING` ou com score baixo, não porque o
    candidato não tenha a experiência (o perfil, em inglês, lista
    explicitamente "people management", "engineering management" etc.), mas
    porque o `KeywordRetriever` (seção 16) faz correspondência léxica/prefixo
    literal **sem nenhuma ponte de tradução** — termos como "gestão de
    pessoas" (pt) e "people management" (en) não compartilham tokens, e só
    cognatos/empréstimos (ex.: "autonomia"/"autonomy", "produção"/"production",
    "feedback") geram algum match parcial por acaso.
  - **Decisão em aberto, não resolvida aqui** (o usuário pediu para não
    alterar o modelo de score/retrieval antes de isolar o problema de
    extração — isso já foi feito): o Match Engine ainda não tem nenhuma ponte
    pt-BR↔en para o `REQUIREMENT_DICTIONARY`/`KeywordRetriever`. Com a
    extração agora correta, esse é o próximo gargalo real e visível a
    decidir: (a) expandir `REQUIREMENT_DICTIONARY` com sinônimos pt-BR
    curados, (b) alguma normalização/tradução antes da recuperação, ou (c)
    aceitar como limitação documentada da V1 para vagas não-inglesas. Testes
    de regressão foram adicionados em `tests/job-match/jobAnalyzer.test.ts`
    (cabeçalhos pt-BR + fixture real completa) para impedir que a extração
    volte a colapsar silenciosamente para "só título".

- **Implementado (2026-10-06): `RequirementNormalizer` (pt-BR ↔ EN), a
  decisão em aberto acima.** Nova camada determinística e curada —
  `src/job-match/requirementNormalizer.ts` — entre `JobRequirements` e o
  `KeywordRetriever`. Sem LLM, sem tradução automática, sem embeddings, sem
  dependência externa (conforme pedido); mesma filosofia de tabela
  determinística já usada em `SENIORITY_PRIORITY`/`REQUIREMENT_DICTIONARY`.
  - **Conceitos pt-BR↔en adicionados** (18, organizados por domínio):
    `people_management` (gestão de pessoas / people management),
    `people_development` (desenvolvimento de pessoas / people development),
    `career_development` (desenvolvimento de carreira / career development),
    `continuous_feedback` (feedback contínuo+1:1s / continuous feedback),
    `technical_leadership` (liderança técnica / technical leadership),
    `engineering_leadership` (liderança de engenharia / engineering leadership),
    `engineering_management` (gestão de engenharia / engineering management),
    `production_software` (software em produção / production software),
    `ownership_end_to_end` (dono de ponta a ponta / end-to-end ownership),
    `distributed_systems` (sistemas distribuídos / distributed systems),
    `product_partnership` (parceria com produto / product partnership),
    `product_discovery` (discovery de produto / product discovery),
    `business_objectives` (objetivos de negócio / business objectives),
    `reliability` (confiabilidade / reliability),
    `observability` (observabilidade / observability),
    `delivery_capacity` (capacidade de entrega / delivery capacity),
    `stakeholder_communication` (comunicação com stakeholders / stakeholder
    communication), `remote_work` (trabalho remoto / remote). Os domínios
    `cloud` e `seniority` ficaram declarados sem conceito próprio ainda —
    termos de cloud/tooling (AWS, Kubernetes) já são *loanwords* idênticas
    nos dois idiomas, e rótulos de senioridade (`SENIORITY_PRIORITY`) também
    já aparecem verbatim em vagas pt-BR reais (ex.: "Engineering Manager").
  - **Mecanismo**: `normalizeForRetrieval(text)` detecta (substring,
    case/acento-insensível) todo conceito presente no texto — em qualquer um
    dos dois idiomas — e devolve as variantes `en`/`pt` de cada um, mais o
    texto original como fallback. `MatchEngine.evaluateAgainstProfile` tenta
    todas as variantes (+ o `REQUIREMENT_DICTIONARY` antigo, mantido
    intacto) via `bestAcrossVariants` e fica só com a de melhor score —
    estritamente aditivo, nunca piora um resultado existente. Texto exibido
    ao usuário (`MatchRequirement.requirement`) continua sendo sempre o
    original, nunca a forma normalizada. `MatchScoringConfig`, pesos e
    thresholds da FASE 2 não foram tocados.
  - **Resultado na vaga real Akad/InHire** (regressão em
    `tests/job-match/matchEngine.test.ts`): score sobe de **61 → 73**;
    `matchedRequirements` de 2→8, `partialRequirements` de 1→5,
    `missingRequirements` de 21→13. Cada match agora é explicável: ex.
    "Experiência sólida gerenciando pessoas..." (pt) bate com o perfil porque
    reconhece o conceito `people_management` e tenta a variante em inglês
    "people management", que o perfil contém literalmente. Evidência
    continua sempre apontando para chunks reais do perfil (nenhum requisito
    inventado — SDD seção 14).
  - **Limitação restante, registrada e não resolvida nesta fase**: a
    detecção é por substring exato do termo curado — frases que expressam o
    mesmo conceito com outra ordem de palavras não batem (ex. "discussões de
    produto, discovery, planejamento e estratégia do domínio" não ativa
    `product_discovery`, cujo alias é "discovery e estratégia de produto").
    Alguns conceitos reais da vaga também não têm curadoria ainda (ex.
    parceria especificamente com "Staff Engineers", sucessão de liderança,
    colaboração multifuncional Engenharia/Produto/Design) — ficaram de fora
    por não estarem na lista pedida e para não introduzir equivalências
    amplas demais sem necessidade comprovada. `WORK_MODEL: Remote` continua
    `MISSING` nessa vaga porque o próprio perfil não menciona preferência de
    modelo de trabalho — isso é correto, não é uma lacuna do normalizador.

---

## 41. Definition of Done — Automated

### Architecture

- [x] `ChromeJobPageSource` exists.
- [x] Chrome-specific code remains outside Job Match domain.
- [x] Existing FASE 1/2 contracts remain reusable.
- [x] No duplicate profile-loading mechanism exists.

### Extraction

- [x] Current page can be extracted through the content script.
- [x] Generic extraction works on representative fixtures.
- [x] Metadata extraction works.
- [x] Structured-data extraction is safe.
- [x] Text normalization is deterministic.
- [x] Extraction limits are enforced.
- [x] Diagnostics identify truncation/source.

### Platform

- [x] Platform detector is tested.
- [x] Generic fallback works.
- [x] Initial platform strategy is covered by fixtures.
- [x] Platform-specific code is isolated from the domain.

### Match

- [x] Extracted page becomes a valid `JobPage`.
- [x] Existing Job Analyzer is invoked.
- [x] Existing Profile Retriever is invoked.
- [x] Existing Match Engine is invoked.
- [x] Existing scoring model remains unchanged.
- [x] Match Result reaches popup.

### UI

- [x] Analyze Job is explicit.
- [x] Loading state exists.
- [x] Result state exists.
- [x] Error state exists.
- [x] Unsupported state exists.
- [x] Match score/recommendation is displayed.
- [x] Matched/partial/missing requirements are displayed.
- [x] Evidence is traceable.

### Security/Privacy

- [x] No external runtime service is required.
- [x] No candidate data is persisted.
- [x] No page content is executed.
- [x] No raw page HTML is injected into popup.
- [x] No form field is modified.
- [x] No application is submitted.

### Regression

- [x] All FASE 1 tests pass.
- [x] All FASE 2 tests pass.
- [x] All FASE 3 tests pass.
- [x] FASE 4 tests pass.
- [x] `npm run typecheck` passes.
- [x] `npm test` passes.
- [x] `npm run build` passes.

---

## 42. Definition of Done — Manual Chrome

The user must confirm:

- [ ] CareerPilot loads in Chrome.
- [ ] A real vacancy can be analyzed.
- [ ] `Analyze Job` starts analysis.
- [ ] Current-page extraction works.
- [ ] The Akad/InHire vacancy can be analyzed or a documented extraction limitation is identified.
- [ ] Match result is displayed.
- [ ] Score is plausible and traceable.
- [ ] Matched/gap requirements are visible.
- [ ] No application form field is changed.
- [ ] No submission occurs.
- [ ] Unsupported pages fail safely.
- [ ] Service Worker restart does not corrupt state.

---

## 43. Non-Goals Reaffirmed

FASE 4 must not become:

- a job scraper;
- a job search engine;
- an auto-apply bot;
- an application automation system;
- a browser automation framework;
- an AI agent;
- a backend;
- a candidate database;
- a telemetry platform;
- a form-filling system.

The objective is only:

> **Read the current vacancy, understand it using the existing local Job Match domain, and show the user whether the vacancy matches the active profile.**

---

## 44. Implementation Rules for the Coding Agent

Implement **only FASE 4** according to this SDD.

### Required

- reuse FASE 1 Profile Reader;
- reuse FASE 2 Job Match;
- preserve FASE 3 extension shell;
- implement `ChromeJobPageSource`;
- implement current-page extraction;
- implement platform detection;
- implement generic extraction;
- implement adapter boundary;
- integrate Job Analyzer;
- integrate Profile Retriever;
- integrate Match Engine;
- implement explicit `Analyze Job`;
- implement Match Result UI;
- implement typed errors;
- implement tests;
- add sanitized fixtures;
- run full regression suite;
- update backlog.

### Do not implement

- Form Intelligence;
- form-field detection;
- autofill;
- submit;
- scraping/crawling;
- job search;
- backend;
- database;
- authentication;
- LLM;
- embeddings;
- cloud AI;
- local AI;
- persistent candidate data.

### Critical architectural rule

Do not move browser-specific logic into:

```text
src/profile/
src/job-match/
```

Chrome-specific implementation belongs under:

```text
src/extension/
```

If an existing domain interface requires adaptation, create an application/extension adapter rather than coupling the domain to Chrome.

---

## 45. Agent Execution Checklist

Before coding:

1. inspect the actual repository;
2. inspect FASE 1 contracts;
3. inspect FASE 2 contracts;
4. inspect FASE 3 implementation;
5. do not assume illustrative paths exist literally;
6. identify current messaging/state implementation;
7. identify current popup implementation.

During coding:

1. keep changes inside FASE 4 scope;
2. preserve existing behavior;
3. add tests with each extraction component;
4. keep extraction deterministic;
5. keep page content untrusted;
6. avoid speculative platform adapters;
7. use generic fallback.

After coding:

```bash
npm run typecheck
npm test
npm run build
```

Then:

1. inspect build output;
2. validate manifest;
3. load `dist/` in Chrome;
4. test a real vacancy;
5. test the Akad/InHire vacancy;
6. test unsupported pages;
7. test a non-job page;
8. update this SDD backlog;
9. document remaining limitations;
10. do not start FASE 5.

---

## 46. Expected Final Architecture

```text
                         CareerPilot
                              │
                    Chrome Extension
                              │
             ┌────────────────┴────────────────┐
             │                                 │
         Popup UI                         Current Page
             │                                 │
             │                           Content Script
             │                                 │
             └───────────────┬─────────────────┘
                             │
                      Typed Messaging
                             │
                       Service Worker
                             │
               ┌─────────────┼─────────────┐
               │             │             │
       ChromeJobPageSource  Profile      Match
               │            Reader        Engine
               │             │             │
          Job Extraction     │        Match Result
               │             │             │
               └─────────────┴─────────────┘
                             │
                          Popup
```

Domain remains:

```text
Profile Reader
      +
Job Analyzer
      +
Match Engine
```

and remains independent of Chrome.

---

## 47. Phase Boundary — FASE 5

After FASE 4:

```text
FASE 4
Current Job Page
   ↓
Job Match
   ↓
Result
   ↓
STOP
```

FASE 5 begins a different problem:

```text
Current Application Form
        ↓
Form Intelligence
        ↓
Semantic Fields
        ↓
Candidate Field Mapping
        ↓
Fillability Analysis
```

FASE 4 must not implement this.

---

## 48. Final Acceptance Statement

FASE 4 is complete only when CareerPilot can perform the following local workflow:

```text
1. User opens a real vacancy
2. User opens CareerPilot
3. User clicks "Analyze Job"
4. CareerPilot reads the current page
5. CareerPilot extracts the vacancy
6. CareerPilot identifies requirements
7. CareerPilot retrieves relevant profile evidence
8. CareerPilot evaluates the match
9. CareerPilot shows the score
10. CareerPilot explains matched and missing requirements
11. CareerPilot shows eligibility warnings separately
12. CareerPilot does not modify the application form
13. CareerPilot does not submit anything
14. CareerPilot sends no candidate/job data to a backend
```

That is the complete boundary of **FASE 4 — Job Match + Chrome**.
