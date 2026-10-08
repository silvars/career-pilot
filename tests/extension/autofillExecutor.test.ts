import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AutofillPlan } from "../../src/autofill/types/autofillAction.js";

/**
 * FASE 6.4 (Validation + Chrome Real): automated coverage for the
 * expectedValue/actualValue contract the FASE 6.2 executor already
 * implements (section 8 of the FASE 6.4 SDD) — this file does NOT
 * reimplement or duplicate that execution logic (section 1), it exercises
 * the real `executeAutofillPlan` against minimal hand-rolled DOM doubles
 * (no jsdom, same "no new DOM dependency" convention as the rest of this
 * project). `HTMLInputElement`/`HTMLTextAreaElement`/`HTMLSelectElement`/
 * `Event` don't exist in the Node test environment, so tiny stand-ins are
 * installed as globals before importing the executor — `instanceof` checks
 * inside it only run when an action is executed (inside each test), not at
 * module load time, so this ordering is safe.
 */

class FakeEvent {
  type: string;
  bubbles?: boolean;
  constructor(type: string, init?: { bubbles?: boolean }) {
    this.type = type;
    this.bubbles = init?.bubbles;
  }
}

class FakeInputElement {
  type: string;
  name?: string;
  id?: string;
  dispatched: string[] = [];
  /** Simulates a hostile/buggy ATS that silently rejects a programmatic value write (SDD section 8.2 — mismatch). The executor always reads/writes through `HTMLInputElement.prototype`'s shared accessor (by design, to bypass React-style instance shadowing), so this quirk has to live on the shared setter itself, not on a subclass. */
  rejectWrites = false;
  protected _value: string;
  protected _checked: boolean;
  constructor(opts: { type?: string; name?: string; id?: string; value?: string; checked?: boolean } = {}) {
    this.type = opts.type ?? "text";
    this.name = opts.name;
    this.id = opts.id;
    this._value = opts.value ?? "";
    this._checked = opts.checked ?? false;
  }
  get value(): string {
    return this._value;
  }
  set value(v: string) {
    if (this.rejectWrites) {
      return;
    }
    this._value = v;
  }
  get checked(): boolean {
    return this._checked;
  }
  set checked(c: boolean) {
    this._checked = c;
  }
  getAttribute(): string | null {
    return null;
  }
  dispatchEvent(event: { type: string }): boolean {
    this.dispatched.push(event.type);
    return true;
  }
}

class FakeTextAreaElement extends FakeInputElement {}

class FakeOption {
  constructor(
    public value: string,
    public textContent: string
  ) {}
}

class FakeSelectElement {
  name?: string;
  id?: string;
  dispatched: string[] = [];
  options: FakeOption[];
  selectedIndex = -1;
  private _value = "";
  constructor(options: Array<{ value: string; label: string }>, opts: { name?: string; id?: string } = {}) {
    this.options = options.map((o) => new FakeOption(o.value, o.label));
    this.name = opts.name;
    this.id = opts.id;
  }
  get value(): string {
    return this._value;
  }
  set value(v: string) {
    this._value = v;
    this.selectedIndex = this.options.findIndex((o) => o.value === v);
  }
  getAttribute(): string | null {
    return null;
  }
  dispatchEvent(event: { type: string }): boolean {
    this.dispatched.push(event.type);
    return true;
  }
}

const cache = new Map<string, unknown[]>();

vi.mock("../../src/extension/content/formExtractor.js", () => ({
  getCachedElements: (fieldId: string) => cache.get(fieldId),
}));

let executeAutofillPlan: (plan: AutofillPlan) => Promise<import("../../src/autofill/types/autofillResult.js").AutofillResult>;

beforeEach(async () => {
  cache.clear();
  (globalThis as unknown as { HTMLInputElement: unknown }).HTMLInputElement = FakeInputElement;
  (globalThis as unknown as { HTMLTextAreaElement: unknown }).HTMLTextAreaElement = FakeTextAreaElement;
  (globalThis as unknown as { HTMLSelectElement: unknown }).HTMLSelectElement = FakeSelectElement;
  (globalThis as unknown as { Event: unknown }).Event = FakeEvent;

  vi.resetModules();
  ({ executeAutofillPlan } = await import("../../src/extension/content/autofillExecutor.js"));
});

afterEach(() => {
  delete (globalThis as unknown as { HTMLInputElement?: unknown }).HTMLInputElement;
  delete (globalThis as unknown as { HTMLTextAreaElement?: unknown }).HTMLTextAreaElement;
  delete (globalThis as unknown as { HTMLSelectElement?: unknown }).HTMLSelectElement;
  delete (globalThis as unknown as { Event?: unknown }).Event;
});

function action(overrides: Partial<import("../../src/autofill/types/autofillAction.js").AutofillAction>) {
  return {
    fieldId: "field",
    action: "SET_VALUE" as const,
    confidence: 0.9,
    requiresReview: false,
    ...overrides,
  };
}

describe("executeAutofillPlan — FASE 6.4 validation contract", () => {
  it("8.1 — expectedValue == actualValue produces success:true with both values recorded", async () => {
    const input = new FakeInputElement({ id: "fullName" });
    cache.set("fullName", [input]);

    const result = await executeAutofillPlan({
      actions: [action({ fieldId: "fullName", action: "SET_VALUE", value: "Rodrigo Matos" })],
      summary: { total: 1, fillable: 1, requiresReview: 0, skipped: 0 },
    });

    expect(result.fields).toEqual([
      { fieldId: "fullName", success: true, expectedValue: "Rodrigo Matos", actualValue: "Rodrigo Matos" },
    ]);
    expect(input.dispatched).toEqual(["input", "change"]);
  });

  it("8.2 — expectedValue != actualValue (ATS silently rejects the write) produces success:false with an error", async () => {
    const stubborn = new FakeInputElement({ id: "salary", value: "" });
    stubborn.rejectWrites = true;
    cache.set("salary", [stubborn]);

    const result = await executeAutofillPlan({
      actions: [action({ fieldId: "salary", action: "SET_VALUE", value: "USD 180k" })],
      summary: { total: 1, fillable: 1, requiresReview: 0, skipped: 0 },
    });

    expect(result.fields).toEqual([
      {
        fieldId: "salary",
        success: false,
        expectedValue: "USD 180k",
        actualValue: "",
        error: "value mismatch after fill",
      },
    ]);
  });

  it("8.3 — a failure on one field does not interrupt validation of the others", async () => {
    cache.set("fieldA", [new FakeInputElement({ id: "fieldA" })]);
    // fieldB: intentionally not cached -> "element not found".
    cache.set("fieldC", [new FakeInputElement({ id: "fieldC" })]);

    const result = await executeAutofillPlan({
      actions: [
        action({ fieldId: "fieldA", value: "A" }),
        action({ fieldId: "fieldB", value: "B" }),
        action({ fieldId: "fieldC", value: "C" }),
      ],
      summary: { total: 3, fillable: 3, requiresReview: 0, skipped: 0 },
    });

    expect(result.fields.map((f) => [f.fieldId, f.success])).toEqual([
      ["fieldA", true],
      ["fieldB", false],
      ["fieldC", true],
    ]);
    expect(result.fields[1].error).toBe("element not found in the DOM (page may have changed since analysis)");
  });

  it("8.4 — validates a single execution spanning text, select, checkbox and radio together", async () => {
    cache.set("fullName", [new FakeInputElement({ id: "fullName" })]);
    cache.set("seniority", [
      new FakeSelectElement([
        { value: "junior", label: "Junior" },
        { value: "senior", label: "Senior" },
      ]),
    ]);
    cache.set("agree", [new FakeInputElement({ id: "agree", type: "checkbox" })]);
    cache.set("workModel", [
      new FakeInputElement({ id: "wm1", type: "radio", value: "remote" }),
      new FakeInputElement({ id: "wm2", type: "radio", value: "onsite" }),
    ]);

    const result = await executeAutofillPlan({
      actions: [
        action({ fieldId: "fullName", action: "SET_VALUE", value: "Rodrigo Matos" }),
        action({ fieldId: "seniority", action: "SELECT_OPTION", value: "senior", optionLabel: "Senior" }),
        action({ fieldId: "agree", action: "CHECK" }),
        action({ fieldId: "workModel", action: "SELECT_OPTION", value: "onsite", optionLabel: "On-site" }),
      ],
      summary: { total: 4, fillable: 4, requiresReview: 0, skipped: 0 },
    });

    expect(result.fields.every((f) => f.success)).toBe(true);
    expect(result.fields.map((f) => f.fieldId)).toEqual(["fullName", "seniority", "agree", "workModel"]);
  });

  it("8.5 — summary counts (attempted/filled/failed/skipped) are accurate, SKIP actions are never attempted", async () => {
    cache.set("fullName", [new FakeInputElement({ id: "fullName" })]);
    // "salary" intentionally uncached -> failure.

    const result = await executeAutofillPlan({
      actions: [
        action({ fieldId: "fullName", value: "Rodrigo Matos" }),
        action({ fieldId: "salary", value: "USD 180k" }),
        action({ fieldId: "gender", action: "SKIP", reason: "blocked semantic type: PROTECTED_OR_LEGAL" }),
      ],
      summary: { total: 3, fillable: 2, requiresReview: 0, skipped: 1 },
    });

    expect(result.summary).toEqual({ attempted: 2, filled: 1, failed: 1, skipped: 1 });
    expect(result.success).toBe(false);
  });

  it("8.6 — the executor's actual code (comments/docstrings excluded) never references form submission or candidature-button clicks", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const source = await fs.readFile(
      path.join(process.cwd(), "src/extension/content/autofillExecutor.ts"),
      "utf-8"
    );
    // Several docstrings legitimately *describe* these forbidden APIs in prose
    // (to document that they're never called) — strip comments first so the
    // scan only looks at real code.
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    expect(codeOnly).not.toMatch(/\.submit\s*\(/);
    expect(codeOnly).not.toMatch(/requestSubmit/);
    expect(codeOnly).not.toMatch(/\.click\s*\(/);
  });
});
