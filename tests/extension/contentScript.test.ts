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

  describe("EXTRACT_JOB_PAGE", () => {
    interface FakeElement {
      tagName: string;
      textContent: string;
      children: FakeElement[];
      getAttribute(): string | null;
      querySelectorAll(selector: string): FakeElement[];
      remove(): void;
      cloneNode(): FakeElement;
      innerText: string;
    }

    // Minimal hand-rolled DOM double (no jsdom, decision 1.1): just enough to
    // exercise the EXTRACT_JOB_PAGE message wiring. Extraction *quality* is
    // fully covered, DOM-free, by tests/extension/job-extraction/extractor.test.ts.
    function makeElement(tag: string, text: string, children: FakeElement[] = []): FakeElement {
      const el: FakeElement = {
        tagName: tag,
        textContent: text,
        children,
        getAttribute: () => null,
        querySelectorAll(selector: string) {
          const tags = selector.split(",").map((s) => s.trim().toUpperCase());
          const results: FakeElement[] = [];
          const walk = (node: FakeElement) => {
            for (const child of node.children) {
              if (tags.includes(child.tagName)) {
                results.push(child);
              }
              walk(child);
            }
          };
          walk(el);
          return results;
        },
        remove() {},
        cloneNode(): FakeElement {
          return makeElement(tag, text, children.map((c) => c.cloneNode()));
        },
        innerText: text,
      };
      return el;
    }

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

      const body = makeElement("BODY", "", [
        makeElement("H1", "Fake Job Title"),
        makeElement("P", "Fake job description paragraph."),
      ]);

      (globalThis as unknown as { window: unknown }).window = {
        location: { href: "https://example.com/jobs/1" },
      };
      (globalThis as unknown as { document: unknown }).document = {
        title: "Fake Job Title - Example Careers",
        body,
        querySelector: () => null,
        querySelectorAll: () => [],
      };

      await import("../../src/extension/content/content-script.js");
    });

    it("responds with structured raw materials, never raw HTML", () => {
      const response = send({ type: "EXTRACT_JOB_PAGE" }) as {
        success: boolean;
        data: { elements: Array<{ tag: string; text: string }>; url: string; documentTitle: string };
      };

      expect(response.success).toBe(true);
      expect(response.data.url).toBe("https://example.com/jobs/1");
      expect(response.data.documentTitle).toBe("Fake Job Title - Example Careers");
      expect(response.data.elements).toEqual([
        { tag: "H1", text: "Fake Job Title" },
        { tag: "P", text: "Fake job description paragraph." },
      ]);
    });
  });
});
