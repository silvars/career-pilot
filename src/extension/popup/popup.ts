import { buildPopupViewModel } from "./popupViewModel.js";
import type { ExtensionMessage, ExtensionResponse } from "../messaging/messages.js";

function sendMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
  return chrome.runtime.sendMessage(message);
}

function setText(elementId: string, text: string): void {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = text;
  }
}

async function render(): Promise<void> {
  const [status, profile, ping] = await Promise.all([
    sendMessage({ type: "GET_EXTENSION_STATUS" }),
    sendMessage({ type: "GET_ACTIVE_PROFILE" }),
    sendMessage({ type: "PING_CONTENT_SCRIPT" }).catch(
      (): ExtensionResponse => ({
        success: false,
        error: { code: "CONTENT_SCRIPT_UNAVAILABLE", message: "No response" },
      })
    ),
  ]);

  const vm = buildPopupViewModel({ status, profile, pageConnected: ping.success });

  setText("status", vm.statusLabel);
  setText("profile", vm.profileLabel);
  setText("page", vm.pageLabel);
  setText("job-match", vm.jobMatchLabel);
}

document.getElementById("check-connection")?.addEventListener("click", () => {
  void render();
});

document.addEventListener("DOMContentLoaded", () => {
  void render();
});
