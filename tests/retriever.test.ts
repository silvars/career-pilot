import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { FsProfileLoader } from "../src/profile/profileLoader.js";
import { buildIndex } from "../src/profile/chunker.js";
import { KeywordRetriever } from "../src/profile/retriever.js";
import type { ProfileChunk } from "../src/profile/types.js";

// Real vendored profile (SDD section 6.1) — populated by scripts/sync-profile.ts.
const vendorRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "vendor",
  "profiles"
);

describe("KeywordRetriever against the real rodrigo-matos profile", () => {
  let chunks: ProfileChunk[];
  let retriever: KeywordRetriever;

  beforeAll(async () => {
    const loader = new FsProfileLoader(vendorRoot);
    const profile = await loader.loadProfile("rodrigo-matos");
    chunks = buildIndex(profile).chunks;
    retriever = new KeywordRetriever(chunks);
  });

  const cases: Array<{ query: string; expectedPath: string }> = [
    { query: "AWS", expectedPath: "skills/cloud.md" },
    { query: "engineering management", expectedPath: "skills/leadership.md" },
    { query: "people management", expectedPath: "skills/leadership.md" },
    { query: "distributed systems", expectedPath: "skills/architecture.md" },
    { query: "leadership", expectedPath: "skills/leadership.md" },
    { query: "GeoAlert", expectedPath: "projects/personal/geoalert.md" },
    { query: "legacy modernization", expectedPath: "achievements/business-impact.md" },
  ];

  it.each(cases)(
    'includes "$expectedPath" in the top K results for query "$query"',
    async ({ query, expectedPath }) => {
      const results = await retriever.search(query, { topK: 5 });

      expect(results.length).toBeGreaterThan(0);
      expect(results.map((result) => result.chunk.path)).toContain(expectedPath);
    }
  );

  it(
    '"Java" is a genuinely common term (10 documents): it is retrievable, ' +
      "but the default topK=5 is not guaranteed to include every tied match " +
      "(SDD section 19 explicitly allows this)",
    async () => {
      const narrow = await retriever.search("Java", { topK: 5 });
      expect(narrow.length).toBe(5);

      const wide = await retriever.search("Java", { topK: 20, minScore: 0 });
      expect(wide.map((result) => result.chunk.path)).toContain("skills/technical.md");
    }
  );

  it('expands "How many people have you managed?" to related leadership/management content', async () => {
    const results = await retriever.search("How many people have you managed?", { topK: 5 });

    expect(results.length).toBeGreaterThan(0);
    const paths = results.map((result) => result.chunk.path);
    expect(paths.some((p) => p.includes("leadership") || p.includes("achievements"))).toBe(true);
  });

  it("respects topK", async () => {
    const results = await retriever.search("engineering", { topK: 2, minScore: 0 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("throws NO_RELEVANT_CONTEXT for a query unrelated to the profile", async () => {
    await expect(
      retriever.search("favorite pizza topping in Antarctica")
    ).rejects.toMatchObject({ code: "NO_RELEVANT_CONTEXT" });
  });
});
