import type { RawPageMaterials } from "../../../src/extension/job-extraction/types.js";

/**
 * Verbatim (trimmed) transcription of the real, public Canonical job posting
 * on Greenhouse (fetched 2026-10-07). English-language posting, used to test
 * the extraction pipeline against real-world EN header phrasing that
 * doesn't literally match the curated header list ("Key responsibilities",
 * "Valued skills and experience", "What we offer colleagues", "About
 * Canonical") — this is what drove `matchesAnyHeader` from prefix to
 * substring matching (see jobAnalyzer.ts). Candidate-facing application
 * form fields (resume upload, self-identification survey, etc.) were
 * excluded — only public job-ad copy is included.
 */
export const CANONICAL_RAW_MATERIALS: RawPageMaterials = {
  url: "https://job-boards.greenhouse.io/canonical/jobs/4283003?gh_src=1943652a1",
  documentTitle: "Software Engineering Manager (Backend SaaS) - Canonical",
  canonicalUrl: undefined,
  metaDescription: undefined,
  ogTitle: undefined,
  jsonLdTexts: [],
  elements: [
    { tag: "H1", text: "Software Engineering Manager (Backend SaaS)" },
    { tag: "P", text: "Home Based - Americas" },
    {
      tag: "P",
      text: "Canonical is a leading provider of open source software and operating systems to the global enterprise and technology markets. Our platform, Ubuntu, is very widely used in breakthrough enterprise initiatives such as public cloud, data science, AI, engineering innovation, and IoT.",
    },
    {
      tag: "P",
      text: "We are hiring an engineering manager to lead the reboot of our Landscape systems management solution for Ubuntu.",
    },
    {
      tag: "P",
      text: "We started work on Landscape many years ago, and the current generation of the service reflects the choices of the day. We now have the opportunity to invest significantly in a team to bring a fresh new vision for large-scale Ubuntu estate management to the project.",
    },
    {
      tag: "P",
      text: "Today we use Python, PostgreSQL, RabbitMQ, HAProxy, and have a ReactJS front end. In other web services projects we use more Golang these days.",
    },
    {
      tag: "P",
      text: "Engineering managers at Canonical bring both technical and management skills to the leadership of their teams. You will work closely with product managers, and produce an engineering roadmap with ambitious and achievable goals.",
    },
    {
      tag: "P",
      text: "As an engineering manager at Canonical you must be technically strong, but your responsibility is to run an effective team and develop the colleagues you manage. Technical leadership experience and a background in software engineering are necessary prerequisites for this role.",
    },
    { tag: "H3", text: "Key responsibilities" },
    { tag: "LI", text: "• Build and lead a team of engineers in your region" },
    {
      tag: "LI",
      text: "• Develop talent through coaching, mentoring, feedback, and hands-on career development",
    },
    {
      tag: "LI",
      text: "• Demonstrate sound engineering principles and directly contribute toward your team's goals",
    },
    {
      tag: "LI",
      text: "• Set and manage expectations with other engineering teams, management, and external stakeholders",
    },
    { tag: "LI", text: "• Lead modern, agile software development practices" },
    { tag: "LI", text: "• Ensure a healthy, collaborative engineering culture in line with the company values" },
    { tag: "LI", text: "• Build automated, highly reliable image delivery, testing and publication pipelines" },
    { tag: "LI", text: "• Work from home with global travel 4-6 weeks per year for internal and external events" },
    { tag: "H3", text: "Valued skills and experience" },
    { tag: "LI", text: "• You love to mentor, develop and grow people, and have a track record of doing it" },
    { tag: "LI", text: "• You are knowledgeable and passionate about software development" },
    { tag: "LI", text: "• You are focused on success and the delivery of timely, high quality software" },
    { tag: "LI", text: "• You have experience and commitment to agile development methodologies" },
    { tag: "LI", text: "• Software development experience in Python or Golang" },
    { tag: "LI", text: "• Effective written and verbal communication skills" },
    { tag: "LI", text: "• Practical experience with Linux system administration" },
    { tag: "H3", text: "What we offer colleagues" },
    { tag: "LI", text: "• Distributed work environment with twice-yearly team sprints in person" },
    { tag: "LI", text: "• Personal learning and development budget of USD 2,000 per year" },
    { tag: "LI", text: "• Annual compensation review" },
    { tag: "LI", text: "• Maternity and paternity leave" },
    { tag: "H3", text: "About Canonical" },
    {
      tag: "P",
      text: "Canonical is a pioneering tech firm at the forefront of the global move to open source. As the company that publishes Ubuntu, we are changing the world of software. Most colleagues at Canonical have worked from home since our inception in 2004.",
    },
    { tag: "P", text: "Canonical is an equal opportunity employer." },
  ],
  visibleText: "",
};
