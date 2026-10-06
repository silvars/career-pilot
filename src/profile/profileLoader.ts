import { promises as fs } from "node:fs";
import path from "node:path";
import { ProfileError } from "./errors.js";
import { parseMarkdown } from "./markdownParser.js";
import type { Profile, ProfileDocument, ProfileManifest } from "./types.js";

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
): Promise<ProfileManifest> {
  let raw: string;
  try {
    raw = await fs.readFile(manifestPath, "utf8");
  } catch (cause) {
    throw new ProfileError(
      "MANIFEST_NOT_FOUND",
      `Failed to read profile.json for "${profileId}": ${String(cause)}`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new ProfileError(
      "MANIFEST_INVALID",
      `profile.json for "${profileId}" is not valid JSON: ${String(cause)}`
    );
  }

  return validateManifestShape(parsed, profileId);
}

function validateManifestShape(value: unknown, profileId: string): ProfileManifest {
  const fail = (reason: string): never => {
    throw new ProfileError(
      "MANIFEST_INVALID",
      `profile.json for "${profileId}" is invalid: ${reason}`
    );
  };

  if (typeof value !== "object" || value === null) {
    fail("manifest root must be an object");
  }

  const manifest = value as Record<string, unknown>;

  if (typeof manifest.id !== "string" || manifest.id.length === 0) {
    fail('"id" must be a non-empty string');
  }
  if (typeof manifest.name !== "string" || manifest.name.length === 0) {
    fail('"name" must be a non-empty string');
  }
  if (typeof manifest.version !== "string" || manifest.version.length === 0) {
    fail('"version" must be a non-empty string');
  }
  if (!Array.isArray(manifest.documents)) {
    fail('"documents" must be an array');
  }

  const seenPaths = new Set<string>();
  const documents = (manifest.documents as unknown[]).map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      fail(`documents[${index}] must be an object`);
    }
    const doc = entry as Record<string, unknown>;
    if (typeof doc.path !== "string" || doc.path.length === 0) {
      fail(`documents[${index}].path must be a non-empty string`);
    }
    if (typeof doc.type !== "string" || doc.type.length === 0) {
      fail(`documents[${index}].type must be a non-empty string`);
    }
    const docPath = doc.path as string;
    if (seenPaths.has(docPath)) {
      fail(`documents contains a duplicate path: "${docPath}"`);
    }
    seenPaths.add(docPath);
    return { path: docPath, type: doc.type as string };
  });

  return {
    id: manifest.id as string,
    name: manifest.name as string,
    version: manifest.version as string,
    documents,
  };
}
