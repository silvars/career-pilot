import type { Profile, ProfileChunk, ProfileDocument, ProfileIndex } from "./types.js";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "section";
}

/** Builds one chunk per document section, using heading/section boundaries (SDD section 13). */
export function chunkDocument(document: ProfileDocument): ProfileChunk[] {
  if (document.sections.length === 0) {
    return [
      {
        id: `${document.id}--document`,
        profileId: document.profileId,
        documentId: document.id,
        type: document.type,
        title: document.title,
        content: document.content.trim(),
        path: document.path,
        tags: document.tags,
      },
    ];
  }

  return document.sections.map((section, index) => ({
    id: `${document.id}--${index}-${slugify(section.heading)}`,
    profileId: document.profileId,
    documentId: document.id,
    type: document.type,
    title: section.heading,
    content: section.content,
    path: document.path,
    tags: document.tags,
  }));
}

export function buildIndex(profile: Profile): ProfileIndex {
  const chunks = profile.documents.flatMap(chunkDocument);
  return { documents: profile.documents, chunks };
}
