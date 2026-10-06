import { describe, expect, it } from "vitest";
import {
  createInitialState,
  withInitialized,
  withPageContext,
} from "../../src/extension/state/extension-state.js";

describe("extension-state", () => {
  it("starts with no profile, no page and not initialized", () => {
    const state = createInitialState();
    expect(state).toEqual({
      initialized: false,
      activeProfileId: null,
      currentPage: null,
      contentScriptConnected: false,
    });
  });

  it("withInitialized marks the state initialized with the given profile id, immutably", () => {
    const before = createInitialState();
    const after = withInitialized(before, "rodrigo-matos");

    expect(after).toEqual({
      initialized: true,
      activeProfileId: "rodrigo-matos",
      currentPage: null,
      contentScriptConnected: false,
    });
    expect(before.initialized).toBe(false); // original untouched
  });

  it("withPageContext marks the content script as connected when a page is provided", () => {
    const state = withPageContext(createInitialState(), { url: "https://example.com", title: "Example" });
    expect(state.contentScriptConnected).toBe(true);
    expect(state.currentPage).toEqual({ url: "https://example.com", title: "Example" });
  });

  it("withPageContext(null) marks the content script as disconnected", () => {
    const connected = withPageContext(createInitialState(), { url: "https://example.com", title: "Example" });
    const disconnected = withPageContext(connected, null);
    expect(disconnected.contentScriptConnected).toBe(false);
    expect(disconnected.currentPage).toBeNull();
  });
});
