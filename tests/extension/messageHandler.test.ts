import { describe, expect, it, vi } from "vitest";
import { handleMessage } from "../../src/extension/messaging/message-handler.js";
import type { MessageHandlerContext } from "../../src/extension/messaging/message-handler.js";
import type { ExtensionResponse } from "../../src/extension/messaging/messages.js";

function makeCtx(overrides: Partial<MessageHandlerContext> = {}): MessageHandlerContext {
  return {
    getExtensionStatus: () => ({ success: true, data: { initialized: true, activeProfileId: "rodrigo-matos" } }),
    getActiveProfile: async () => ({ success: true, data: { id: "rodrigo-matos", name: "Rodrigo Matos Silva" } }),
    relayToContentScript: async () => ({ success: true, data: { alive: true } }),
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

  it("routes PING_CONTENT_SCRIPT and GET_PAGE_CONTEXT to ctx.relayToContentScript", async () => {
    const relay = vi.fn(async (): Promise<ExtensionResponse> => ({ success: true, data: { alive: true } }));
    const ctx = makeCtx({ relayToContentScript: relay });

    await handleMessage({ type: "PING_CONTENT_SCRIPT" }, ctx);
    await handleMessage({ type: "GET_PAGE_CONTEXT" }, ctx);

    expect(relay).toHaveBeenCalledTimes(2);
    expect(relay).toHaveBeenNthCalledWith(1, { type: "PING_CONTENT_SCRIPT" });
    expect(relay).toHaveBeenNthCalledWith(2, { type: "GET_PAGE_CONTEXT" });
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
