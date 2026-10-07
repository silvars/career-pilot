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

  it("requests only activeTab + offscreen (least privilege, no install-time warning)", () => {
    // Required starting FASE 4: chrome.tabs.query's `url` field is only
    // populated with "tabs" permission or host permissions — content_scripts
    // matches alone is NOT enough (confirmed against the official Chrome
    // docs after a real false negative: "This page cannot be analyzed:
    // unknown URL" on a real http(s) page). activeTab is the least-privilege
    // fix since every analysis is already user-triggered via the popup.
    // "offscreen" was added for the FASE 4.1-B viability spike only — remove
    // this permission if the Offscreen Document architecture is abandoned.
    expect(manifest.permissions).toEqual(["activeTab", "offscreen"]);
  });

  it("explicitly allows 'wasm-unsafe-eval' for the FASE 4.1-B embedding spike (ONNX Runtime WASM)", () => {
    // Real finding (2026-10-07): even with the WASM factory vendored
    // locally (no remote script load), WebAssembly.instantiate() was still
    // blocked — "neither 'wasm-eval' nor 'unsafe-eval' is an allowed source
    // ... script-src 'self'". Chrome's documented fix is declaring
    // 'wasm-unsafe-eval' explicitly; plain 'unsafe-eval' is deliberately not
    // used (far broader than needed, and Chrome Web Store discourages it).
    expect(manifest.content_security_policy?.extension_pages).toBe(
      "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
    );
  });
});
