import { ExtensionError, toErrorPayload } from "../errors.js";
import { isExtensionMessage } from "./messages.js";
import type { ExtensionMessage, ExtensionResponse } from "./messages.js";

export interface MessageHandlerContext {
  getExtensionStatus(): ExtensionResponse;
  getActiveProfile(): Promise<ExtensionResponse>;
  relayToContentScript(message: ExtensionMessage): Promise<ExtensionResponse>;
  analyzeCurrentJob(): Promise<ExtensionResponse>;
  getMatchResult(): ExtensionResponse;
  /** FASE 4.1-A/B viability spikes ONLY — remove once the decision gate is resolved. */
  runEmbeddingSpike(): Promise<ExtensionResponse>;
  runOffscreenEmbeddingSpike(): Promise<ExtensionResponse>;
  /** FASE 4.1 (Local Semantic Retrieval): keyword-only vs hybrid retrieval quality comparison. */
  runRetrievalBenchmark(): Promise<ExtensionResponse>;
  /** FASE 5 (Form Intelligence): orchestrates extraction -> classification -> retrieval -> answers; read-only. */
  analyzeForm(): Promise<ExtensionResponse>;
  getFormIntelligence(): ExtensionResponse;
}

/**
 * Chrome-agnostic message router (SDD section 11): the Service Worker wires
 * this to `chrome.runtime.onMessage`, but the routing logic itself takes no
 * Chrome dependency and is fully unit-testable.
 */
export async function handleMessage(
  message: unknown,
  ctx: MessageHandlerContext
): Promise<ExtensionResponse> {
  if (!isExtensionMessage(message)) {
    return {
      success: false,
      error: new ExtensionError(
        "INVALID_MESSAGE",
        `Unknown or malformed message: ${JSON.stringify(message)}`
      ).toPayload(),
    };
  }

  try {
    switch (message.type) {
      case "GET_EXTENSION_STATUS":
        return ctx.getExtensionStatus();
      case "GET_ACTIVE_PROFILE":
        return await ctx.getActiveProfile();
      case "PING_CONTENT_SCRIPT":
      case "GET_PAGE_CONTEXT":
      case "EXTRACT_JOB_PAGE":
      case "EXTRACT_FORM":
        return await ctx.relayToContentScript(message);
      case "ANALYZE_CURRENT_JOB":
        return await ctx.analyzeCurrentJob();
      case "GET_MATCH_RESULT":
        return ctx.getMatchResult();
      case "RUN_EMBEDDING_SPIKE":
        return await ctx.runEmbeddingSpike();
      case "RUN_OFFSCREEN_EMBEDDING_SPIKE":
        return await ctx.runOffscreenEmbeddingSpike();
      case "RUN_RETRIEVAL_BENCHMARK":
        return await ctx.runRetrievalBenchmark();
      case "ANALYZE_FORM":
        return await ctx.analyzeForm();
      case "GET_FORM_INTELLIGENCE":
        return ctx.getFormIntelligence();
    }
  } catch (cause) {
    return { success: false, error: toErrorPayload(cause) };
  }
}
