#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, cpSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Manual, explicit profile synchronization (SDD section 6).
 *
 * Usage:
 *   npm run sync-profile -- --repository <git-url-or-path> --ref <tag-or-commit> --profile <profileId>
 *
 * This script MUST NOT be invoked automatically by the application. It only
 * produces a local vendored copy under vendor/profiles/<profileId>/, which
 * the Profile Loader reads from at runtime (section 6.1). Updating the
 * profile is: sync -> review changes -> commit.
 */

interface SyncConfig {
  repository: string;
  ref: string;
  profileId: string;
}

function parseArgs(argv: string[]): SyncConfig {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`Missing value for argument "--${key}"`);
      }
      args.set(key, value);
      i += 1;
    }
  }

  const repository = args.get("repository");
  const ref = args.get("ref");
  const profileId = args.get("profile");

  if (!repository) {
    throw new Error('Missing required argument: --repository "<git-url-or-path>"');
  }
  if (!ref) {
    throw new Error(
      'Missing required argument: --ref "<tag-or-commit>". ' +
      "The sync does not implicitly consume the latest repository state."
    );
  }
  if (!profileId) {
    throw new Error('Missing required argument: --profile "<profileId>"');
  }

  return { repository, ref, profileId };
}

function syncProfile(config: SyncConfig, projectRoot: string): void {
  const tmpDir = mkdtempSync(path.join(tmpdir(), "career-pilot-profile-sync-"));

  try {
    execFileSync("git", ["clone", "--quiet", config.repository, tmpDir], {
      stdio: "inherit",
    });

    try {
      execFileSync("git", ["-C", tmpDir, "checkout", "--quiet", config.ref], {
        stdio: "inherit",
      });
    } catch (cause) {
      throw new Error(
        `Failed to retrieve ref "${config.ref}" from "${config.repository}": ${String(cause)}`
      );
    }

    const sourceProfileDir = path.join(tmpDir, "profiles", config.profileId);
    if (!existsSync(sourceProfileDir)) {
      throw new Error(
        `Profile "${config.profileId}" was not found under profiles/ at ref "${config.ref}" in "${config.repository}".`
      );
    }

    const vendorRoot = path.join(projectRoot, "vendor", "profiles");
    mkdirSync(vendorRoot, { recursive: true });
    const destDir = path.join(vendorRoot, config.profileId);

    rmSync(destDir, { recursive: true, force: true });
    cpSync(sourceProfileDir, destDir, { recursive: true });

    console.log(
      `Synced profile "${config.profileId}" @ ${config.ref} -> vendor/profiles/${config.profileId}`
    );
    console.log("Next steps: review the changes, then commit them.");
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function main(): void {
  const config = parseArgs(process.argv.slice(2));
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(scriptDir, "..");
  syncProfile(config, projectRoot);
}

main();
