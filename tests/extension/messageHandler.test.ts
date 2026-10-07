import { describe, expect, it, vi } from "vitest";
import { handleMessage } from "../../src/extension/messaging/message-handler.js";
import type { MessageHandlerContext } from "../../src/extension/messaging/message-handler.js";
import type { ExtensionResponse } from "../../src/extension/messaging/messages.js";

function makeCtx(overrides: Partial<MessageHandlerContext> = {}): MessageHandlerContext {
  return {
    getExtensionStatus: () => ({ success: true, data: { initialized: true, activeProfileId: "rodrigo-matos" } }),
    getActiveProfile: async () => ({ success: true, data: { id: "rodrigo-matos", name: "Rodrigo Matos Silva" } }),
    relayToContentScript: async () => ({ success: true, data: { alive: true } }),
    analyzeCurrentJob: async () => ({ success: true, data: null }),
    getMatchResult: () => ({ success: true, data: null }),
    runEmbeddingSpike: async () => ({ success: true, data: null }),
    runOffscreenEmbeddingSpike: async () => ({ success: true, data: null }),
    runRetrievalBenchmark: async () => ({ success: true, data: null }),
    analyzeForm: async () => ({ success: true, data: null }),
    getFormIntelligence: () => ({ success: true, data: null }),
    buildAutofillPlan: () => ({ success: true, data: null }),
    getAutofillPlan: () => ({ success: true, data: null }),
    executeAutofillPlan: async () => ({ success: true, data: null }),
    ...overrides,
  };
}

describe("handleMessage", () => {
  it("fails safely for an unknown/malformed message (INVALID_MESSAGE)", async () => {
    const response = await handleMessage({ type: "NOT_A_REAL_MESSAGE" }, makeCtx());
    expect(response.success).toBe(false);
    expect(response.error?.code).toBe("INVALID_MESSAGE");
  });

  it("fails safely for a non-object message", async () => {
    const response = await handleMessage("just a string", makeCtx());
    expect(response.success).toBe(false);
    expect(response.error?.code).toBe("INVALID_MESSAGE");
  });

  it("routes GET_EXTENSION_STATUS to ctx.getExtensionStatus", async () => {
    const response = await handleMessage({ type: "GET_EXTENSION_STATUS" }, makeCtx());
    expect(response).toEqual({ success: true, data: { initialized: true, activeProfileId: "rodrigo-matos" } });
  });

  it("routes GET_ACTIVE_PROFILE to ctx.getActiveProfile", async () => {
    const response = await handleMessage({ type: "GET_ACTIVE_PROFILE" }, makeCtx());
    expect(response).toEqual({ success: true, data: { id: "rodrigo-matos", name: "Rodrigo Matos Silva" } });
  });

  it("routes PING_CONTENT_SCRIPT, GET_PAGE_CONTEXT, EXTRACT_JOB_PAGE and EXTRACT_FORM to ctx.relayToContentScript", async () => {
    const relay = vi.fn(async (): Promise<ExtensionResponse> => ({ success: true, data: { alive: true } }));
    const ctx = makeCtx({ relayToContentScript: relay });

    await handleMessage({ type: "PING_CONTENT_SCRIPT" }, ctx);
    await handleMessage({ type: "GET_PAGE_CONTEXT" }, ctx);
    await handleMessage({ type: "EXTRACT_JOB_PAGE" }, ctx);
    await handleMessage({ type: "EXTRACT_FORM" }, ctx);

    expect(relay).toHaveBeenCalledTimes(4);
    expect(relay).toHaveBeenNthCalledWith(1, { type: "PING_CONTENT_SCRIPT" });
    expect(relay).toHaveBeenNthCalledWith(2, { type: "GET_PAGE_CONTEXT" });
    expect(relay).toHaveBeenNthCalledWith(3, { type: "EXTRACT_JOB_PAGE" });
    expect(relay).toHaveBeenNthCalledWith(4, { type: "EXTRACT_FORM" });
  });

  it("routes ANALYZE_CURRENT_JOB to ctx.analyzeCurrentJob", async () => {
    const analyze = vi.fn(async (): Promise<ExtensionResponse> => ({ success: true, data: { score: 90 } }));
    const ctx = makeCtx({ analyzeCurrentJob: analyze });

    const response = await handleMessage({ type: "ANALYZE_CURRENT_JOB" }, ctx);

    expect(analyze).toHaveBeenCalledTimes(1);
    expect(response).toEqual({ success: true, data: { score: 90 } });
  });

  it("routes GET_MATCH_RESULT to ctx.getMatchResult", async () => {
    const getResult = vi.fn((): ExtensionResponse => ({ success: true, data: null }));
    const ctx = makeCtx({ getMatchResult: getResult });

    const response = await handleMessage({ type: "GET_MATCH_RESULT" }, ctx);

    expect(getResult).toHaveBeenCalledTimes(1);
    expect(response).toEqual({ success: true, data: null });
  });

  it("routes RUN_EMBEDDING_SPIKE to ctx.runEmbeddingSpike (FASE 4.1-A spike only)", async () => {
    const spike = vi.fn(async (): Promise<ExtensionResponse> => ({ success: true, data: { overall: "VIABLE" } }));
    const ctx = makeCtx({ runEmbeddingSpike: spike });

    const response = await handleMessage({ type: "RUN_EMBEDDING_SPIKE" }, ctx);

    expect(spike).toHaveBeenCalledTimes(1);
    expect(response).toEqual({ success: true, data: { overall: "VIABLE" } });
  });

  it("routes RUN_OFFSCREEN_EMBEDDING_SPIKE to ctx.runOffscreenEmbeddingSpike (FASE 4.1-B spike only)", async () => {
    const spike = vi.fn(async (): Promise<ExtensionResponse> => ({ success: true, data: { overall: "VIABLE" } }));
    const ctx = makeCtx({ runOffscreenEmbeddingSpike: spike });

    const response = await handleMessage({ type: "RUN_OFFSCREEN_EMBEDDING_SPIKE" }, ctx);

    expect(spike).toHaveBeenCalledTimes(1);
    expect(response).toEqual({ success: true, data: { overall: "VIABLE" } });
  });

  it("routes RUN_RETRIEVAL_BENCHMARK to ctx.runRetrievalBenchmark", async () => {
    const benchmark = vi.fn(
      async (): Promise<ExtensionResponse> => ({ success: true, data: { recallAt3: 1 } })
    );
    const ctx = makeCtx({ runRetrievalBenchmark: benchmark });

    const response = await handleMessage({ type: "RUN_RETRIEVAL_BENCHMARK" }, ctx);

    expect(benchmark).toHaveBeenCalledTimes(1);
    expect(response).toEqual({ success: true, data: { recallAt3: 1 } });
  });

  it("routes ANALYZE_FORM to ctx.analyzeForm", async () => {
    const analyzeForm = vi.fn(async (): Promise<ExtensionResponse> => ({ success: true, data: { summary: {} } }));
    const ctx = makeCtx({ analyzeForm });

    const response = await handleMessage({ type: "ANALYZE_FORM" }, ctx);

    expect(analyzeForm).toHaveBeenCalledTimes(1);
    expect(response).toEqual({ success: true, data: { summary: {} } });
  });

  it("routes GET_FORM_INTELLIGENCE to ctx.getFormIntelligence", async () => {
    const getFormIntelligence = vi.fn((): ExtensionResponse => ({ success: true, data: null }));
    const ctx = makeCtx({ getFormIntelligence });

    const response = await handleMessage({ type: "GET_FORM_INTELLIGENCE" }, ctx);

    expect(getFormIntelligence).toHaveBeenCalledTimes(1);
    expect(response).toEqual({ success: true, data: null });
  });

  it("routes BUILD_AUTOFILL_PLAN to ctx.buildAutofillPlan", async () => {
    const buildAutofillPlan = vi.fn((): ExtensionResponse => ({ success: true, data: { actions: [] } }));
    const ctx = makeCtx({ buildAutofillPlan });

    const response = await handleMessage({ type: "BUILD_AUTOFILL_PLAN" }, ctx);

    expect(buildAutofillPlan).toHaveBeenCalledTimes(1);
    expect(response).toEqual({ success: true, data: { actions: [] } });
  });

  it("routes GET_AUTOFILL_PLAN to ctx.getAutofillPlan", async () => {
    const getAutofillPlan = vi.fn((): ExtensionResponse => ({ success: true, data: null }));
    const ctx = makeCtx({ getAutofillPlan });

    const response = await handleMessage({ type: "GET_AUTOFILL_PLAN" }, ctx);

    expect(getAutofillPlan).toHaveBeenCalledTimes(1);
    expect(response).toEqual({ success: true, data: null });
  });

  it("routes EXECUTE_AUTOFILL_PLAN to ctx.executeAutofillPlan, passing the plan through unchanged", async () => {
    const plan = {
      actions: [{ fieldId: "fullName", action: "SET_VALUE" as const, value: "Rodrigo", confidence: 0.9, requiresReview: false }],
      summary: { total: 1, fillable: 1, requiresReview: 0, skipped: 0 },
    };
    const executeAutofillPlan = vi.fn(async (): Promise<ExtensionResponse> => ({ success: true, data: { success: true, fields: [], summary: { attempted: 1, filled: 1, failed: 0, skipped: 0 } } }));
    const ctx = makeCtx({ executeAutofillPlan });

    const response = await handleMessage({ type: "EXECUTE_AUTOFILL_PLAN", plan }, ctx);

    expect(executeAutofillPlan).toHaveBeenCalledTimes(1);
    expect(executeAutofillPlan).toHaveBeenCalledWith(plan);
    expect(response.success).toBe(true);
  });

  it("converts a thrown error from the context into an INTERNAL_ERROR response instead of crashing", async () => {
    const ctx = makeCtx({
      getActiveProfile: async () => {
        throw new Error("boom");
      },
    });

    const response = await handleMessage({ type: "GET_ACTIVE_PROFILE" }, ctx);
    expect(response.success).toBe(false);
    expect(response.error?.code).toBe("INTERNAL_ERROR");
  });

  it("propagates a typed error payload (e.g. CONTENT_SCRIPT_UNAVAILABLE) surfaced by the context", async () => {
    const ctx = makeCtx({
      relayToContentScript: async () => ({
        success: false,
        error: { code: "CONTENT_SCRIPT_UNAVAILABLE", message: "no content script on this page" },
      }),
    });

    const response = await handleMessage({ type: "GET_PAGE_CONTEXT" }, ctx);
    expect(response.success).toBe(false);
    expect(response.error?.code).toBe("CONTENT_SCRIPT_UNAVAILABLE");
  });
});
