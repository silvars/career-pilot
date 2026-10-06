import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FsProfileLoader } from "../src/profile/profileLoader.js";
import { ProfileError } from "../src/profile/errors.js";

const fixturesRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "profiles"
);

describe("FsProfileLoader", () => {
  it("loads a valid profile and parses its declared documents", async () => {
    const loader = new FsProfileLoader(fixturesRoot);

    const profile = await loader.loadProfile("profile-a");

    expect(profile.id).toBe("profile-a");
    expect(profile.name).toBe("Profile A");
    expect(profile.documents).toHaveLength(2);

    const java = profile.documents.find((doc) => doc.path === "skills/java.md");
    expect(java?.title).toBe("Java");
    expect(java?.sections).toHaveLength(2);
    expect(java?.type).toBe("skills");
  });

  it("throws PROFILE_NOT_FOUND for a profile directory that does not exist", async () => {
    const loader = new FsProfileLoader(fixturesRoot);

    await expect(loader.loadProfile("does-not-exist")).rejects.toMatchObject({
      code: "PROFILE_NOT_FOUND",
    } satisfies Partial<ProfileError>);
  });

  it("throws MANIFEST_NOT_FOUND when profile.json is missing", async () => {
    const loader = new FsProfileLoader(fixturesRoot);

    await expect(loader.loadProfile("profile-no-manifest")).rejects.toMatchObject({
      code: "MANIFEST_NOT_FOUND",
    });
  });

  it("throws MANIFEST_INVALID for syntactically invalid JSON", async () => {
    const loader = new FsProfileLoader(fixturesRoot);

    await expect(loader.loadProfile("profile-bad-json")).rejects.toMatchObject({
      code: "MANIFEST_INVALID",
    });
  });

  it("throws MANIFEST_INVALID when the manifest is missing required fields", async () => {
    const loader = new FsProfileLoader(fixturesRoot);

    await expect(loader.loadProfile("profile-bad-shape")).rejects.toMatchObject({
      code: "MANIFEST_INVALID",
    });
  });

  it("throws MANIFEST_INVALID when the manifest lists a duplicate document path", async () => {
    const loader = new FsProfileLoader(fixturesRoot);

    await expect(loader.loadProfile("profile-duplicate-doc")).rejects.toMatchObject({
      code: "MANIFEST_INVALID",
    });
  });

  it("throws DOCUMENT_NOT_FOUND when a declared document file does not exist", async () => {
    const loader = new FsProfileLoader(fixturesRoot);

    await expect(loader.loadProfile("profile-missing-doc")).rejects.toMatchObject({
      code: "DOCUMENT_NOT_FOUND",
    });
  });
});
