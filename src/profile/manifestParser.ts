import { ProfileError } from "./errors.js";
import type { ProfileManifest } from "./types.js";

/**
 * Pure manifest parsing/validation, with zero runtime-specific imports (no
 * `node:fs`). Shared by every ProfileLoader implementation (FsProfileLoader,
 * ChromeProfileLoader, ...) — loaders only differ in how they fetch the raw
 * bytes (filesystem vs chrome.runtime.getURL + fetch), never in how the
 * manifest is interpreted. Kept separate from profileLoader.ts so it can be
 * bundled for the browser without pulling in Node built-ins.
 */
export function parseManifestJson(raw: string, profileId: string): ProfileManifest {
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

export function validateManifestShape(value: unknown, profileId: string): ProfileManifest {
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
