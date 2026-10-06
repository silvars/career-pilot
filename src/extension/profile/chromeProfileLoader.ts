import { ProfileError } from "../../profile/errors.js";
import { parseManifestJson } from "../../profile/manifestParser.js";
import { parseMarkdown } from "../../profile/markdownParser.js";
import type { ProfileLoader } from "../../profile/profileLoader.js";
import type { Profile, ProfileDocument } from "../../profile/types.js";

async function fetchOk(url: string): Promise<Response | null> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return null;
  }
  return response.ok ? response : null;
}

/**
 * Browser-native counterpart of FsProfileLoader (SDD section 13): reads the
 * vendored profile via `chrome.runtime.getURL(...) + fetch(...)` instead of
 * `node:fs`, which does not exist in a service worker. Parsing/validation
 * logic (parseManifestJson, parseMarkdown) is reused as-is from
 * `src/profile/` — this is a second ProfileLoader *implementation*, not a
 * second profile-loading mechanism.
 */
export class ChromeProfileLoader implements ProfileLoader {
  constructor(private readonly profilesRoot: string = "vendor/profiles") {}

  async loadProfile(profileId: string): Promise<Profile> {
    const baseUrl = chrome.runtime.getURL(`${this.profilesRoot}/${profileId}/`);
    const manifestResponse = await fetchOk(`${baseUrl}profile.json`);

    if (!manifestResponse) {
      throw new ProfileError(
        "MANIFEST_NOT_FOUND",
        `profile.json was not found for profile "${profileId}" at "${baseUrl}profile.json".`
      );
    }

    const manifest = parseManifestJson(await manifestResponse.text(), profileId);
    const documents: ProfileDocument[] = [];

    for (const entry of manifest.documents) {
      const documentUrl = `${baseUrl}${entry.path}`;
      const documentResponse = await fetchOk(documentUrl);

      if (!documentResponse) {
        throw new ProfileError(
          "DOCUMENT_NOT_FOUND",
          `Document "${entry.path}" declared in the manifest of "${profileId}" was not found.`
        );
      }

      let raw: string;
      try {
        raw = await documentResponse.text();
      } catch (cause) {
        throw new ProfileError(
          "DOCUMENT_LOAD_ERROR",
          `Failed to read document "${entry.path}" for profile "${profileId}": ${String(cause)}`
        );
      }

      let parsed;
      try {
        parsed = parseMarkdown(raw);
      } catch (cause) {
        throw new ProfileError(
          "MARKDOWN_INVALID",
          `Failed to parse Markdown for document "${entry.path}": ${String(cause)}`
        );
      }

      documents.push({
        id: `${manifest.id}::${entry.path}`,
        profileId: manifest.id,
        path: entry.path,
        type: entry.type,
        title: parsed.title,
        content: raw,
        sections: parsed.sections,
        tags: [],
      });
    }

    return {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      documents,
    };
  }
}
