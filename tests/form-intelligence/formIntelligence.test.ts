import { describe, expect, it } from "vitest";
import { buildFormIntelligenceResult } from "../../src/form-intelligence/formIntelligence.js";
import { KeywordRetriever } from "../../src/profile/retriever.js";
import type { RawFormMaterials } from "../../src/form-intelligence/extraction/rawFormElement.js";
import type { ProfileChunk } from "../../src/profile/types.js";

function chunk(path: string, title: string, content: string): ProfileChunk {
  return { id: `${path}--${title}`, profileId: "test-profile", documentId: path, type: "profile", title, content, path, tags: [] };
}

const CHUNKS = [
  chunk("identity/personal.md", "Canonical identity", "- Email: silvars@gmail.com\n- LinkedIn: https://www.linkedin.com/in/silvars/"),
  chunk("skills/leadership.md", "Leadership philosophy", "Teams own their technical and product decisions and are supported rather than controlled."),
];

describe("buildFormIntelligenceResult", () => {
  it("runs the full pipeline and produces a consistent summary", async () => {
    const materials: RawFormMaterials = {
      url: "https://example.com/apply",
      elements: [
        { tag: "INPUT", inputType: "email", id: "email", required: true, labelText: "Email" },
        { tag: "INPUT", inputType: "text", id: "salary", required: false, labelText: "Expected salary" },
        { tag: "TEXTAREA", id: "leadership", required: false, labelText: "Describe your leadership experience" },
        { tag: "INPUT", inputType: "text", id: "mystery", required: false },
      ],
    };

    const result = await buildFormIntelligenceResult(materials, { retriever: new KeywordRetriever(CHUNKS) });

    expect(result.url).toBe("https://example.com/apply");
    expect(result.fields).toHaveLength(4);
    expect(result.intents).toHaveLength(4);
    expect(result.answers).toHaveLength(4);

    const bySemanticType = Object.fromEntries(result.intents.map((intent) => [intent.fieldId, intent.semanticType]));
    expect(bySemanticType).toMatchObject({
      email: "CONTACT",
      salary: "SALARY_EXPECTATION",
      leadership: "LEADERSHIP_EXPERIENCE",
      mystery: "UNKNOWN",
    });

    const byAnswerSource = Object.fromEntries(result.answers.map((answer) => [answer.fieldId, answer.source]));
    expect(byAnswerSource).toMatchObject({
      email: "PROFILE",
      salary: "USER_REQUIRED",
      leadership: "PROFILE_RETRIEVAL",
      mystery: "NONE",
    });

    expect(result.summary).toEqual({
      totalFields: 4,
      understoodFields: 3, // everything except "mystery" (UNKNOWN)
      answerableFields: 2, // email (PROFILE) + leadership (PROFILE_RETRIEVAL)
      requiresUserInput: 1, // salary
      requiresReview: 2, // leadership (PROFILE_RETRIEVAL) + salary (USER_REQUIRED)
      unknownFields: 1, // mystery
    });
  });
});
