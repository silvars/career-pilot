import { JobMatchError } from "../../job-match/errors.js";
import type { JobPageSource } from "../../job-match/jobPageSource.js";
import type { JobPage } from "../../job-match/types.js";
import { buildExtractedJobPage, hasMeaningfulContent, toJobPage } from "./extractor.js";
import type { RawPageMaterials } from "./types.js";
import type { ExtensionResponse } from "../messaging/messages.js";

/**
 * Browser-side JobPageSource (FASE 4 SDD section 8). Implements the existing
 * FASE 2 `JobPageSource` contract unchanged (decision 1.1) — relays
 * `EXTRACT_JOB_PAGE` to the active tab's content script, then runs the pure
 * extraction pipeline (`src/extension/job-extraction/`).
 */
export class ChromeJobPageSource implements JobPageSource {
  async getCurrentJobPage(): Promise<JobPage> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new JobMatchError("JOB_PAGE_NOT_READABLE", "No active tab found.");
    }

    let response: ExtensionResponse<RawPageMaterials> | undefined;
    try {
      response = (await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_JOB_PAGE" })) as
        | ExtensionResponse<RawPageMaterials>
        | undefined;
    } catch (cause) {
      throw new JobMatchError("JOB_PAGE_NOT_READABLE", `Content script unavailable: ${String(cause)}`);
    }

    if (!response?.success || !response.data) {
      throw new JobMatchError(
        "JOB_PAGE_NOT_READABLE",
        response?.error?.message ?? "Content script did not return page data."
      );
    }

    const { extracted } = buildExtractedJobPage(response.data);

    if (!hasMeaningfulContent(extracted)) {
      throw new JobMatchError(
        "JOB_REQUIREMENTS_NOT_FOUND",
        "The current page does not appear to contain enough job content to analyze."
      );
    }

    return toJobPage(extracted);
  }
}
