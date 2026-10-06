import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const manifestPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "manifest.json"
);

describe("manifest.json", () => {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  it("declares Manifest V3", () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it("has the required top-level keys", () => {
    expect(typeof manifest.name).toBe("string");
    expect(typeof manifest.version).toBe("string");
    expect(manifest.background?.service_worker).toBe("service-worker.js");
    expect(manifest.action?.default_popup).toBe("popup.html");
  });

  it("restricts the content script to http/https (not <all_urls>)", () => {
    const [contentScript] = manifest.content_scripts;
    expect(contentScript.matches).toEqual(["http://*/*", "https://*/*"]);
    expect(contentScript.js).toEqual(["content-script.js"]);
  });

  it("requests no permissions (least privilege — SDD decision 2026-10-06)", () => {
    expect(manifest.permissions).toBeUndefined();
  });
});
