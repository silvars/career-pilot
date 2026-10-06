import { describe, expect, it } from "vitest";
import { detectPlatform, isSupportedPageUrl } from "../../../src/extension/job-extraction/platformDetector.js";

describe("detectPlatform", () => {
  it.each([
    ["https://www.linkedin.com/jobs/view/123", "linkedin"],
    ["https://www.indeed.com/viewjob?jk=abc", "indeed"],
    ["https://boards.greenhouse.io/example/jobs/123", "greenhouse"],
    ["https://jobs.lever.co/example/123", "lever"],
    ["https://example.myworkday.com/en-US/job/123", "workday"],
    ["https://jobs.ashbyhq.com/example/123", "ashby"],
    ["https://portal.gupy.io/job/123", "gupy"],
    ["https://akadseguros.inhire.app/vagas/123/engineering-manager", "inhire"],
    ["https://jobs.example.com/role", "generic"],
  ])("detects %s as %s", (url, expected) => {
    expect(detectPlatform(url)).toBe(expected);
  });

  it("does not detect a platform from the page title alone (SDD section 13)", () => {
    // A generic URL whose only "LinkedIn-like" signal would be the title —
    // detectPlatform never receives a title, only the URL, by design.
    expect(detectPlatform("https://careers.example.com/vaga")).toBe("generic");
  });

  it("returns unknown for an unparsable URL", () => {
    expect(detectPlatform("not a url")).toBe("unknown");
  });
});

describe("isSupportedPageUrl", () => {
  it("accepts http/https pages", () => {
    expect(isSupportedPageUrl("https://example.com/jobs/1")).toBe(true);
    expect(isSupportedPageUrl("http://example.com/jobs/1")).toBe(true);
  });

  it("rejects browser-internal schemes", () => {
    expect(isSupportedPageUrl("chrome://extensions")).toBe(false);
    expect(isSupportedPageUrl("chrome-extension://abcdefg/popup.html")).toBe(false);
    expect(isSupportedPageUrl("about:blank")).toBe(false);
    expect(isSupportedPageUrl("edge://settings")).toBe(false);
  });

  it("rejects the Chrome Web Store", () => {
    expect(isSupportedPageUrl("https://chromewebstore.google.com/detail/x")).toBe(false);
  });

  it("rejects undefined/empty/unparsable values", () => {
    expect(isSupportedPageUrl(undefined)).toBe(false);
    expect(isSupportedPageUrl("")).toBe(false);
    expect(isSupportedPageUrl("not a url")).toBe(false);
  });
});
