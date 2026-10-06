import { ExtensionError, toErrorPayload } from "../errors.js";
import { isExtensionMessage } from "./messages.js";
import type { ExtensionMessage, ExtensionResponse } from "./messages.js";

export interface MessageHandlerContext {
  getExtensionStatus(): ExtensionResponse;
  getActiveProfile(): Promise<ExtensionResponse>;
  relayToContentScript(message: ExtensionMessage): Promise<ExtensionResponse>;
}

/**
 * Chrome-agnostic message router (SDD section 11): the Service Worker wires
 * this to `chrome.runtime.onMessage`, but the routing logic itself takes no
 * Chrome dependency and is fully unit-testable.
 */
export async function handleMessage(
  message: unknown,
  ctx: MessageHandlerContext
): Promise<ExtensionResponse> {
  if (!isExtensionMessage(message)) {
    return {
      success: false,
      error: new ExtensionError(
        "INVALID_MESSAGE",
        `Unknown or malformed message: ${JSON.stringify(message)}`
      ).toPayload(),
    };
  }

  try {
    switch (message.type) {
      case "GET_EXTENSION_STATUS":
        return ctx.getExtensionStatus();
      case "GET_ACTIVE_PROFILE":
        return await ctx.getActiveProfile();
      case "PING_CONTENT_SCRIPT":
      case "GET_PAGE_CONTEXT":
        return await ctx.relayToContentScript(message);
    }
  } catch (cause) {
    return { success: false, error: toErrorPayload(cause) };
  }
}
