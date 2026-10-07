import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FsProfileLoader } from "../src/profile/profileLoader.js";
import { buildIndex } from "../src/profile/chunker.js";
import { KeywordRetriever } from "../src/profile/retriever.js";
import { SemanticRetriever } from "../src/profile/semanticRetriever.js";
import { FakeEmbeddingProvider } from "./fixtures/fakeEmbeddingProvider.js";

const fixturesRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "profiles"
);

describe("Profile isolation", () => {
  it("never returns chunks from another profile for the same query", async () => {
    const loader = new FsProfileLoader(fixturesRoot);

    const profileA = await loader.loadProfile("profile-a");
    const profileB = await loader.loadProfile("profile-b");

    const retrieverA = new KeywordRetriever(buildIndex(profileA).chunks);
    const retrieverB = new KeywordRetriever(buildIndex(profileB).chunks);

    const resultsA = await retrieverA.search("Java experience", { topK: 5, minScore: 0 });
    expect(resultsA.every((result) => result.chunk.profileId === "profile-a")).toBe(true);

    // Profile B has no Java-related content at all.
    await expect(
      retrieverB.search("Java experience", { topK: 5 })
    ).rejects.toMatchObject({ code: "NO_RELEVANT_CONTEXT" });
  });

  it("never returns chunks from another profile via SemanticRetriever either", async () => {
    const loader = new FsProfileLoader(fixturesRoot);

    const profileA = await loader.loadProfile("profile-a");
    const profileB = await loader.loadProfile("profile-b");

    const retrieverA = new SemanticRetriever(
      buildIndex(profileA).chunks,
      new FakeEmbeddingProvider(["java"]),
      { minScore: 0.5 }
    );
    const retrieverB = new SemanticRetriever(
      buildIndex(profileB).chunks,
      new FakeEmbeddingProvider(["java"]),
      { minScore: 0.5 }
    );

    const resultsA = await retrieverA.search("Java", { topK: 5 });
    expect(resultsA.every((result) => result.chunk.profileId === "profile-a")).toBe(true);

    // Profile B has no Java-related content at all, and must never surface profile A's chunks.
    await expect(retrieverB.search("Java", { topK: 5 })).rejects.toMatchObject({
      code: "NO_RELEVANT_CONTEXT",
    });
  });
});
