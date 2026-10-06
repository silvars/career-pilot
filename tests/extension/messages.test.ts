import { describe, expect, it } from "vitest";
import { isExtensionMessage } from "../../src/extension/messaging/messages.js";

describe("isExtensionMessage", () => {
  it("accepts every known message type", () => {
    for (const type of [
      "GET_EXTENSION_STATUS",
      "GET_ACTIVE_PROFILE",
      "PING_CONTENT_SCRIPT",
      "GET_PAGE_CONTEXT",
    ]) {
      expect(isExtensionMessage({ type })).toBe(true);
    }
  });

  it("rejects unknown message types (fails safely)", () => {
    expect(isExtensionMessage({ type: "DO_SOMETHING_ELSE" })).toBe(false);
  });

  it("rejects non-object values", () => {
    expect(isExtensionMessage(null)).toBe(false);
    expect(isExtensionMessage(undefined)).toBe(false);
    expect(isExtensionMessage("GET_EXTENSION_STATUS")).toBe(false);
    expect(isExtensionMessage(42)).toBe(false);
  });

  it("rejects objects without a type field", () => {
    expect(isExtensionMessage({})).toBe(false);
    expect(isExtensionMessage({ payload: "x" })).toBe(false);
  });
});
