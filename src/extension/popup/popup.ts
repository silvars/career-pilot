import { buildPopupViewModel } from "./popupViewModel.js";
import type { ExtensionMessage, ExtensionResponse } from "../messaging/messages.js";
import type { MatchResult } from "../../job-match/types.js";

function sendMessage<T = unknown>(message: ExtensionMessage): Promise<ExtensionResponse<T>> {
  return chrome.runtime.sendMessage(message);
}

function setText(elementId: string, text: string): void {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = text;
  }
}

function setList(elementId: string, lines: string[]): void {
  const element = document.getElementById(elementId);
  if (!element) {
    return;
  }
  element.textContent = ""; // never innerHTML with extracted content (SDD section 31)
  for (const line of lines) {
    const item = document.createElement("li");
    item.textContent = line;
    element.appendChild(item);
  }
}

let analyzing = false;
let lastJobMatch: ExtensionResponse<MatchResult | null> | null = null;

async function renderStatusAndProfile(): Promise<{ pageConnected: boolean }> {
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

  const vm = buildPopupViewModel({
    status,
    profile,
    pageConnected: ping.success,
    jobMatch: lastJobMatch,
    analyzing,
  });

  setText("status", vm.statusLabel);
  setText("profile", vm.profileLabel);
  setText("page", vm.pageLabel);
  setText("job-match", vm.jobMatchLabel);
  setList("match-details", vm.jobMatchDetails);

  return { pageConnected: ping.success };
}

async function analyzeJob(): Promise<void> {
  analyzing = true;
  await renderStatusAndProfile();

  lastJobMatch = await sendMessage<MatchResult | null>({ type: "ANALYZE_CURRENT_JOB" });
  analyzing = false;
  await renderStatusAndProfile();
}

async function restorePreviousResult(): Promise<void> {
  lastJobMatch = await sendMessage<MatchResult | null>({ type: "GET_MATCH_RESULT" });
}

document.getElementById("check-connection")?.addEventListener("click", () => {
  void renderStatusAndProfile();
});

document.getElementById("analyze-job")?.addEventListener("click", () => {
  void analyzeJob();
});

document.addEventListener("DOMContentLoaded", () => {
  void restorePreviousResult().then(renderStatusAndProfile);
});
