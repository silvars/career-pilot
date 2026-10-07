import { buildPopupViewModel } from "./popupViewModel.js";
import { buildFormIntelligenceViewModel } from "./formIntelligenceViewModel.js";
import type { ExtensionMessage, ExtensionResponse } from "../messaging/messages.js";
import type { MatchResult } from "../../job-match/types.js";
import type { FormIntelligenceResult } from "../../form-intelligence/types/formIntelligenceResult.js";

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
let analyzingForm = false;
let lastFormIntelligence: ExtensionResponse<FormIntelligenceResult | null> | null = null;

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

function renderFormIntelligence(): void {
  const vm = buildFormIntelligenceViewModel({ analyzing: analyzingForm, result: lastFormIntelligence });

  setText("form-status", vm.statusLabel);
  setText("form-summary", vm.summaryLabel);
  setList(
    "form-fields",
    vm.rows.map(
      (row) =>
        `${row.fieldLabel} [${row.semanticType}] → ${row.answerPreview} ` +
        `(source=${row.source}, confidence=${row.confidence.toFixed(2)}${row.requiresReview ? ", review needed" : ""})`
    )
  );
}

/**
 * FASE 5 (Form Intelligence): read-only — never fills, selects or submits
 * anything on the page (SDD "Form Intelligence" sections 10/13).
 */
async function analyzeForm(): Promise<void> {
  analyzingForm = true;
  renderFormIntelligence();

  lastFormIntelligence = await sendMessage<FormIntelligenceResult | null>({ type: "ANALYZE_FORM" });
  analyzingForm = false;
  renderFormIntelligence();
}

async function restorePreviousFormIntelligence(): Promise<void> {
  lastFormIntelligence = await sendMessage<FormIntelligenceResult | null>({ type: "GET_FORM_INTELLIGENCE" });
}

/**
 * Validation-only (FASE 4.1 Definition of Done), not part of the normal
 * flow: `chrome.runtime.sendMessage` from the Service Worker's own DevTools
 * console never reaches its own `onMessage` listener (Chrome doesn't
 * deliver a message back to its sender's context), so the popup — a
 * separate context — is the simplest real sender for this one-off check.
 */
async function runRetrievalBenchmark(): Promise<void> {
  const output = document.getElementById("retrieval-benchmark-output");
  if (!output) {
    return;
  }
  output.textContent = "Running…";
  const response = await sendMessage({ type: "RUN_RETRIEVAL_BENCHMARK" });
  output.textContent = JSON.stringify(response, null, 2);
}

document.getElementById("check-connection")?.addEventListener("click", () => {
  void renderStatusAndProfile();
});

document.getElementById("analyze-job")?.addEventListener("click", () => {
  void analyzeJob();
});

document.getElementById("analyze-form")?.addEventListener("click", () => {
  void analyzeForm();
});

document.getElementById("run-retrieval-benchmark")?.addEventListener("click", () => {
  void runRetrievalBenchmark();
});

document.addEventListener("DOMContentLoaded", () => {
  void restorePreviousResult().then(renderStatusAndProfile);
  void restorePreviousFormIntelligence().then(renderFormIntelligence);
});
