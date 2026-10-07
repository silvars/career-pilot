import { describe, expect, it } from "vitest";
import { generateAnswer, generateAnswers } from "../../src/form-intelligence/answer/answerGenerator.js";
import { classifyField } from "../../src/form-intelligence/classification/fieldClassifier.js";
import { KeywordRetriever } from "../../src/profile/retriever.js";
import { HybridRetriever } from "../../src/profile/hybridRetriever.js";
import { SemanticRetriever } from "../../src/profile/semanticRetriever.js";
import { FakeEmbeddingProvider } from "../fixtures/fakeEmbeddingProvider.js";
import type { FormField } from "../../src/form-intelligence/types/formField.js";
import type { ProfileChunk } from "../../src/profile/types.js";

function chunk(path: string, title: string, content: string): ProfileChunk {
  return {
    id: `${path}--${title}`,
    profileId: "test-profile",
    documentId: path,
    type: "profile",
    title,
    content,
    path,
    tags: [],
  };
}

function field(overrides: Partial<FormField>): FormField {
  return { id: "f1", elementType: "TEXT", required: false, source: "LABEL", ...overrides };
}

const IDENTITY_CHUNK = chunk(
  "identity/personal.md",
  "Canonical identity",
  [
    "- Name: Rodrigo Matos Silva",
    "- Country: Brazil",
    "- City: Atibaia, Sao Paulo",
    "- LinkedIn: https://www.linkedin.com/in/silvars/",
    "- GitHub: https://github.com/silvars",
    "- Personal site: https://rodrigomatos.tech/",
    "- Email: silvars@gmail.com",
  ].join("\n")
);

const CURRENT_ROLE_CHUNK = chunk(
  "identity/career-objectives.md",
  "Current role (for applications)",
  "- current_title: Software Engineering Executive Manager\n- current_company: Grupo Casas Bahia"
);

const ORG_SCALE_CHUNK = chunk(
  "achievements/leadership-impact.md",
  "Organizational scale",
  "170+ engineers led. 25+ squads structured. 5 product tribes. 20+ years in technology."
);

const SUMMARY_CHUNK = chunk(
  "identity/professional-summary.md",
  "Professional summary",
  "Professional summary: Rodrigo is a seasoned engineering leader with two decades of experience building high performing teams and platforms."
);

const LEADERSHIP_CHUNK = chunk(
  "skills/leadership.md",
  "Leadership philosophy",
  "Teams own their technical and product decisions and are supported rather than controlled."
);

const ALL_CHUNKS = [IDENTITY_CHUNK, CURRENT_ROLE_CHUNK, ORG_SCALE_CHUNK, SUMMARY_CHUNK, LEADERSHIP_CHUNK];

function realKeywordRetriever(chunks: ProfileChunk[] = ALL_CHUNKS) {
  return { retriever: new KeywordRetriever(chunks) };
}

describe("generateAnswer — canonical profile values", () => {
  it("email: extracted from the canonical identity chunk, no review needed", async () => {
    const intent = classifyField(field({ label: "Email" }));
    const answer = await generateAnswer(intent, realKeywordRetriever());

    expect(answer).toMatchObject({ value: "silvars@gmail.com", source: "PROFILE", requiresReview: false });
    expect(answer.evidence[0].path).toBe("identity/personal.md");
  });

  it("LinkedIn: canonical URL, no review needed", async () => {
    const intent = classifyField(field({ label: "LinkedIn profile" }));
    const answer = await generateAnswer(intent, realKeywordRetriever());

    expect(answer).toMatchObject({
      value: "https://www.linkedin.com/in/silvars/",
      source: "PROFILE",
      requiresReview: false,
    });
  });

  it("GitHub: canonical URL, no review needed", async () => {
    const intent = classifyField(field({ label: "GitHub" }));
    const answer = await generateAnswer(intent, realKeywordRetriever());

    expect(answer).toMatchObject({ value: "https://github.com/silvars", source: "PROFILE", requiresReview: false });
  });

  it("current job title: parsed from the chunk heading, flagged for review", async () => {
    const intent = classifyField(field({ label: "Current job title" }));
    const answer = await generateAnswer(intent, realKeywordRetriever());

    expect(answer).toMatchObject({
      value: "Software Engineering Executive Manager",
      source: "PROFILE",
      requiresReview: true,
    });
  });

  it("phone: never answered, even though the profile has other contact info (rule 4)", async () => {
    const intent = classifyField(field({ label: "Phone number" }));
    const answer = await generateAnswer(intent, realKeywordRetriever());

    expect(answer).toMatchObject({ source: "USER_REQUIRED", requiresReview: true, evidence: [] });
    expect(answer.value).toBeUndefined();
  });
});

describe("generateAnswer — profile retrieval (open-ended fields)", () => {
  it("professional summary: draft answer from the retrieved excerpt, flagged for review", async () => {
    const intent = classifyField(field({ elementType: "TEXTAREA", label: "Professional summary" }));
    const answer = await generateAnswer(intent, realKeywordRetriever());

    expect(answer.source).toBe("PROFILE_RETRIEVAL");
    expect(answer.value).toContain("seasoned engineering leader");
    expect(answer.requiresReview).toBe(true);
  });

  it("leadership experience: draft answer from the retrieved excerpt", async () => {
    const intent = classifyField(field({ elementType: "TEXTAREA", label: "Describe your leadership experience" }));
    const answer = await generateAnswer(intent, realKeywordRetriever());

    expect(answer.source).toBe("PROFILE_RETRIEVAL");
    expect(answer.value).toContain("supported rather than controlled");
  });
});

describe("generateAnswer — YEARS_OF_EXPERIENCE (explicit only, never computed)", () => {
  it("explicit '20+ years' statement found -> DERIVED", async () => {
    const intent = classifyField(field({ label: "How many years of experience do you have?" }));
    const answer = await generateAnswer(intent, realKeywordRetriever());

    expect(answer).toMatchObject({ value: "20+ years", source: "DERIVED", requiresReview: true });
  });

  it("no explicit statement anywhere in the profile -> USER_REQUIRED, never computed from dates", async () => {
    const chunksWithoutExplicitYears = [CURRENT_ROLE_CHUNK, SUMMARY_CHUNK]; // has dates ("July 2022"), no "N+ years" claim
    const intent = classifyField(field({ label: "How many years of experience do you have?" }));
    const answer = await generateAnswer(intent, realKeywordRetriever(chunksWithoutExplicitYears));

    expect(answer).toMatchObject({ source: "USER_REQUIRED", requiresReview: true });
    expect(answer.value).toBeUndefined();
  });
});

describe("generateAnswer — fields that must never be inferred (rules 6-10)", () => {
  it("SALARY_EXPECTATION -> USER_REQUIRED without ever searching the profile", async () => {
    const intent = classifyField(field({ label: "What is your expected salary?" }));
    const answer = await generateAnswer(intent, realKeywordRetriever());
    expect(answer).toMatchObject({ source: "USER_REQUIRED", evidence: [] });
  });

  it("WORK_AUTHORIZATION -> USER_REQUIRED", async () => {
    const intent = classifyField(field({ label: "Are you authorized to work in the US?" }));
    const answer = await generateAnswer(intent, realKeywordRetriever());
    expect(answer).toMatchObject({ source: "USER_REQUIRED", evidence: [] });
  });

  it("VISA_SPONSORSHIP -> USER_REQUIRED", async () => {
    const intent = classifyField(field({ label: "Do you require visa sponsorship?" }));
    const answer = await generateAnswer(intent, realKeywordRetriever());
    expect(answer).toMatchObject({ source: "USER_REQUIRED", evidence: [] });
  });

  it("RELOCATION -> USER_REQUIRED", async () => {
    const intent = classifyField(field({ label: "Are you willing to relocate?" }));
    const answer = await generateAnswer(intent, realKeywordRetriever());
    expect(answer).toMatchObject({ source: "USER_REQUIRED", evidence: [] });
  });

  it("WORK_MODEL -> USER_REQUIRED, never a guessed preference", async () => {
    const intent = classifyField(field({ label: "Work model" }));
    const answer = await generateAnswer(intent, realKeywordRetriever());
    expect(answer).toMatchObject({ source: "USER_REQUIRED", evidence: [] });
  });

  it("protected-characteristic questions (EEO self-ID) are never answered via retrieval (real Greenhouse form finding — now classified explicitly as PROTECTED_OR_LEGAL, FASE 5.5 hardening)", async () => {
    const intent = classifyField(field({ label: "Which gender do you identify as?" }));
    expect(intent.semanticType).toBe("PROTECTED_OR_LEGAL");

    const answer = await generateAnswer(intent, realKeywordRetriever());
    expect(answer).toMatchObject({ source: "USER_REQUIRED", evidence: [] });
  });

  it("protected-characteristic questions are blocked regardless of phrasing (race, disability, veteran status)", async () => {
    for (const label of ["Please indicate your race or ethnicity", "Disability Status", "Veteran Status", "Are you Hispanic/Latino?"]) {
      const intent = classifyField(field({ label }));
      const answer = await generateAnswer(intent, realKeywordRetriever());
      expect(answer.source).toBe("USER_REQUIRED");
    }
  });
});

describe("FASE 5.5 hardening — real validation regressions", () => {
  it('"Não sou brasileiro" (real pt-BR nationality/eligibility field) classifies PROTECTED_OR_LEGAL -> USER_REQUIRED, never retrieval', async () => {
    const intent = classifyField(field({ label: "Não sou brasileiro" }));
    expect(intent.semanticType).toBe("PROTECTED_OR_LEGAL");

    const answer = await generateAnswer(intent, realKeywordRetriever());
    expect(answer).toMatchObject({ source: "USER_REQUIRED", evidence: [] });
  });

  it('"Você precisa de sponsorship?" -> USER_REQUIRED', async () => {
    const intent = classifyField(field({ label: "Você precisa de sponsorship?" }));
    const answer = await generateAnswer(intent, realKeywordRetriever());
    expect(answer).toMatchObject({ source: "USER_REQUIRED", evidence: [] });
  });

  it('"Qual sua raça/etnia?" -> PROTECTED_OR_LEGAL -> USER_REQUIRED', async () => {
    const intent = classifyField(field({ label: "Qual sua raça/etnia?" }));
    expect(intent.semanticType).toBe("PROTECTED_OR_LEGAL");
    const answer = await generateAnswer(intent, realKeywordRetriever());
    expect(answer).toMatchObject({ source: "USER_REQUIRED", evidence: [] });
  });

  it('"Qual seu gênero?" -> PROTECTED_OR_LEGAL -> USER_REQUIRED', async () => {
    const intent = classifyField(field({ label: "Qual seu gênero?" }));
    expect(intent.semanticType).toBe("PROTECTED_OR_LEGAL");
    const answer = await generateAnswer(intent, realKeywordRetriever());
    expect(answer).toMatchObject({ source: "USER_REQUIRED", evidence: [] });
  });

  it('"G Recaptcha Response" (real Greenhouse id "g-recaptcha-response", no label) -> SYSTEM_FIELD -> NONE, never retrieval', async () => {
    const intent = classifyField(field({ label: undefined, name: "g-recaptcha-response", source: "NAME" }));
    expect(intent.semanticType).toBe("SYSTEM_FIELD");

    const answer = await generateAnswer(intent, realKeywordRetriever());
    expect(answer).toMatchObject({ source: "NONE", evidence: [], requiresReview: false });
  });

  it('"CPF" -> DOCUMENT_ID -> USER_REQUIRED (never UNKNOWN, never added to the Profile)', async () => {
    const intent = classifyField(field({ label: "CPF" }));
    expect(intent.semanticType).toBe("DOCUMENT_ID");
    const answer = await generateAnswer(intent, realKeywordRetriever());
    expect(answer).toMatchObject({ source: "USER_REQUIRED", evidence: [] });
  });

  it('"000.000.000-00" (CPF-shaped placeholder, no other signal) -> DOCUMENT_ID -> USER_REQUIRED', async () => {
    const intent = classifyField(field({ label: undefined, placeholder: "000.000.000-00", source: "PLACEHOLDER" }));
    expect(intent.semanticType).toBe("DOCUMENT_ID");
    const answer = await generateAnswer(intent, realKeywordRetriever());
    expect(answer).toMatchObject({ source: "USER_REQUIRED", evidence: [] });
  });

  it('"Cidade" -> LOCATION, and USER_REQUIRED (never UNKNOWN) when the Profile has no canonical location evidence', async () => {
    const intent = classifyField(field({ label: "Cidade" }));
    expect(intent.semanticType).toBe("LOCATION");

    const answer = await generateAnswer(intent, { retriever: new KeywordRetriever([]) });
    expect(answer).toMatchObject({ source: "USER_REQUIRED", evidence: [] });
  });

  it("CAPTCHA never reaches Profile Retrieval even for a question-like label", async () => {
    const intent = classifyField(field({ label: "Please complete the reCAPTCHA challenge below" }));
    expect(intent.semanticType).toBe("SYSTEM_FIELD");
    const answer = await generateAnswer(intent, realKeywordRetriever());
    expect(answer.source).not.toBe("PROFILE_RETRIEVAL");
  });
});

describe("generateAnswer — fallbacks", () => {
  it("CUSTOM_QUESTION with no matching evidence -> USER_REQUIRED (downgraded, not invented)", async () => {
    const intent = classifyField(field({ elementType: "TEXTAREA", label: "Describe a time you reduced technical debt" }));
    expect(intent.semanticType).toBe("CUSTOM_QUESTION");

    const answer = await generateAnswer(intent, { retriever: new KeywordRetriever([]) });
    expect(answer).toMatchObject({ source: "USER_REQUIRED" });
  });

  it("UNKNOWN field -> NONE, never asked for review", async () => {
    const intent = classifyField(field({ label: undefined }));
    expect(intent.semanticType).toBe("UNKNOWN");

    const answer = await generateAnswer(intent, realKeywordRetriever());
    expect(answer).toMatchObject({ source: "NONE", requiresReview: false, evidence: [] });
  });
});

describe("generateAnswer — HybridRetriever recovers evidence KeywordRetriever alone misses", () => {
  it("a paraphrased query with no literal keyword overlap is only answered once semantic retrieval is added", async () => {
    const query = "experience fostering team autonomy and ownership";
    const keywordOnly = new KeywordRetriever(ALL_CHUNKS);

    // Proof step 1: KeywordRetriever alone finds nothing useful for this paraphrase
    // — "experience" is one of its own stopwords (stripped before matching), and
    // the remaining tokens ("fostering"/"autonomy"/"ownership") appear nowhere
    // in the profile's actual wording.
    await expect(keywordOnly.search(query, { minScore: 0.15 })).rejects.toMatchObject({
      code: "NO_RELEVANT_CONTEXT",
    });

    // Proof step 2: a semantic retriever (fake embeddings standing in for the
    // real model, which can't run under vitest/Node) recognizes the topical
    // overlap on "experience" that KeywordRetriever specifically discards.
    const semantic = new SemanticRetriever(ALL_CHUNKS, new FakeEmbeddingProvider(["experience"]), {
      minScore: 0.5,
    });
    const semanticResults = await semantic.search(query);
    expect(semanticResults[0].chunk.path).toBe("identity/professional-summary.md");

    // Proof step 3: HybridRetriever (the one actually wired into FASE 5) surfaces it too.
    const hybrid = new HybridRetriever(keywordOnly, semantic);
    const hybridResults = await hybrid.search(query);
    expect(hybridResults[0].chunk.path).toBe("identity/professional-summary.md");
    expect(hybridResults[0].retrievalSource).toBe("HYBRID");

    // Proof step 4: the final FieldAnswer actually uses that recovered evidence
    // (same query text, so the demonstration is internally consistent end to end).
    const intent = classifyField(field({ elementType: "TEXTAREA", label: query }));
    const answer = await generateAnswer(intent, { retriever: hybrid });

    expect(answer.source).toBe("PROFILE_RETRIEVAL");
    expect(answer.evidence[0].path).toBe("identity/professional-summary.md");
    expect(answer.value).toContain("seasoned engineering leader");
  });
});

describe("generateAnswers — batch, preserves order", () => {
  it("generates one answer per intent", async () => {
    const intents = [
      classifyField(field({ id: "a", label: "Email" })),
      classifyField(field({ id: "b", label: "Expected salary" })),
    ];
    const answers = await generateAnswers(intents, realKeywordRetriever());
    expect(answers.map((a) => a.fieldId)).toEqual(["a", "b"]);
    expect(answers.map((a) => a.source)).toEqual(["PROFILE", "USER_REQUIRED"]);
  });
});
