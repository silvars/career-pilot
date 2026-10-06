import { describe, expect, it } from "vitest";
import { extractJobPostingFromJsonLd } from "../../../src/extension/job-extraction/jsonLd.js";
import { EXTRACTION_LIMITS } from "../../../src/extension/job-extraction/extractionLimits.js";

describe("extractJobPostingFromJsonLd", () => {
  it("extracts title and description from a JobPosting, stripping HTML tags", () => {
    const jsonLd = JSON.stringify({
      "@type": "JobPosting",
      title: "Senior Backend Engineer",
      description: "<p>Join our <strong>platform</strong> team.</p>",
    });

    const result = extractJobPostingFromJsonLd([jsonLd]);

    expect(result).toEqual({ title: "Senior Backend Engineer", description: "Join our platform team." });
  });

  it("finds a JobPosting nested inside an @graph array", () => {
    const jsonLd = JSON.stringify({
      "@graph": [
        { "@type": "Organization", name: "Example Corp" },
        { "@type": "JobPosting", title: "Data Engineer", description: "Build pipelines." },
      ],
    });

    expect(extractJobPostingFromJsonLd([jsonLd])).toEqual({ title: "Data Engineer", description: "Build pipelines." });
  });

  it("finds a JobPosting when @type is an array of types", () => {
    const jsonLd = JSON.stringify({ "@type": ["JobPosting", "Thing"], title: "T", description: "D" });
    expect(extractJobPostingFromJsonLd([jsonLd])).toEqual({ title: "T", description: "D" });
  });

  it("never throws on malformed JSON — only JSON.parse inside try/catch, skips and continues", () => {
    const malformed = "{ not valid json";
    const valid = JSON.stringify({ "@type": "JobPosting", title: "OK", description: "Fine." });

    expect(() => extractJobPostingFromJsonLd([malformed, valid])).not.toThrow();
    expect(extractJobPostingFromJsonLd([malformed, valid])).toEqual({ title: "OK", description: "Fine." });
  });

  it("skips a JSON-LD blob larger than the configured limit without parsing it", () => {
    const oversized = JSON.stringify({
      "@type": "JobPosting",
      title: "Too big",
      description: "x".repeat(EXTRACTION_LIMITS.maxJsonLdBytes + 1),
    });
    expect(extractJobPostingFromJsonLd([oversized])).toBeUndefined();
  });

  it("returns undefined when no script contains a JobPosting", () => {
    const jsonLd = JSON.stringify({ "@type": "Organization", name: "Example Corp" });
    expect(extractJobPostingFromJsonLd([jsonLd])).toBeUndefined();
  });

  it("returns undefined for an empty list", () => {
    expect(extractJobPostingFromJsonLd([])).toBeUndefined();
  });
});
