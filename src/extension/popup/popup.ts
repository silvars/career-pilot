import { buildPopupViewModel } from "./popupViewModel.js";
import { buildFormIntelligenceViewModel } from "./formIntelligenceViewModel.js";
import { buildAutofillPlanViewModel, buildAutofillExecutionViewModel } from "./autofillReviewViewModel.js";
import type { ExtensionMessage, ExtensionResponse } from "../messaging/messages.js";
import type { MatchResult } from "../../job-match/types.js";
import type { FormIntelligenceResult } from "../../form-intelligence/types/formIntelligenceResult.js";
import type { AutofillPlan } from "../../autofill/types/autofillAction.js";
import type { AutofillResult } from "../../autofill/types/autofillResult.js";

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
let buildingAutofillPlan = false;
let lastAutofillPlan: ExtensionResponse<AutofillPlan | null> | null = null;
let executingAutofill = false;
let lastAutofillExecution: ExtensionResponse<AutofillResult | null> | null = null;
/** Popup-local only (SDD "Autofill" FASE 6.3 rule: no persistence) — which fieldIds are checked for the next "Fill Selected". */
let selectedFieldIds = new Set<string>();

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

function updateFillSelectedButtonState(): void {
  const button = document.getElementById("fill-selected") as HTMLButtonElement | null;
  if (button) {
    button.disabled = selectedFieldIds.size === 0 || executingAutofill;
  }
}

/**
 * Renders the AutofillPlan as a review checklist (SDD "Autofill" FASE 6.3
 * rules): requiresReview=false rows start checked, requiresReview=true rows
 * start unchecked, SKIP rows have no checkbox (nothing to execute). Never
 * fills, selects or submits anything itself — purely a review surface.
 */
function renderAutofillPlan(): void {
  const vm = buildAutofillPlanViewModel({ building: buildingAutofillPlan, plan: lastAutofillPlan });
  setText("autofill-plan-status", vm.statusLabel);

  const container = document.getElementById("autofill-rows");
  if (!container) {
    return;
  }
  container.textContent = "";

  for (const row of vm.rows) {
    const rowEl = document.createElement("div");

    if (row.selectable) {
      const checkboxId = `autofill-row-${row.fieldId}`;
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = checkboxId;
      checkbox.checked = row.selectedByDefault;
      if (row.selectedByDefault) {
        selectedFieldIds.add(row.fieldId);
      }
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          selectedFieldIds.add(row.fieldId);
        } else {
          selectedFieldIds.delete(row.fieldId);
        }
        updateFillSelectedButtonState();
      });
      rowEl.appendChild(checkbox);

      const label = document.createElement("label");
      label.setAttribute("for", checkboxId);
      label.textContent =
        `${row.fieldId}: ${row.actionLabel} \u2192 ${row.valuePreview}` +
        (row.requiresReview ? " (review needed)" : "");
      rowEl.appendChild(label);
    } else {
      const span = document.createElement("span");
      span.textContent = `${row.fieldId}: ${row.actionLabel} (${row.valuePreview})`;
      rowEl.appendChild(span);
    }

    container.appendChild(rowEl);
  }

  updateFillSelectedButtonState();
}

function renderAutofillExecution(): void {
  const vm = buildAutofillExecutionViewModel({ executing: executingAutofill, result: lastAutofillExecution });
  setText("autofill-execution-status", vm.statusLabel);
  setList("autofill-execution-details", vm.lines);
}

/**
 * Builds the AutofillPlan from the last ANALYZE_FORM result (Service
 * Worker side, FASE 6.3) — no new extraction, classification or answer
 * generation happens here or there; purely assembles already-computed data
 * into actions for review.
 */
async function buildAutofillPlan(): Promise<void> {
  buildingAutofillPlan = true;
  selectedFieldIds = new Set();
  lastAutofillExecution = null;
  renderAutofillPlan();
  renderAutofillExecution();

  lastAutofillPlan = await sendMessage<AutofillPlan | null>({ type: "BUILD_AUTOFILL_PLAN" });
  buildingAutofillPlan = false;
  renderAutofillPlan();
}

async function restorePreviousAutofillPlan(): Promise<void> {
  lastAutofillPlan = await sendMessage<AutofillPlan | null>({ type: "GET_AUTOFILL_PLAN" });
}

/**
 * Executes ONLY the actions the user explicitly selected (SDD "Autofill"
 * FASE 6.3 rule: "executar somente as ações selecionadas") via the FASE 6.2
 * executor, unchanged. This is the only path in the Popup that can ever
 * cause a DOM write on the page.
 */
async function fillSelected(): Promise<void> {
  if (!lastAutofillPlan?.data || selectedFieldIds.size === 0) {
    return;
  }

  const selectedActions = lastAutofillPlan.data.actions.filter((action) => selectedFieldIds.has(action.fieldId));
  const filteredPlan: AutofillPlan = {
    formId: lastAutofillPlan.data.formId,
    actions: selectedActions,
    summary: {
      total: selectedActions.length,
      fillable: selectedActions.length,
      requiresReview: selectedActions.filter((action) => action.requiresReview).length,
      skipped: 0,
    },
  };

  executingAutofill = true;
  renderAutofillExecution();
  updateFillSelectedButtonState();

  lastAutofillExecution = await sendMessage<AutofillResult | null>({
    type: "EXECUTE_AUTOFILL_PLAN",
    plan: filteredPlan,
  });

  executingAutofill = false;
  renderAutofillExecution();
  updateFillSelectedButtonState();
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

document.getElementById("build-autofill-plan")?.addEventListener("click", () => {
  void buildAutofillPlan();
});

document.getElementById("fill-selected")?.addEventListener("click", () => {
  void fillSelected();
});

document.getElementById("run-retrieval-benchmark")?.addEventListener("click", () => {
  void runRetrievalBenchmark();
});

document.addEventListener("DOMContentLoaded", () => {
  void restorePreviousResult().then(renderStatusAndProfile);
  void restorePreviousFormIntelligence().then(renderFormIntelligence);
  void restorePreviousAutofillPlan().then(renderAutofillPlan);
});
