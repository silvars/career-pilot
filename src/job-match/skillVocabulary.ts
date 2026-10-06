/** Known technical skill vocabulary (SDD section 15.2), used to split bullet lines into discrete skills. */
export const SKILL_VOCABULARY: string[] = [
  "Spring Boot",
  "Distributed Systems",
  "Node.js",
  "Spring",
  "Java",
  "AWS",
  "GCP",
  "Kubernetes",
  "Kafka",
  "React",
  "Python",
  "APIs",
  "Microservices",
  "Docker",
  "Terraform",
  "TypeScript",
  "SQL",
  "MongoDB",
  "Redis",
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Returns every vocabulary term found in `line`, longest matches first, without overlapping substrings. */
export function extractSkills(line: string): string[] {
  const sorted = [...SKILL_VOCABULARY].sort((a, b) => b.length - a.length);
  const matches: string[] = [];
  const consumed: Array<[number, number]> = [];

  for (const term of sorted) {
    const regex = new RegExp(`(?<![a-zA-Z0-9])${escapeRegExp(term)}(?![a-zA-Z0-9])`, "gi");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(line)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const overlaps = consumed.some(([s, e]) => start < e && end > s);
      if (!overlaps) {
        consumed.push([start, end]);
        matches.push(term);
      }
    }
  }

  return Array.from(new Set(matches));
}
