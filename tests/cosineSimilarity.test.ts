import { describe, expect, it } from "vitest";
import { cosineSimilarity } from "../src/profile/cosineSimilarity.js";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const a = Float32Array.from([1, 2, 3]);
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 10);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = Float32Array.from([1, 0]);
    const b = Float32Array.from([0, 1]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 10);
  });

  it("returns -1 for opposite vectors", () => {
    const a = Float32Array.from([1, 2, 3]);
    const b = Float32Array.from([-1, -2, -3]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 10);
  });

  it("fails safely (returns 0, never NaN/throws) for a zero vector", () => {
    const zero = Float32Array.from([0, 0, 0]);
    const other = Float32Array.from([1, 2, 3]);
    expect(cosineSimilarity(zero, other)).toBe(0);
    expect(cosineSimilarity(zero, zero)).toBe(0);
  });

  it("fails safely (returns 0, never throws) for mismatched dimensions", () => {
    const a = Float32Array.from([1, 2, 3]);
    const b = Float32Array.from([1, 2]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("fails safely (returns 0) for empty vectors", () => {
    const empty = Float32Array.from([]);
    const other = Float32Array.from([1, 2, 3]);
    expect(cosineSimilarity(empty, other)).toBe(0);
    expect(cosineSimilarity(empty, empty)).toBe(0);
  });

  it("is symmetric", () => {
    const a = Float32Array.from([1, 2, 3]);
    const b = Float32Array.from([4, -5, 6]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });
});
