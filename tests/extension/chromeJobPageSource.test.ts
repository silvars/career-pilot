import { afterEach, describe, expect, it, vi } from "vitest";
import { ChromeJobPageSource } from "../../src/extension/job-extraction/chromeJobPageSource.js";
import { AKAD_INHIRE_RAW_MATERIALS } from "../fixtures/pages/akadInhire.js";

function installChrome(overrides: {
  tabs?: Array<{ id: number }>;
  sendMessageImpl?: () => Promise<unknown>;
}) {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    tabs: {
      query: vi.fn(async () => overrides.tabs ?? [{ id: 1 }]),
      sendMessage: vi.fn(overrides.sendMessageImpl ?? (async () => ({ success: true, data: AKAD_INHIRE_RAW_MATERIALS }))),
    },
  };
}

describe("ChromeJobPageSource", () => {
  afterEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  it("returns a valid JobPage built from the content script's extraction response", async () => {
    installChrome({});
    const source = new ChromeJobPageSource();

    const job = await source.getCurrentJobPage();

    expect(job.url).toBe(AKAD_INHIRE_RAW_MATERIALS.url);
    expect(job.platform).toBe("inhire");
    expect(job.text).toContain("Engineering Manager");
  });

  it("throws JOB_PAGE_NOT_READABLE when there is no active tab", async () => {
    installChrome({ tabs: [] });
    const source = new ChromeJobPageSource();

    await expect(source.getCurrentJobPage()).rejects.toMatchObject({ code: "JOB_PAGE_NOT_READABLE" });
  });

  it("throws JOB_PAGE_NOT_READABLE when chrome.tabs.sendMessage rejects (unsupported page)", async () => {
    installChrome({
      sendMessageImpl: async () => {
        throw new Error("Could not establish connection.");
      },
    });
    const source = new ChromeJobPageSource();

    await expect(source.getCurrentJobPage()).rejects.toMatchObject({ code: "JOB_PAGE_NOT_READABLE" });
  });

  it("throws JOB_PAGE_NOT_READABLE when the content script responds with success: false", async () => {
    installChrome({
      sendMessageImpl: async () => ({ success: false, error: { code: "INTERNAL_ERROR", message: "boom" } }),
    });
    const source = new ChromeJobPageSource();

    await expect(source.getCurrentJobPage()).rejects.toMatchObject({ code: "JOB_PAGE_NOT_READABLE" });
  });

  it("throws JOB_REQUIREMENTS_NOT_FOUND when the extracted page has no meaningful content", async () => {
    installChrome({
      sendMessageImpl: async () => ({
        success: true,
        data: { url: "https://example.com/empty", documentTitle: "", jsonLdTexts: [], elements: [], visibleText: "" },
      }),
    });
    const source = new ChromeJobPageSource();

    await expect(source.getCurrentJobPage()).rejects.toMatchObject({ code: "JOB_REQUIREMENTS_NOT_FOUND" });
  });
});
