import type { RawPageMaterials } from "../../../src/extension/job-extraction/types.js";

const JOB_POSTING_JSON_LD = JSON.stringify({
  "@context": "https://schema.org/",
  "@type": "JobPosting",
  title: "Senior Backend Engineer",
  description:
    "<p>We are looking for a <strong>Senior Backend Engineer</strong> to join our platform team.</p><ul><li>Java and Spring Boot</li><li>AWS</li></ul>",
  hiringOrganization: { "@type": "Organization", name: "Example Corp" },
});

export const JSON_LD_RAW_MATERIALS: RawPageMaterials = {
  url: "https://jobs.example.com/senior-backend-engineer",
  documentTitle: "Senior Backend Engineer | Example Corp Careers",
  canonicalUrl: "https://jobs.example.com/senior-backend-engineer",
  metaDescription: "Join Example Corp as a Senior Backend Engineer.",
  ogTitle: "Senior Backend Engineer",
  jsonLdTexts: [JOB_POSTING_JSON_LD],
  elements: [],
  visibleText: "",
};

export const MALFORMED_JSON_LD_RAW_MATERIALS: RawPageMaterials = {
  url: "https://jobs.example.com/broken",
  documentTitle: "Broken Job Page",
  jsonLdTexts: ["{ this is not valid json", "[]", JSON.stringify({ "@type": "Organization", name: "Not a job posting" })],
  elements: [{ tag: "H1", text: "Broken Job Page" }, { tag: "P", text: "Fallback semantic content for this page." }],
  visibleText: "",
};
