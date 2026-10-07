import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

// FASE 4.1-A viability spike ONLY (remove once the decision gate is
// resolved): the real @huggingface/transformers package resolves to a
// Node-native ONNX binding under Node/vitest that isn't available in this
// environment — irrelevant to these service-worker orchestration tests, so
// it's mocked out here rather than loaded for real.
vi.mock("../../src/extension/background/embeddingSpike.js", () => ({
  runEmbeddingSpike: vi.fn(async () => ({ overall: "NOT_VIABLE", steps: [] })),
}));

const VALID_PROFILE_JSON = JSON.stringify({
  id: "rodrigo-matos",
  name: "Rodrigo Matos Silva",
  version: "1.0.0",
  documents: [{ path: "skills/technical.md", type: "skills" }],
});

const SKILLS_MD = "# Technical Skills\n\n## Backend\n\nJava, Spring Boot, AWS.\n";

const JOB_RAW_MATERIALS = {
  url: "https://example.com/jobs/1",
  documentTitle: "Backend Engineer",
  jsonLdTexts: [],
  elements: [
    { tag: "H1", text: "Backend Engineer" },
    { tag: "P", text: "We are hiring a backend engineer for our platform team." },
    { tag: "H2", text: "Requirements" },
    { tag: "LI", text: "Java" },
    { tag: "LI", text: "Spring Boot" },
    { tag: "LI", text: "AWS" },
  ],
  visibleText: "",
};

const FORM_RAW_MATERIALS = {
  url: "https://example.com/jobs/1/apply",
  elements: [
    { tag: "INPUT", inputType: "email", id: "email", required: true, labelText: "Email" },
    { tag: "INPUT", inputType: "text", id: "salary", required: false, labelText: "Expected salary" },
  ],
};

describe("service-worker", () => {
  let messageListener:
    | ((message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean)
    | undefined;
  let tabsQueryMock: Mock;
  let tabsSendMessageMock: Mock;

  beforeEach(async () => {
    vi.resetModules();
    messageListener = undefined;

    tabsQueryMock = vi.fn(async () => [{ id: 42, url: "https://example.com/jobs/1" }]);
    tabsSendMessageMock = vi.fn(async (_tabId: number, message: { type: string }) => {
      if (message.type === "EXTRACT_JOB_PAGE") {
        return { success: true, data: JOB_RAW_MATERIALS };
      }
      if (message.type === "EXTRACT_FORM") {
        return { success: true, data: FORM_RAW_MATERIALS };
      }
      return { success: true, data: { alive: true } };
    });

    (globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: {
        getURL: (path: string) => `chrome-extension://fake-id/${path}`,
        onMessage: {
          addListener: (
            fn: (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean
          ) => {
            messageListener = fn;
          },
        },
        // FASE 4.1-B spike only: minimal stubs so the auto-run on startup
        // doesn't noisily reject in every test (it's fire-and-forget/caught
        // regardless, these just keep test output clean). `connect` returns
        // a fake Port whose onMessage never fires — the auto-run's promise
        // simply never resolves, which is fine since nothing awaits it here.
        getContexts: vi.fn(async () => []),
        connect: vi.fn(() => {
          const listeners: Array<(message: unknown) => void> = [];
          const port = {
            onMessage: { addListener: (fn: (message: unknown) => void) => listeners.push(fn) },
            onDisconnect: { addListener: vi.fn() },
            postMessage: vi.fn((message: { type?: string }) => {
              // No real embedding runtime in tests: EMBED_TEXTS always
              // fails fast so HybridRetriever gracefully degrades to
              // keyword-only instead of the port just hanging (as the old
              // fake port used to, which only ever backed the
              // fire-and-forget spike auto-run, never an awaited call).
              if (message?.type === "EMBED_TEXTS") {
                listeners.forEach((listener) => listener({ ok: false, error: "no embedding runtime in tests" }));
              }
            }),
            disconnect: vi.fn(),
          };
          return port;
        }),
        ContextType: { OFFSCREEN_DOCUMENT: "OFFSCREEN_DOCUMENT" },
      },
      offscreen: {
        createDocument: vi.fn(async () => undefined),
        Reason: { WORKERS: "WORKERS" },
      },
      tabs: {
        query: tabsQueryMock,
        sendMessage: tabsSendMessageMock,
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("profile.json")) {
          return new Response(VALID_PROFILE_JSON, { status: 200 });
        }
        if (url.endsWith("skills/technical.md")) {
          return new Response(SKILLS_MD, { status: 200 });
        }
        return new Response(null, { status: 404 });
      })
    );

    await import("../../src/extension/background/service-worker.js");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  function send(message: unknown): Promise<unknown> {
    return new Promise((resolve) => {
      messageListener!(message, {}, resolve);
    });
  }

  it("initializes and responds to GET_EXTENSION_STATUS", async () => {
    const response = await send({ type: "GET_EXTENSION_STATUS" });
    expect(response).toEqual({
      success: true,
      data: { initialized: true, activeProfileId: "rodrigo-matos" },
    });
  });

  it("responds to GET_ACTIVE_PROFILE with the loaded profile", async () => {
    const response = await send({ type: "GET_ACTIVE_PROFILE" });
    expect(response).toEqual({
      success: true,
      data: { id: "rodrigo-matos", name: "Rodrigo Matos Silva" },
    });
  });

  it("only loads the profile once, even though both module-load and the first message trigger initialization", async () => {
    await send({ type: "GET_EXTENSION_STATUS" });
    await send({ type: "GET_ACTIVE_PROFILE" });

    const fetchMock = globalThis.fetch as unknown as Mock;
    const manifestFetches = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("profile.json"));
    expect(manifestFetches).toHaveLength(1);
  });

  it("relays PING_CONTENT_SCRIPT to the active tab via chrome.tabs.sendMessage", async () => {
    const response = await send({ type: "PING_CONTENT_SCRIPT" });
    expect(tabsQueryMock).toHaveBeenCalled();
    expect(tabsSendMessageMock).toHaveBeenCalledWith(42, { type: "PING_CONTENT_SCRIPT" });
    expect(response).toEqual({ success: true, data: { alive: true } });
  });

  it("returns CONTENT_SCRIPT_UNAVAILABLE when there is no active tab", async () => {
    tabsQueryMock.mockResolvedValueOnce([]);
    const response = (await send({ type: "GET_PAGE_CONTEXT" })) as { success: boolean; error?: { code: string } };
    expect(response.success).toBe(false);
    expect(response.error?.code).toBe("CONTENT_SCRIPT_UNAVAILABLE");
  });

  it("returns CONTENT_SCRIPT_UNAVAILABLE when chrome.tabs.sendMessage rejects (unsupported page)", async () => {
    tabsSendMessageMock.mockRejectedValueOnce(new Error("Could not establish connection. Receiving end does not exist."));
    const response = (await send({ type: "GET_PAGE_CONTEXT" })) as { success: boolean; error?: { code: string } };
    expect(response.success).toBe(false);
    expect(response.error?.code).toBe("CONTENT_SCRIPT_UNAVAILABLE");
  });

  it("fails safely for an invalid message", async () => {
    const response = (await send({ type: "NOT_REAL" })) as { success: boolean; error?: { code: string } };
    expect(response.success).toBe(false);
    expect(response.error?.code).toBe("INVALID_MESSAGE");
  });

  describe("ANALYZE_CURRENT_JOB", () => {
    it("runs the full extraction -> analysis -> match flow and returns a MatchResult", async () => {
      const response = (await send({ type: "ANALYZE_CURRENT_JOB" })) as {
        success: boolean;
        data?: { score: number; recommendation: string; profileId: string };
      };

      expect(response.success).toBe(true);
      expect(response.data?.profileId).toBe("rodrigo-matos");
      expect(["STRONG_MATCH", "GOOD_MATCH", "PARTIAL_MATCH", "LOW_MATCH"]).toContain(
        response.data?.recommendation
      );
      expect(tabsSendMessageMock).toHaveBeenCalledWith(42, { type: "EXTRACT_JOB_PAGE" });
    });

    it("stores the result so a later GET_MATCH_RESULT returns it without re-analyzing", async () => {
      await send({ type: "ANALYZE_CURRENT_JOB" });
      tabsSendMessageMock.mockClear();

      const response = (await send({ type: "GET_MATCH_RESULT" })) as { success: boolean; data: unknown };

      expect(response.success).toBe(true);
      expect(response.data).not.toBeNull();
      expect(tabsSendMessageMock).not.toHaveBeenCalled();
    });

    it("returns data: null from GET_MATCH_RESULT before any analysis has run", async () => {
      const response = (await send({ type: "GET_MATCH_RESULT" })) as { success: boolean; data: unknown };
      expect(response).toEqual({ success: true, data: null });
    });

    it("returns CURRENT_TAB_NOT_AVAILABLE when there is no active tab", async () => {
      tabsQueryMock.mockResolvedValueOnce([]);
      const response = (await send({ type: "ANALYZE_CURRENT_JOB" })) as {
        success: boolean;
        error?: { code: string };
      };
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe("CURRENT_TAB_NOT_AVAILABLE");
    });

    it("returns UNSUPPORTED_PAGE for a browser-internal URL", async () => {
      tabsQueryMock.mockResolvedValueOnce([{ id: 42, url: "chrome://extensions" }]);
      const response = (await send({ type: "ANALYZE_CURRENT_JOB" })) as {
        success: boolean;
        error?: { code: string };
      };
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe("UNSUPPORTED_PAGE");
    });

    it("maps a content-script extraction failure to PAGE_EXTRACTION_FAILED", async () => {
      tabsSendMessageMock.mockRejectedValueOnce(new Error("Could not establish connection."));
      const response = (await send({ type: "ANALYZE_CURRENT_JOB" })) as {
        success: boolean;
        error?: { code: string };
      };
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe("PAGE_EXTRACTION_FAILED");
    });

    it("maps insufficient job content to NO_JOB_CONTENT", async () => {
      tabsSendMessageMock.mockResolvedValueOnce({
        success: true,
        data: { url: "https://example.com/empty", documentTitle: "", jsonLdTexts: [], elements: [], visibleText: "" },
      });
      const response = (await send({ type: "ANALYZE_CURRENT_JOB" })) as {
        success: boolean;
        error?: { code: string };
      };
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe("NO_JOB_CONTENT");
    });
  });

  describe("RUN_RETRIEVAL_BENCHMARK", () => {
    it("compares keyword-only vs hybrid retrieval and reports Recall@3/Recall@5/MRR without crashing", async () => {
      const response = (await send({ type: "RUN_RETRIEVAL_BENCHMARK" })) as {
        success: boolean;
        data?: {
          keywordOnly: { recallAt3: number; recallAt5: number; mrr: number };
          hybrid: { recallAt3: number; recallAt5: number; mrr: number };
        };
      };

      expect(response.success).toBe(true);
      // The test fixture profile has none of the benchmark's expected
      // chunks (skills/leadership.md, achievements/leadership-impact.md),
      // and there's no real embedding runtime in this environment — so
      // every case legitimately comes back "not found" for both retrievers.
      // This test only asserts the wiring doesn't crash and the shape is
      // correct; real quality numbers require manual testing in Chrome.
      expect(response.data?.keywordOnly.recallAt3).toBe(0);
      expect(response.data?.hybrid.recallAt3).toBe(0);
    });
  });

  describe("FASE 5 — Form Intelligence", () => {
    it("ANALYZE_FORM runs the full extraction -> classification -> answer pipeline", async () => {
      const response = (await send({ type: "ANALYZE_FORM" })) as {
        success: boolean;
        data?: { fields: unknown[]; intents: unknown[]; answers: unknown[]; summary: { totalFields: number } };
      };

      expect(response.success).toBe(true);
      expect(response.data?.fields).toHaveLength(2);
      expect(response.data?.intents).toHaveLength(2);
      expect(response.data?.answers).toHaveLength(2);
      expect(response.data?.summary.totalFields).toBe(2);
      expect(tabsSendMessageMock).toHaveBeenCalledWith(42, { type: "EXTRACT_FORM" });
    });

    it("stores the result so a later GET_FORM_INTELLIGENCE returns it without re-analyzing", async () => {
      await send({ type: "ANALYZE_FORM" });
      tabsSendMessageMock.mockClear();

      const response = (await send({ type: "GET_FORM_INTELLIGENCE" })) as { success: boolean; data: unknown };

      expect(response.success).toBe(true);
      expect(response.data).not.toBeNull();
      expect(tabsSendMessageMock).not.toHaveBeenCalled();
    });

    it("returns data: null from GET_FORM_INTELLIGENCE before any analysis has run", async () => {
      const response = (await send({ type: "GET_FORM_INTELLIGENCE" })) as { success: boolean; data: unknown };
      expect(response).toEqual({ success: true, data: null });
    });

    it("returns NO_FORM_CONTENT when the page has no form fields", async () => {
      tabsSendMessageMock.mockImplementationOnce(async (_tabId: number, message: { type: string }) => {
        if (message.type === "EXTRACT_FORM") {
          return { success: true, data: { url: "https://example.com/empty", elements: [] } };
        }
        return { success: true, data: { alive: true } };
      });

      const response = (await send({ type: "ANALYZE_FORM" })) as { success: boolean; error?: { code: string } };
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe("NO_FORM_CONTENT");
    });

    it("returns CURRENT_TAB_NOT_AVAILABLE when there is no active tab", async () => {
      tabsQueryMock.mockResolvedValueOnce([]);
      const response = (await send({ type: "ANALYZE_FORM" })) as { success: boolean; error?: { code: string } };
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe("CURRENT_TAB_NOT_AVAILABLE");
    });
  });

  describe("FASE 6.3 — Autofill Review UI + Execution", () => {
    it("BUILD_AUTOFILL_PLAN fails with NO_FORM_INTELLIGENCE_RESULT when no form has been analyzed yet", async () => {
      const response = (await send({ type: "BUILD_AUTOFILL_PLAN" })) as { success: boolean; error?: { code: string } };
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe("NO_FORM_INTELLIGENCE_RESULT");
    });

    it("builds a plan from the last ANALYZE_FORM result without re-extracting or reclassifying", async () => {
      await send({ type: "ANALYZE_FORM" });
      tabsSendMessageMock.mockClear();

      const response = (await send({ type: "BUILD_AUTOFILL_PLAN" })) as {
        success: boolean;
        data?: { actions: unknown[]; summary: { total: number } };
      };

      expect(response.success).toBe(true);
      expect(response.data?.summary.total).toBe(2);
      // Building the plan must never touch the content script (no new extraction/classification).
      expect(tabsSendMessageMock).not.toHaveBeenCalled();
    });

    it("stores the plan so a later GET_AUTOFILL_PLAN returns it without rebuilding", async () => {
      await send({ type: "ANALYZE_FORM" });
      await send({ type: "BUILD_AUTOFILL_PLAN" });

      const response = (await send({ type: "GET_AUTOFILL_PLAN" })) as { success: boolean; data: unknown };
      expect(response.success).toBe(true);
      expect(response.data).not.toBeNull();
    });

    it("returns data: null from GET_AUTOFILL_PLAN before any plan has been built", async () => {
      const response = (await send({ type: "GET_AUTOFILL_PLAN" })) as { success: boolean; data: unknown };
      expect(response).toEqual({ success: true, data: null });
    });

    it("EXECUTE_AUTOFILL_PLAN relays the plan to the content script unchanged and returns its result", async () => {
      const fakeResult = {
        success: true,
        fields: [{ fieldId: "email", success: true, expectedValue: "x@example.com", actualValue: "x@example.com" }],
        summary: { attempted: 1, filled: 1, failed: 0, skipped: 0 },
      };
      tabsSendMessageMock.mockImplementationOnce(async (_tabId: number, message: { type: string }) => {
        if (message.type === "EXECUTE_AUTOFILL_PLAN") {
          return { success: true, data: fakeResult };
        }
        return { success: true, data: { alive: true } };
      });

      const plan = {
        actions: [
          { fieldId: "email", action: "SET_VALUE", value: "x@example.com", confidence: 0.9, requiresReview: false },
        ],
        summary: { total: 1, fillable: 1, requiresReview: 0, skipped: 0 },
      };

      const response = (await send({ type: "EXECUTE_AUTOFILL_PLAN", plan })) as {
        success: boolean;
        data?: unknown;
      };

      expect(response.success).toBe(true);
      expect(response.data).toEqual(fakeResult);
      expect(tabsSendMessageMock).toHaveBeenCalledWith(42, { type: "EXECUTE_AUTOFILL_PLAN", plan });
    });

    it("returns CONTENT_SCRIPT_UNAVAILABLE when the content script doesn't respond to EXECUTE_AUTOFILL_PLAN", async () => {
      tabsSendMessageMock.mockRejectedValueOnce(new Error("Could not establish connection."));
      const plan = { actions: [], summary: { total: 0, fillable: 0, requiresReview: 0, skipped: 0 } };

      const response = (await send({ type: "EXECUTE_AUTOFILL_PLAN", plan })) as {
        success: boolean;
        error?: { code: string };
      };

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe("CONTENT_SCRIPT_UNAVAILABLE");
    });
  });
});
