import { DefaultProfileManager } from "../../profile/profileManager.js";
import { ChromeProfileLoader } from "../profile/chromeProfileLoader.js";
import { ExtensionError, toErrorPayload } from "../errors.js";
import { handleMessage } from "../messaging/message-handler.js";
import type { ExtensionMessage, ExtensionResponse } from "../messaging/messages.js";
import { createInitialState, withInitialized } from "../state/extension-state.js";
import type { ExtensionState } from "../state/extension-state.js";

// Hardcoded for FASE 3: a single bundled profile. Multi-profile selection
// (SDD Profile Reader section 26) is not part of this phase.
const ACTIVE_PROFILE_ID = "rodrigo-matos";

const profileManager = new DefaultProfileManager(new ChromeProfileLoader());
let state: ExtensionState = createInitialState();
let initPromise: Promise<void> | null = null;

/**
 * Service workers are ephemeral (SDD section 12: "must work after Service
 * Worker restarts") — this runs once per wake-up via the module-level call
 * below, not only on install.
 */
async function initialize(): Promise<void> {
  try {
    const profile = await profileManager.load(ACTIVE_PROFILE_ID);
    state = withInitialized(state, profile.id);
  } catch (cause) {
    throw new ExtensionError(
      "EXTENSION_INITIALIZATION_FAILED",
      `Failed to initialize CareerPilot: ${String(cause)}`
    );
  }
}

function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = initialize();
  }
  return initPromise;
}

function getExtensionStatus(): ExtensionResponse {
  return {
    success: true,
    data: { initialized: state.initialized, activeProfileId: state.activeProfileId },
  };
}

async function getActiveProfile(): Promise<ExtensionResponse> {
  const profile = profileManager.getActiveProfile();
  if (!profile) {
    return {
      success: false,
      error: { code: "PROFILE_NOT_LOADED", message: "No active profile loaded yet." },
    };
  }
  return { success: true, data: { id: profile.id, name: profile.name } };
}

/** Relays a message to the content script of the current active tab (SDD section 8). */
async function relayToContentScript(message: ExtensionMessage): Promise<ExtensionResponse> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return {
      success: false,
      error: { code: "CONTENT_SCRIPT_UNAVAILABLE", message: "No active tab found." },
    };
  }

  try {
    const response = (await chrome.tabs.sendMessage(tab.id, message)) as ExtensionResponse | undefined;
    if (!response) {
      return {
        success: false,
        error: {
          code: "CONTENT_SCRIPT_UNAVAILABLE",
          message: "Content script did not respond (unsupported page or not loaded).",
        },
      };
    }
    return response;
  } catch (cause) {
    return {
      success: false,
      error: {
        code: "CONTENT_SCRIPT_UNAVAILABLE",
        message: `Content script unavailable on this page: ${String(cause)}`,
      },
    };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  ensureInitialized()
    .then(() => handleMessage(message, { getExtensionStatus, getActiveProfile, relayToContentScript }))
    .then(sendResponse)
    .catch((cause) => sendResponse({ success: false, error: toErrorPayload(cause) }));
  return true; // keep the message channel open for the async sendResponse above
});

// Single entry point for initialization (shares the cached initPromise with
// the message listener above) — avoids loading the profile twice on cold start.
ensureInitialized().catch((cause) => {
  // Logged for local diagnostics only (SDD section 21) — never surfaced with
  // internal details to the popup beyond the error code/message above.
  console.error("[CareerPilot] initialization failed:", cause);
});
