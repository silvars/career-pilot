import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

await build({
  entryPoints: {
    "service-worker": path.join(root, "src/extension/background/service-worker.ts"),
    "content-script": path.join(root, "src/extension/content/content-script.ts"),
    popup: path.join(root, "src/extension/popup/popup.ts"),
  },
  bundle: true,
  outdir: distDir,
  format: "iife",
  platform: "browser",
  target: "chrome110",
  sourcemap: true,
  logLevel: "info",
});

cpSync(path.join(root, "manifest.json"), path.join(distDir, "manifest.json"));
cpSync(path.join(root, "src/extension/popup/popup.html"), path.join(distDir, "popup.html"));
cpSync(path.join(root, "src/extension/popup/popup.css"), path.join(distDir, "popup.css"));

// The extension can only fetch() files packaged inside its own dist/ output
// (SDD section 16) — the vendored profile is copied in, not read from the
// repo path.
const vendorSrc = path.join(root, "vendor", "profiles");
if (existsSync(vendorSrc)) {
  cpSync(vendorSrc, path.join(distDir, "vendor", "profiles"), { recursive: true });
}

console.log("Extension build complete -> dist/");
