import { describe, expect, it } from "vitest";
import { RuleBasedJobAnalyzer } from "../../src/job-match/jobAnalyzer.js";
import { buildExtractedJobPage, toJobPage } from "../../src/extension/job-extraction/extractor.js";
import { AKAD_INHIRE_RAW_MATERIALS } from "../fixtures/pages/akadInhire.js";
import {
  ELIGIBILITY_JOB,
  LANGUAGE_JOB,
  LOCATION_WARNING_JOB,
  STRONG_MATCH_JOB,
} from "../fixtures/jobs.js";

describe("RuleBasedJobAnalyzer", () => {
  const analyzer = new RuleBasedJobAnalyzer();

  it("extracts title, seniority, skills, experience, responsibilities, language and location", async () => {
    const job = await analyzer.analyze({ text: STRONG_MATCH_JOB });

    expect(job.title).toBe("Senior Engineering Manager");
    expect(job.seniority).toBe("Senior Engineering Manager");
    expect(job.requiredSkills).toEqual(
      expect.arrayContaining(["Java", "Spring Boot", "AWS", "Kubernetes", "Microservices"])
    );
    expect(job.preferredSkills).toEqual(expect.arrayContaining(["Kafka", "Docker"]));
    expect(job.requiredExperience).toEqual(
      expect.arrayContaining(["People management experience"])
    );
    expect(job.responsibilities).toEqual(
      expect.arrayContaining([
        "Lead engineering teams and drive architecture decisions",
        "Own technical strategy for distributed systems",
      ])
    );
    expect(job.languages.some((l) => /english/i.test(l))).toBe(true);
    expect(job.location).toBe("Brazil");
  });

  it("extracts work model from free-form text", async () => {
    const job = await analyzer.analyze({ text: LOCATION_WARNING_JOB });
    expect(job.workModel).toBe("Remote");
  });

  it("extracts eligibility requirements with source and confidence preserved", async () => {
    const job = await analyzer.analyze({ text: ELIGIBILITY_JOB });

    expect(job.eligibilityRequirements).toHaveLength(4);
    const types = job.eligibilityRequirements.map((e) => e.type).sort();
    expect(types).toEqual([
      "AFFIRMATIVE_PROGRAM",
      "CITIZENSHIP",
      "SECURITY_CLEARANCE",
      "WORK_AUTHORIZATION",
    ]);
    for (const requirement of job.eligibilityRequirements) {
      expect(requirement.source.length).toBeGreaterThan(0);
      expect(requirement.detectedPhrase.length).toBeGreaterThan(0);
      expect(["LOW", "MEDIUM", "HIGH"]).toContain(requirement.confidence);
    }
  });

  it("does not misclassify a language-requirement sentence without a known language name", async () => {
    const job = await analyzer.analyze({ text: LANGUAGE_JOB });
    expect(job.languages).toHaveLength(2);
  });

  it("throws JOB_PAGE_NOT_READABLE for an empty page", async () => {
    await expect(analyzer.analyze({ text: "" })).rejects.toMatchObject({
      code: "JOB_PAGE_NOT_READABLE",
    });
  });

  it("throws JOB_REQUIREMENTS_NOT_FOUND when only a bare title can be extracted", async () => {
    await expect(
      analyzer.analyze({ text: "Some Random Job Title With No Other Content" })
    ).rejects.toMatchObject({ code: "JOB_REQUIREMENTS_NOT_FOUND" });
  });

  it("prefers JobPage.title over the first text line when provided", async () => {
    const job = await analyzer.analyze({
      title: "Explicit Title",
      text: "Some other first line\n\nRequirements:\n- Java\n",
    });
    expect(job.title).toBe("Explicit Title");
  });

  describe("pt-BR header recognition (real finding, 2026-10-06 — Akad/InHire job posting)", () => {
    it("buckets Portuguese 'Requisitos'/'Responsabilidades'/'Diferenciais' headers like their English equivalents", async () => {
      const job = await analyzer.analyze({
        text: [
          "Engenheiro de Software Sênior",
          "",
          "Responsabilidades:",
          "- Liderar o squad de pagamentos",
          "- Participar de discovery de produto",
          "",
          "Requisitos:",
          "- Experiência sólida com Java",
          "- Experiência com AWS",
          "",
          "Diferenciais:",
          "- Experiência com Kubernetes",
        ].join("\n"),
      });

      expect(job.responsibilities).toEqual(
        expect.arrayContaining(["Liderar o squad de pagamentos", "Participar de discovery de produto"])
      );
      expect(job.requiredSkills).toEqual(expect.arrayContaining(["Java", "AWS"]));
      expect(job.preferredSkills).toEqual(expect.arrayContaining(["Kubernetes"]));
    });

    it("recognizes the exact real-world headers 'O que você precisa ter?' and 'Você se destacará se tiver...'", async () => {
      const job = await analyzer.analyze({
        text: [
          "Engineering Manager",
          "",
          "O que você precisa ter?",
          "- Experiência sólida gerenciando pessoas",
          "",
          "Você se destacará se tiver...",
          "- Experiência no setor de seguros",
        ].join("\n"),
      });

      expect(job.requiredExperience).toEqual(
        expect.arrayContaining(["Experiência sólida gerenciando pessoas"])
      );
      expect(job.preferredSkills).toEqual(expect.arrayContaining(["Experiência no setor de seguros"]));
    });

    it("excludes 'Sobre a empresa' and 'Benefícios' content from required/preferred/responsibilities", async () => {
      const job = await analyzer.analyze({
        text: [
          "Engineering Manager",
          "",
          "Requisitos:",
          "- Experiência com Java",
          "",
          "Sobre a empresa",
          "Somos uma empresa incrível fundada em 2010.",
          "",
          "Benefícios:",
          "Vale refeição e plano de saúde.",
        ].join("\n"),
      });

      expect(job.requiredSkills).toEqual(["Java"]);
      expect(job.requiredExperience).toEqual([]);
      expect(job.responsibilities).toEqual([]);
    });

    it("detects 'Remoto'/'Remota' and 'Híbrido' as Remote/Hybrid work models", async () => {
      const remote = await analyzer.analyze({ text: "Engenheiro\n\nRequisitos:\n- Java\n\nModelo de trabalho 100% Remoto" });
      expect(remote.workModel).toBe("Remote");

      const hybrid = await analyzer.analyze({ text: "Engenheiro\n\nRequisitos:\n- Java\n\nTrabalho híbrido, 2x por semana no escritório" });
      expect(hybrid.workModel).toBe("Hybrid");
    });

    it("regression: the real Akad/InHire posting must not collapse into title/seniority only", async () => {
      const { extracted } = buildExtractedJobPage(AKAD_INHIRE_RAW_MATERIALS);
      const job = await analyzer.analyze(toJobPage(extracted));

      // Before the pt-BR header fix, every one of these was empty and the
      // Match Engine scored this exact posting 100/100 from title alone.
      expect(job.responsibilities.length).toBeGreaterThan(0);
      expect(job.requiredExperience.length).toBeGreaterThan(0);
      expect(job.preferredSkills.length).toBeGreaterThan(0);
      expect(job.workModel).toBe("Remote");
    });
  });
});
