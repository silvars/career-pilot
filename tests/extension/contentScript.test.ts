import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("content-script", () => {
  let messageListener:
    | ((message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean)
    | undefined;

  beforeEach(async () => {
    vi.resetModules();
    messageListener = undefined;

    (globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: {
        onMessage: {
          addListener: (
            fn: (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean
          ) => {
            messageListener = fn;
          },
        },
      },
    };

    // Minimal stand-ins for the two DOM reads this shell needs — no jsdom
    // (decision 1.1): the content script only reads location.href/title.
    (globalThis as unknown as { window: unknown }).window = {
      location: { href: "https://example.com/jobs/123" },
    };
    (globalThis as unknown as { document: unknown }).document = { title: "Backend Engineer" };

    await import("../../src/extension/content/content-script.js");
  });

  afterEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
    delete (globalThis as unknown as { window?: unknown }).window;
    delete (globalThis as unknown as { document?: unknown }).document;
  });

  function send(message: unknown): unknown {
    let response: unknown;
    messageListener!(message, {}, (r) => {
      response = r;
    });
    return response;
  }

  it("responds to PING_CONTENT_SCRIPT confirming it is alive", () => {
    expect(send({ type: "PING_CONTENT_SCRIPT" })).toEqual({ success: true, data: { alive: true } });
  });

  it("responds to GET_PAGE_CONTEXT with the page url and title", () => {
    expect(send({ type: "GET_PAGE_CONTEXT" })).toEqual({
      success: true,
      data: { url: "https://example.com/jobs/123", title: "Backend Engineer" },
    });
  });

  it("does not send complete page content, only url/title (SDD section 9)", () => {
    const response = send({ type: "GET_PAGE_CONTEXT" }) as { data: Record<string, unknown> };
    expect(Object.keys(response.data).sort()).toEqual(["title", "url"]);
  });

  it("ignores messages it does not handle", () => {
    expect(send({ type: "GET_EXTENSION_STATUS" })).toBeUndefined();
  });
});
