import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FsProfileLoader } from "../src/profile/profileLoader.js";
import { DefaultProfileManager } from "../src/profile/profileManager.js";
import { KeywordRetriever } from "../src/profile/retriever.js";
import { DefaultCareerContextBuilder } from "../src/profile/careerContextBuilder.js";

const vendorRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "vendor",
  "profiles"
);

describe("Definition of Done (SDD section 31)", () => {
  it("loads the profile, retrieves relevant chunks and builds a traceable career context", async () => {
    const profileManager = new DefaultProfileManager(new FsProfileLoader(vendorRoot));

    const profile = await profileManager.load("rodrigo-matos");
    expect(profile.id).toBe("rodrigo-matos");

    const index = profileManager.getActiveIndex();
    expect(index).not.toBeNull();

    const retriever = new KeywordRetriever(index!.chunks);
    const query = "How many people have you managed?";
    const results = await retriever.search(query, { topK: 5 });

    const contextBuilder = new DefaultCareerContextBuilder(profile);
    const context = contextBuilder.build(query, results);

    expect(context.query).toBe(query);
    expect(context.candidateName).toBe("Rodrigo Matos Silva");
    expect(context.items.length).toBeGreaterThan(0);

    // Source traceability (SDD section 22): every item must carry its provenance.
    for (const item of context.items) {
      expect(item.profileId).toBe("rodrigo-matos");
      expect(item.documentId).toMatch(/^rodrigo-matos::/);
      expect(item.path.length).toBeGreaterThan(0);
      expect(item.chunkId.length).toBeGreaterThan(0);
    }

    // No hallucination (SDD section 23): content must be traceable to real vendored files.
    for (const item of context.items) {
      expect(index!.chunks.some((chunk) => chunk.id === item.chunkId)).toBe(true);
    }
  });

  it("reload() only re-reads the local vendored profile, without touching the network", async () => {
    const profileManager = new DefaultProfileManager(new FsProfileLoader(vendorRoot));
    await profileManager.load("rodrigo-matos");

    const reloaded = await profileManager.reload("rodrigo-matos");

    expect(reloaded.id).toBe("rodrigo-matos");
    expect(reloaded.documents.length).toBe(profileManager.getActiveProfile()!.documents.length);
  });

  it("rejects reload() for a profile that is not currently active", async () => {
    const profileManager = new DefaultProfileManager(new FsProfileLoader(vendorRoot));
    await profileManager.load("rodrigo-matos");

    await expect(profileManager.reload("some-other-profile")).rejects.toMatchObject({
      code: "PROFILE_NOT_FOUND",
    });
  });

  it("clear() removes the active profile and index from memory", async () => {
    const profileManager = new DefaultProfileManager(new FsProfileLoader(vendorRoot));
    await profileManager.load("rodrigo-matos");

    profileManager.clear();

    expect(profileManager.getActiveProfile()).toBeNull();
    expect(profileManager.getActiveIndex()).toBeNull();
  });
});
