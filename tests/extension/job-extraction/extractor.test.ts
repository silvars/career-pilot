import { describe, expect, it } from "vitest";
import {
  buildExtractedJobPage,
  hasMeaningfulContent,
  toJobPage,
} from "../../../src/extension/job-extraction/extractor.js";
import { EXTRACTION_LIMITS } from "../../../src/extension/job-extraction/extractionLimits.js";
import type { RawPageMaterials } from "../../../src/extension/job-extraction/types.js";
import { AKAD_INHIRE_RAW_MATERIALS } from "../../fixtures/pages/akadInhire.js";
import { JSON_LD_RAW_MATERIALS, MALFORMED_JSON_LD_RAW_MATERIALS } from "../../fixtures/pages/jsonLdJob.js";

describe("buildExtractedJobPage", () => {
  it("extracts a JobPosting from JSON-LD (structured source), stripping HTML", () => {
    const { extracted, diagnostics } = buildExtractedJobPage(JSON_LD_RAW_MATERIALS);

    expect(extracted.title).toBe("Senior Backend Engineer");
    expect(extracted.text).toContain("Senior Backend Engineer");
    expect(extracted.text).toContain("Java and Spring Boot");
    expect(extracted.text).not.toContain("<p>");
    expect(extracted.text).not.toContain("<strong>");
    expect(diagnostics.source).toBe("structured");
    expect(diagnostics.truncated).toBe(false);
  });

  it("falls back to semantic DOM sections when JSON-LD is malformed/absent", () => {
    const { extracted, diagnostics } = buildExtractedJobPage(MALFORMED_JSON_LD_RAW_MATERIALS);

    expect(extracted.text).toContain("Fallback semantic content for this page.");
    expect(diagnostics.source).toBe("semantic-dom");
  });

  it("falls back to visible text when there are neither structured nor semantic signals", () => {
    const raw: RawPageMaterials = {
      url: "https://example.com/weird-page",
      documentTitle: "Weird Page",
      jsonLdTexts: [],
      elements: [],
      visibleText: "Just a wall of plain visible text describing the job, no semantic markup at all.",
    };

    const { extracted, diagnostics } = buildExtractedJobPage(raw);

    expect(extracted.text).toContain("Just a wall of plain visible text");
    expect(diagnostics.source).toBe("visible-text");
  });

  it("groups semantic elements under their preceding heading", () => {
    const raw: RawPageMaterials = {
      url: "https://example.com/role",
      documentTitle: "Role",
      jsonLdTexts: [],
      elements: [
        { tag: "H1", text: "Backend Engineer" },
        { tag: "P", text: "Intro paragraph." },
        { tag: "H2", text: "Requirements" },
        { tag: "LI", text: "Java" },
        { tag: "LI", text: "AWS" },
      ],
      visibleText: "",
    };

    const { extracted } = buildExtractedJobPage(raw);

    expect(extracted.sections.map((s) => s.heading)).toEqual(["Backend Engineer", "Requirements"]);
    expect(extracted.sections[1].text).toContain("Java");
    expect(extracted.sections[1].text).toContain("AWS");
  });

  it("detects the platform from the URL", () => {
    const { extracted } = buildExtractedJobPage(AKAD_INHIRE_RAW_MATERIALS);
    expect(extracted.platform).toBe("inhire");
  });

  it("enforces MAX_SECTION_COUNT, reporting discarded sections and truncation", () => {
    const elements = Array.from({ length: EXTRACTION_LIMITS.maxSectionCount + 10 }, (_, i) => [
      { tag: "H2" as const, text: `Section ${i}` },
      { tag: "P" as const, text: `Content ${i}` },
    ]).flat();

    const raw: RawPageMaterials = {
      url: "https://example.com/huge",
      documentTitle: "Huge Page",
      jsonLdTexts: [],
      elements,
      visibleText: "",
    };

    const { extracted, diagnostics } = buildExtractedJobPage(raw);

    expect(extracted.sections).toHaveLength(EXTRACTION_LIMITS.maxSectionCount);
    expect(diagnostics.discardedSections).toBe(10);
    expect(diagnostics.truncated).toBe(true);
  });

  it("enforces MAX_SECTION_TEXT_CHARS per section", () => {
    const raw: RawPageMaterials = {
      url: "https://example.com/long-section",
      documentTitle: "Long Section",
      jsonLdTexts: [],
      elements: [{ tag: "P", text: "x".repeat(EXTRACTION_LIMITS.maxSectionTextChars + 500) }],
      visibleText: "",
    };

    const { extracted, diagnostics } = buildExtractedJobPage(raw);

    expect(extracted.sections[0].text.length).toBe(EXTRACTION_LIMITS.maxSectionTextChars);
    expect(diagnostics.truncated).toBe(true);
  });

  it("enforces MAX_TOTAL_EXTRACTED_CHARS on the final combined text", () => {
    const raw: RawPageMaterials = {
      url: "https://example.com/very-long",
      documentTitle: "Very Long",
      jsonLdTexts: [],
      elements: [],
      visibleText: "y".repeat(EXTRACTION_LIMITS.maxTotalExtractedChars + 5000),
    };

    const { extracted, diagnostics } = buildExtractedJobPage(raw);

    expect(extracted.text.length).toBeLessThanOrEqual(EXTRACTION_LIMITS.maxTotalExtractedChars);
    expect(diagnostics.truncated).toBe(true);
  });

  it("never crashes on completely empty materials", () => {
    const raw: RawPageMaterials = {
      url: "https://example.com/empty",
      documentTitle: "",
      jsonLdTexts: [],
      elements: [],
      visibleText: "",
    };

    expect(() => buildExtractedJobPage(raw)).not.toThrow();
    const { extracted } = buildExtractedJobPage(raw);
    expect(extracted.text).toBe("");
  });

  describe("real-world sanitized fixture (Akad/InHire, decision 1.1)", () => {
    it("produces enough meaningful content for generic extraction (no dedicated adapter needed)", () => {
      const { extracted } = buildExtractedJobPage(AKAD_INHIRE_RAW_MATERIALS);

      expect(hasMeaningfulContent(extracted)).toBe(true);
      expect(extracted.title).toBe("Engineering Manager - Akad Seguros");
      expect(extracted.text).toContain("Engineering Manager");
      expect(extracted.text).toContain("squads pequenos, autônomos e multidisciplinares");
    });

    it("converts cleanly into the existing FASE 2 JobPage shape", () => {
      const { extracted } = buildExtractedJobPage(AKAD_INHIRE_RAW_MATERIALS);
      const job = toJobPage(extracted);

      expect(job).toEqual({
        url: AKAD_INHIRE_RAW_MATERIALS.url,
        title: "Engineering Manager - Akad Seguros",
        text: extracted.text,
        platform: "inhire",
      });
    });
  });
});

describe("hasMeaningfulContent", () => {
  it("returns false for very short text", () => {
    const { extracted } = buildExtractedJobPage({
      url: "https://example.com/thin",
      documentTitle: "Thin",
      jsonLdTexts: [],
      elements: [{ tag: "P", text: "Too short." }],
      visibleText: "",
    });
    expect(hasMeaningfulContent(extracted)).toBe(false);
  });
});
