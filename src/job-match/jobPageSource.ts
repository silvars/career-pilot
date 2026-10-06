import { JobMatchError } from "./errors.js";
import type { JobPage } from "./types.js";

export interface JobPageSource {
  getCurrentJobPage(): Promise<JobPage>;
}

/**
 * V1 source for the Job Match logic (SDD section 6.1): returns a fixed
 * JobPage configured by the caller. Used for development and tests.
 *
 * ChromeJobPageSource (reading the live browser tab via a content script) is
 * explicitly out of scope here — see the Extension Shell / Chrome
 * Integration SDD (FASE 3, MATCH-018).
 */
export class FixtureJobPageSource implements JobPageSource {
  constructor(private readonly page: JobPage | null) {}

  async getCurrentJobPage(): Promise<JobPage> {
    if (!this.page || this.page.text.trim().length === 0) {
      throw new JobMatchError(
        "JOB_PAGE_NOT_READABLE",
        "No job page is configured for this FixtureJobPageSource."
      );
    }
    return this.page;
  }
}
