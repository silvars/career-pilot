import { describe, expect, it } from "vitest";
import { normalizeForRetrieval, REQUIREMENT_CONCEPTS } from "../../src/job-match/requirementNormalizer.js";

describe("normalizeForRetrieval", () => {
  const pairs: Array<{ canonical: string; pt: string; en: string }> = [
    { canonical: "people_management", pt: "gestão de pessoas", en: "people management" },
    { canonical: "engineering_leadership", pt: "liderança de engenharia", en: "engineering leadership" },
    { canonical: "career_development", pt: "desenvolvimento de carreira", en: "career development" },
    { canonical: "observability", pt: "observabilidade", en: "observability" },
    { canonical: "reliability", pt: "confiabilidade", en: "reliability" },
    { canonical: "production_software", pt: "software em produção", en: "production software" },
    { canonical: "business_objectives", pt: "objetivos de negócio", en: "business objectives" },
    { canonical: "remote_work", pt: "trabalho remoto", en: "remote" },
  ];

  it.each(pairs)(
    "recognizes '$canonical' from pt-BR text and proposes the English query variant",
    ({ canonical, pt, en }) => {
      const result = normalizeForRetrieval(`Experiência com ${pt} é obrigatória.`);
      expect(result.concepts).toContain(canonical);
      expect(result.queryVariants).toContain(en);
      expect(result.queryVariants).toContain(pt);
    }
  );

  it.each(pairs)(
    "recognizes '$canonical' from English text and proposes the Portuguese query variant (symmetric)",
    ({ canonical, pt, en }) => {
      const result = normalizeForRetrieval(`Strong background in ${en} is required.`);
      expect(result.concepts).toContain(canonical);
      expect(result.queryVariants).toContain(pt);
      expect(result.queryVariants).toContain(en);
    }
  );

  it("never mutates the original text", () => {
    const text = "Experiência sólida com gestão de pessoas e observabilidade";
    const result = normalizeForRetrieval(text);
    expect(result.original).toBe(text);
    expect(result.queryVariants).toContain(text);
  });

  it("detects multiple concepts in a single real-world sentence (Akad/InHire fixture wording)", () => {
    const result = normalizeForRetrieval(
      "Experiência sólida gerenciando pessoas em times de engenharia de software, com histórico consistente de feedback, 1:1s e desenvolvimento de carreira"
    );
    expect(result.concepts).toEqual(
      expect.arrayContaining(["people_management", "continuous_feedback", "career_development"])
    );
  });

  it("returns only the original text as a variant when no concept is recognized", () => {
    const result = normalizeForRetrieval("Unrelated sentence about watercolor painting techniques");
    expect(result.concepts).toEqual([]);
    expect(result.queryVariants).toEqual(["Unrelated sentence about watercolor painting techniques"]);
  });

  it("is accent- and case-insensitive when detecting pt-BR aliases", () => {
    const result = normalizeForRetrieval("OBSERVABILIDADE e CONFIABILIDADE são essenciais");
    expect(result.concepts).toEqual(expect.arrayContaining(["observability", "reliability"]));
  });

  it("keeps every concept's canonical id unique", () => {
    const ids = REQUIREMENT_CONCEPTS.map((c) => c.canonical);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
