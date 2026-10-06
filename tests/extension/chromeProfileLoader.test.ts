import { afterEach, describe, expect, it, vi } from "vitest";
import { ChromeProfileLoader } from "../../src/extension/profile/chromeProfileLoader.js";

const PROFILE_JSON = JSON.stringify({
  id: "fixture-profile",
  name: "Fixture Profile",
  version: "1.0.0",
  documents: [{ path: "identity/summary.md", type: "identity" }],
});

const SUMMARY_MD = "# Summary\n\n## Background\n\nFixture background content.\n";

function fakeResponse(body: string | null): Response {
  if (body === null) {
    return new Response(null, { status: 404 });
  }
  return new Response(body, { status: 200 });
}

function installChromeAndFetch(routes: Record<string, string | null>) {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      getURL: (path: string) => `chrome-extension://fake-id/${path}`,
    },
  };

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const key = url.replace("chrome-extension://fake-id/", "");
      return fakeResponse(key in routes ? routes[key] : null);
    })
  );
}

describe("ChromeProfileLoader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  it("loads a profile via chrome.runtime.getURL + fetch", async () => {
    installChromeAndFetch({
      "vendor/profiles/fixture-profile/profile.json": PROFILE_JSON,
      "vendor/profiles/fixture-profile/identity/summary.md": SUMMARY_MD,
    });

    const loader = new ChromeProfileLoader();
    const profile = await loader.loadProfile("fixture-profile");

    expect(profile.id).toBe("fixture-profile");
    expect(profile.documents).toHaveLength(1);
    expect(profile.documents[0].title).toBe("Summary");
    expect(profile.documents[0].sections).toEqual([
      { heading: "Background", level: 2, content: "Fixture background content." },
    ]);
  });

  it("throws MANIFEST_NOT_FOUND when profile.json cannot be fetched", async () => {
    installChromeAndFetch({});

    const loader = new ChromeProfileLoader();
    await expect(loader.loadProfile("fixture-profile")).rejects.toMatchObject({
      code: "MANIFEST_NOT_FOUND",
    });
  });

  it("throws MANIFEST_INVALID for malformed JSON", async () => {
    installChromeAndFetch({
      "vendor/profiles/fixture-profile/profile.json": "{not valid json",
    });

    const loader = new ChromeProfileLoader();
    await expect(loader.loadProfile("fixture-profile")).rejects.toMatchObject({
      code: "MANIFEST_INVALID",
    });
  });

  it("throws DOCUMENT_NOT_FOUND when a declared document cannot be fetched", async () => {
    installChromeAndFetch({
      "vendor/profiles/fixture-profile/profile.json": PROFILE_JSON,
      // identity/summary.md intentionally missing
    });

    const loader = new ChromeProfileLoader();
    await expect(loader.loadProfile("fixture-profile")).rejects.toMatchObject({
      code: "DOCUMENT_NOT_FOUND",
    });
  });
});
