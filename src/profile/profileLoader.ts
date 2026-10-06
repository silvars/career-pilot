import { promises as fs } from "node:fs";
import path from "node:path";
import { ProfileError } from "./errors.js";
import { parseMarkdown } from "./markdownParser.js";
import { parseManifestJson } from "./manifestParser.js";
import type { Profile, ProfileDocument } from "./types.js";

export { parseManifestJson, validateManifestShape } from "./manifestParser.js";

export interface ProfileLoader {
  loadProfile(profileId: string): Promise<Profile>;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads a profile from a local vendored directory
 * (`vendor/profiles/<profileId>/`, per SDD section 6.1).
 *
 * This loader only reads from the local filesystem — it never performs
 * network access. Synchronizing the vendored copy is a separate, manual
 * step (`scripts/sync-profile.ts`, SDD section 6).
 */
export class FsProfileLoader implements ProfileLoader {
  constructor(private readonly profilesRoot: string) {}

  async loadProfile(profileId: string): Promise<Profile> {
    const profileDir = path.join(this.profilesRoot, profileId);

    if (!(await pathExists(profileDir))) {
      throw new ProfileError(
        "PROFILE_NOT_FOUND",
        `Profile "${profileId}" was not found under "${this.profilesRoot}".`
      );
    }

    const manifestPath = path.join(profileDir, "profile.json");
    if (!(await pathExists(manifestPath))) {
      throw new ProfileError(
        "MANIFEST_NOT_FOUND",
        `profile.json was not found for profile "${profileId}" at "${manifestPath}".`
      );
    }

    const manifest = await readManifest(manifestPath, profileId);
    const documents: ProfileDocument[] = [];

    for (const entry of manifest.documents) {
      const documentPath = path.join(profileDir, entry.path);

      if (!(await pathExists(documentPath))) {
        throw new ProfileError(
          "DOCUMENT_NOT_FOUND",
          `Document "${entry.path}" declared in the manifest of "${profileId}" was not found.`
        );
      }

      let raw: string;
      try {
        raw = await fs.readFile(documentPath, "utf8");
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

async function readManifest(
  manifestPath: string,
  profileId: string
): Promise<ReturnType<typeof parseManifestJson>> {
  let raw: string;
  try {
    raw = await fs.readFile(manifestPath, "utf8");
  } catch (cause) {
    throw new ProfileError(
      "MANIFEST_NOT_FOUND",
      `Failed to read profile.json for "${profileId}": ${String(cause)}`
    );
  }

  return parseManifestJson(raw, profileId);
}
