import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { FsProfileLoader } from "../src/profile/profileLoader.js";
import { buildIndex } from "../src/profile/chunker.js";
import { KeywordRetriever } from "../src/profile/retriever.js";
import type { ProfileChunk } from "../src/profile/types.js";

const vendorRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "vendor", "profiles");

/**
 * Regression coverage for the real FASE 6.3 Chrome finding: `career-pilot.md`
 * used to mix the candidate's legitimate project description with
 * CareerPilot's own internal implementation spec (field semantic mapping,
 * language/submission policy, OPEN_QUESTION examples). The spec's own
 * example text ("Why do you want to work here?") was lexically close enough
 * to real application questions that the retriever picked it as evidence
 * for "Why do you want to work with us?". The implementation spec now lives
 * entirely outside the profile corpus (docs/retrieval/field-semantic-
 * mapping.md, not referenced by any profile.json), so it must never be
 * indexed or retrievable through the career profile.
 */
describe("career-pilot.md corpus separation (career knowledge vs. product implementation docs)", () => {
  let chunks: ProfileChunk[];
  let retriever: KeywordRetriever;

  beforeAll(async () => {
    const loader = new FsProfileLoader(vendorRoot);
    const profile = await loader.loadProfile("rodrigo-matos");
    chunks = buildIndex(profile).chunks;
    retriever = new KeywordRetriever(chunks);
  });

  it("the implementation spec (field semantic mapping / OPEN_QUESTION examples / policies) is absent from the indexed corpus", () => {
    const forbidden = [
      "Field semantic mapping",
      "PERSONAL_NAME",
      "OPEN_QUESTION",
      "Language policy",
      "Submission policy",
      "Why do you want to work here?",
    ];

    for (const chunk of chunks) {
      for (const needle of forbidden) {
        expect(chunk.content).not.toContain(needle);
      }
    }
  });

  it('Test 1 (corpus correction SDD section 14) — "Why do you want to work with us?" does not retrieve the implementation spec', async () => {
    const results = await retriever.search("Why do you want to work with us?", { topK: 5, minScore: 0 });

    for (const result of results) {
      expect(result.chunk.content).not.toContain("Field semantic mapping");
      expect(result.chunk.content).not.toContain("OPEN_QUESTION");
    }
  });

  it("Test 2 (corpus correction SDD section 14) — the legitimate CareerPilot project description remains retrievable", async () => {
    const results = await retriever.search("Career Pilot Chrome extension project", { topK: 5 });

    expect(results.length).toBeGreaterThan(0);
    expect(results.map((result) => result.chunk.path)).toContain("projects/personal/career-pilot.md");
  });

  it("the CareerPilot project chunk still describes the real project, not just a bare title", () => {
    const careerPilotChunks = chunks.filter((chunk) => chunk.path === "projects/personal/career-pilot.md");
    expect(careerPilotChunks.length).toBeGreaterThan(0);
    expect(careerPilotChunks.some((chunk) => chunk.content.includes("local-first Chrome extension"))).toBe(true);
  });
});
