import type { RetrievalBenchmarkCase } from "../../profile/retrievalBenchmark.js";

/**
 * The 4 known KeywordRetriever false negatives documented in
 * SDD/CAREER_PILOT_JOB_MATCH_CHROME_SDD.md section 40.1 — real job
 * requirement phrasing that doesn't share enough literal keywords with the
 * bundled `rodrigo-matos` profile's actual wording for coverage-based
 * keyword matching to find it, even though the content is clearly relevant.
 * Used to measure whether HybridRetriever's semantic branch recovers them
 * (SDD "Local Semantic Retrieval" section 19 — Recall@3, Recall@5, MRR).
 */
export const RETRIEVAL_BENCHMARK_CASES: RetrievalBenchmarkCase[] = [
  {
    label: "autonomy",
    query: "experience fostering team autonomy and ownership",
    expectedChunkPath: "skills/leadership.md",
    // Chunker splits on level-2 headings only ("## ..."); "### Autonomy" is
    // a level-3 subsection embedded inside "## Leadership philosophy", not
    // its own chunk.
    expectedChunkTitle: "Leadership philosophy",
  },
  {
    label: "process-simplification",
    query: "simplifying processes and reducing unnecessary bureaucracy",
    expectedChunkPath: "skills/leadership.md",
    expectedChunkTitle: "Operating philosophy",
  },
  {
    label: "business-outcomes",
    query: "connecting engineering work to measurable business outcomes",
    expectedChunkPath: "achievements/leadership-impact.md",
    expectedChunkTitle: "Executive impact narrative",
  },
  {
    label: "technical-proximity",
    query: "staying technically close to the team while in a leadership role",
    expectedChunkPath: "skills/leadership.md",
    expectedChunkTitle: "Technical leadership style",
  },
];
