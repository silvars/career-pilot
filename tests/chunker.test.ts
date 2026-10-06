import { describe, expect, it } from "vitest";
import { buildIndex, chunkDocument } from "../src/profile/chunker.js";
import type { Profile, ProfileDocument } from "../src/profile/types.js";

function makeDocument(overrides: Partial<ProfileDocument> = {}): ProfileDocument {
  return {
    id: "profile-a::skills/java.md",
    profileId: "profile-a",
    path: "skills/java.md",
    type: "skills",
    title: "Java",
    content: "# Java\n\n## Experience\n\nMore than 20 years.\n",
    sections: [
      { heading: "Experience", level: 2, content: "More than 20 years." },
      { heading: "Context", level: 2, content: "Backend and distributed systems." },
    ],
    tags: [],
    ...overrides,
  };
}

describe("chunkDocument", () => {
  it("creates one chunk per section, preserving heading and content", () => {
    const document = makeDocument();

    const chunks = chunkDocument(document);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({
      documentId: document.id,
      profileId: "profile-a",
      type: "skills",
      title: "Experience",
      content: "More than 20 years.",
      path: "skills/java.md",
    });
    expect(chunks[1]).toMatchObject({
      title: "Context",
      content: "Backend and distributed systems.",
    });
  });

  it("produces unique, stable chunk ids derived from the document id", () => {
    const document = makeDocument();

    const chunks = chunkDocument(document);
    const ids = chunks.map((chunk) => chunk.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id.startsWith(document.id)).toBe(true);
    }
  });

  it("falls back to a single whole-document chunk when there are no sections", () => {
    const document = makeDocument({ sections: [], content: "# Title only" });

    const chunks = chunkDocument(document);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("# Title only");
  });
});

describe("buildIndex", () => {
  it("flattens chunks from every document while keeping the documents list intact", () => {
    const docA = makeDocument();
    const docB = makeDocument({
      id: "profile-a::identity/summary.md",
      path: "identity/summary.md",
      type: "identity",
      title: "Summary",
      sections: [{ heading: "Background", level: 2, content: "Profile A background." }],
    });
    const profile: Profile = {
      id: "profile-a",
      name: "Profile A",
      version: "1.0.0",
      documents: [docA, docB],
    };

    const index = buildIndex(profile);

    expect(index.documents).toBe(profile.documents);
    expect(index.chunks).toHaveLength(3); // 2 from docA + 1 from docB
    expect(index.chunks.every((chunk) => chunk.profileId === "profile-a")).toBe(true);
  });
});
