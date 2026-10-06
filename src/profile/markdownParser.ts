import type { DocumentSection } from "./types.js";

const HEADING_RE = /^(#{1,6})\s+(.*)$/;

export interface ParsedMarkdown {
  title?: string;
  sections: DocumentSection[];
}

/**
 * Parses Markdown into a title and a flat list of sections.
 *
 * Section boundaries are level-2 headings ("## ..."). Deeper headings
 * (###+) are preserved as plain content inside their enclosing section,
 * per SDD section 13 ("Heading / Section / Subsection" as natural limits,
 * not fixed-size splitting).
 */
export function parseMarkdown(raw: string): ParsedMarkdown {
  if (raw.trim().length === 0) {
    return { title: undefined, sections: [] };
  }

  const lines = raw.split(/\r?\n/);
  let title: string | undefined;
  let titleFound = false;
  const sections: DocumentSection[] = [];
  const preamble: string[] = [];
  let current: { heading: string; level: number; lines: string[] } | null = null;

  for (const line of lines) {
    const match = HEADING_RE.exec(line);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();

      if (level === 1 && !titleFound) {
        title = text;
        titleFound = true;
        continue;
      }

      if (level === 2) {
        if (current) {
          sections.push(finalizeSection(current));
        }
        current = { heading: text, level, lines: [] };
        continue;
      }
    }

    if (current) {
      current.lines.push(line);
    } else {
      preamble.push(line);
    }
  }

  if (current) {
    sections.push(finalizeSection(current));
  }

  const preambleContent = preamble.join("\n").trim();
  if (preambleContent.length > 0) {
    sections.unshift({
      heading: title ?? "Overview",
      level: 1,
      content: preambleContent,
    });
  }

  return { title, sections };
}

function finalizeSection(section: {
  heading: string;
  level: number;
  lines: string[];
}): DocumentSection {
  return {
    heading: section.heading,
    level: section.level,
    content: section.lines.join("\n").trim(),
  };
}
