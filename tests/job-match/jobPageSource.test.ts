import { describe, expect, it } from "vitest";
import { FixtureJobPageSource } from "../../src/job-match/jobPageSource.js";

describe("FixtureJobPageSource", () => {
  it("returns the configured job page", async () => {
    const source = new FixtureJobPageSource({ text: "Software Engineer\n\nJava required." });
    const page = await source.getCurrentJobPage();
    expect(page.text).toContain("Software Engineer");
  });

  it("throws JOB_PAGE_NOT_READABLE when no page is configured", async () => {
    const source = new FixtureJobPageSource(null);
    await expect(source.getCurrentJobPage()).rejects.toMatchObject({
      code: "JOB_PAGE_NOT_READABLE",
    });
  });

  it("throws JOB_PAGE_NOT_READABLE when the configured page has empty text", async () => {
    const source = new FixtureJobPageSource({ text: "   " });
    await expect(source.getCurrentJobPage()).rejects.toMatchObject({
      code: "JOB_PAGE_NOT_READABLE",
    });
  });
});
