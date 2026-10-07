import { describe, expect, it } from "vitest";
import { classifyField, classifyFields } from "../../src/form-intelligence/classification/fieldClassifier.js";
import type { FormField } from "../../src/form-intelligence/types/formField.js";

function field(overrides: Partial<FormField>): FormField {
  return {
    id: "f1",
    elementType: "TEXT",
    required: false,
    source: "LABEL",
    ...overrides,
  };
}

describe("classifyField — one case per semantic type", () => {
  it("IDENTITY", () => {
    const intent = classifyField(field({ label: "Full name" }));
    expect(intent).toMatchObject({ semanticType: "IDENTITY", answerStrategy: "PROFILE_VALUE" });
    expect(intent.evidence[0]).toContain("label");
  });

  it("CONTACT", () => {
    expect(classifyField(field({ label: "Email address" }))).toMatchObject({
      semanticType: "CONTACT",
      answerStrategy: "PROFILE_VALUE",
    });
  });

  it("CURRENT_JOB_TITLE", () => {
    expect(classifyField(field({ label: "What is your current job title?" }))).toMatchObject({
      semanticType: "CURRENT_JOB_TITLE",
      answerStrategy: "PROFILE_VALUE",
    });
  });

  it("PROFESSIONAL_SUMMARY", () => {
    expect(classifyField(field({ elementType: "TEXTAREA", label: "Tell us about yourself" }))).toMatchObject({
      semanticType: "PROFESSIONAL_SUMMARY",
      answerStrategy: "PROFILE_RETRIEVAL",
    });
  });

  it("EXPERIENCE (generic, no specific skill mentioned)", () => {
    expect(classifyField(field({ label: "How many years of experience do you have?" }))).toMatchObject({
      semanticType: "EXPERIENCE",
      answerStrategy: "DERIVED",
    });
  });

  it("SKILL_EXPERIENCE (specific skill + 'experience', takes priority over generic EXPERIENCE)", () => {
    const intent = classifyField(field({ label: "Years of Java experience" }));
    expect(intent.semanticType).toBe("SKILL_EXPERIENCE");
    expect(intent.answerStrategy).toBe("PROFILE_RETRIEVAL");
    expect(intent.evidence[0]).toContain("Java");
  });

  it("LEADERSHIP_EXPERIENCE (takes priority over generic EXPERIENCE)", () => {
    expect(classifyField(field({ elementType: "TEXTAREA", label: "Describe your leadership experience" }))).toMatchObject({
      semanticType: "LEADERSHIP_EXPERIENCE",
      answerStrategy: "PROFILE_RETRIEVAL",
    });
  });

  it("MOTIVATION", () => {
    expect(classifyField(field({ elementType: "TEXTAREA", label: "Why are you interested in this position?" }))).toMatchObject({
      semanticType: "MOTIVATION",
      answerStrategy: "PROFILE_RETRIEVAL",
    });
  });

  it("SALARY_EXPECTATION", () => {
    expect(classifyField(field({ label: "What is your expected salary?" }))).toMatchObject({
      semanticType: "SALARY_EXPECTATION",
      answerStrategy: "USER_INPUT_REQUIRED",
    });
  });

  it("WORK_AUTHORIZATION", () => {
    expect(classifyField(field({ label: "Are you authorized to work in the US?" }))).toMatchObject({
      semanticType: "WORK_AUTHORIZATION",
      answerStrategy: "USER_INPUT_REQUIRED",
    });
  });

  it("VISA_SPONSORSHIP (checked before the more generic WORK_AUTHORIZATION)", () => {
    expect(classifyField(field({ label: "Do you require visa sponsorship?" }))).toMatchObject({
      semanticType: "VISA_SPONSORSHIP",
      answerStrategy: "USER_INPUT_REQUIRED",
    });
  });

  it("LOCATION", () => {
    expect(classifyField(field({ label: "Current location" }))).toMatchObject({
      semanticType: "LOCATION",
      answerStrategy: "PROFILE_VALUE",
    });
  });

  it("RELOCATION", () => {
    expect(classifyField(field({ label: "Are you willing to relocate?" }))).toMatchObject({
      semanticType: "RELOCATION",
      answerStrategy: "USER_INPUT_REQUIRED",
    });
  });

  it("WORK_MODEL via label", () => {
    expect(classifyField(field({ label: "Work model" }))).toMatchObject({
      semanticType: "WORK_MODEL",
      answerStrategy: "USER_INPUT_REQUIRED",
    });
  });

  it("WORK_MODEL via option labels when the field label itself is generic (SDD section 8 example)", () => {
    const intent = classifyField(
      field({
        label: "Preference",
        elementType: "RADIO",
        options: [{ label: "Remote" }, { label: "Hybrid" }, { label: "On-site" }],
      })
    );
    expect(intent.semanticType).toBe("WORK_MODEL");
    expect(intent.evidence[0]).toContain("options");
  });

  it("LINKEDIN", () => {
    expect(classifyField(field({ label: "LinkedIn profile" }))).toMatchObject({
      semanticType: "LINKEDIN",
      answerStrategy: "PROFILE_VALUE",
    });
  });

  it("GITHUB", () => {
    expect(classifyField(field({ label: "GitHub" }))).toMatchObject({
      semanticType: "GITHUB",
      answerStrategy: "PROFILE_VALUE",
    });
  });

  it("PORTFOLIO", () => {
    expect(classifyField(field({ label: "Portfolio" }))).toMatchObject({
      semanticType: "PORTFOLIO",
      answerStrategy: "PROFILE_VALUE",
    });
  });

  it("EDUCATION", () => {
    expect(classifyField(field({ label: "Education" }))).toMatchObject({
      semanticType: "EDUCATION",
      answerStrategy: "PROFILE_RETRIEVAL",
    });
  });

  it("LANGUAGE", () => {
    expect(classifyField(field({ label: "Languages" }))).toMatchObject({
      semanticType: "LANGUAGE",
      answerStrategy: "PROFILE_RETRIEVAL",
    });
  });
});

describe("classifyField — falls back to the humanized name/id when there is no label/aria/placeholder", () => {
  it("classifies via the humanized 'name' alone", () => {
    const intent = classifyField(field({ label: undefined, name: "currentJobTitle", source: "NAME" }));
    expect(intent).toMatchObject({ semanticType: "CURRENT_JOB_TITLE" });
    expect(intent.evidence[0]).toContain("identifier");
  });
});

describe("classifyField — Portuguese phrasing (diacritics-insensitive)", () => {
  it("classifies a pt-BR salary question", () => {
    expect(classifyField(field({ label: "Qual sua pretensão salarial?" }))).toMatchObject({
      semanticType: "SALARY_EXPECTATION",
    });
  });

  it("classifies a pt-BR motivation question", () => {
    expect(classifyField(field({ elementType: "TEXTAREA", label: "Por que você quer essa vaga?" }))).toMatchObject({
      semanticType: "MOTIVATION",
    });
  });
});

describe("classifyField — fallback cases", () => {
  it("SYSTEM_FIELD when there is no usable signal at all (hidden framework mirror input, not a real question)", () => {
    const intent = classifyField(field({ label: undefined, source: "NONE" }));
    expect(intent).toMatchObject({ semanticType: "SYSTEM_FIELD", answerStrategy: "DO_NOT_ANSWER", confidence: 0, evidence: [] });
  });

  it("UNKNOWN for a short, non-question label that matches no known concept", () => {
    const intent = classifyField(field({ label: "Foo Bar" }));
    expect(intent).toMatchObject({ semanticType: "UNKNOWN", answerStrategy: "DO_NOT_ANSWER", confidence: 0 });
  });

  it("CUSTOM_QUESTION for an unrecognized but clearly question-like field", () => {
    const intent = classifyField(field({ elementType: "TEXTAREA", label: "Describe a challenging project you led" }));
    expect(intent).toMatchObject({ semanticType: "CUSTOM_QUESTION", answerStrategy: "PROFILE_RETRIEVAL" });
    expect(intent.confidence).toBeGreaterThan(0);
    expect(intent.confidence).toBeLessThan(0.5);
  });
});

describe("classifyField — never invents evidence", () => {
  it("evidence is empty exactly when SYSTEM_FIELD", () => {
    const intent = classifyField(field({ source: "NONE" }));
    expect(intent.evidence).toEqual([]);
  });

  it("every non-UNKNOWN/CUSTOM_QUESTION classification carries at least one evidence entry", () => {
    const intent = classifyField(field({ label: "Email" }));
    expect(intent.evidence.length).toBeGreaterThan(0);
  });
});

describe("normalizedQuestion", () => {
  it("strips a trailing required-marker asterisk", () => {
    const intent = classifyField(field({ label: "Expected salary *" }));
    expect(intent.normalizedQuestion).toBe("Expected salary");
  });
});

describe("classifyFields", () => {
  it("classifies a batch of fields independently, preserving order", () => {
    const intents = classifyFields([field({ id: "a", label: "Email" }), field({ id: "b", label: "GitHub" })]);
    expect(intents.map((i) => i.fieldId)).toEqual(["a", "b"]);
    expect(intents.map((i) => i.semanticType)).toEqual(["CONTACT", "GITHUB"]);
  });
});
