import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

const VALID_PROFILE_JSON = JSON.stringify({
  id: "rodrigo-matos",
  name: "Rodrigo Matos Silva",
  version: "1.0.0",
  documents: [],
});

describe("service-worker", () => {
  let messageListener:
    | ((message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean)
    | undefined;
  let tabsQueryMock: Mock;
  let tabsSendMessageMock: Mock;

  beforeEach(async () => {
    vi.resetModules();
    messageListener = undefined;

    tabsQueryMock = vi.fn(async () => [{ id: 42 }]);
    tabsSendMessageMock = vi.fn(async () => ({ success: true, data: { alive: true } }));

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
});
