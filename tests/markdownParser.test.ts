import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../src/profile/markdownParser.js";

describe("parseMarkdown", () => {
  it("extracts the title and sections from the SDD section 10 example", () => {
    const raw = [
      "# Java",
      "",
      "## Experience",
      "",
      "More than 20 years working with Java.",
      "",
      "## Context",
      "",
      "Backend, architecture and distributed systems.",
      "",
    ].join("\n");

    const result = parseMarkdown(raw);

    expect(result.title).toBe("Java");
    expect(result.sections).toEqual([
      { heading: "Experience", level: 2, content: "More than 20 years working with Java." },
      { heading: "Context", level: 2, content: "Backend, architecture and distributed systems." },
    ]);
  });

  it("keeps a heading's subsections (###) as part of its own section content", () => {
    const raw = [
      "# Company",
      "",
      "## Role",
      "",
      "Intro paragraph.",
      "",
      "### Responsibilities",
      "",
      "- a",
      "- b",
      "",
      "## Impact",
      "",
      "Measurable outcomes.",
    ].join("\n");

    const result = parseMarkdown(raw);

    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].heading).toBe("Role");
    expect(result.sections[0].content).toContain("Intro paragraph.");
    expect(result.sections[0].content).toContain("### Responsibilities");
    expect(result.sections[0].content).toContain("- a");
    expect(result.sections[1]).toEqual({
      heading: "Impact",
      level: 2,
      content: "Measurable outcomes.",
    });
  });

  it("captures content before the first heading as an implicit section", () => {
    const raw = [
      "# Cloud & Platform Skills",
      "",
      "- AWS",
      "- GCP",
    ].join("\n");

    const result = parseMarkdown(raw);

    expect(result.title).toBe("Cloud & Platform Skills");
    expect(result.sections).toEqual([
      { heading: "Cloud & Platform Skills", level: 1, content: "- AWS\n- GCP" },
    ]);
  });

  it("returns no title and no sections for empty content", () => {
    const result = parseMarkdown("");

    expect(result.title).toBeUndefined();
    expect(result.sections).toEqual([]);
  });

  it("returns no title and no sections for whitespace-only content", () => {
    const result = parseMarkdown("   \n\n  \n");

    expect(result.title).toBeUndefined();
    expect(result.sections).toEqual([]);
  });
});
