import { describe, expect, it } from "vitest";
import { isValid, validate, validatePredicate } from "./index.js";

function expectIssue(result: ReturnType<typeof validatePredicate>, code: string, path: readonly number[]): void {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.issues[0]).toMatchObject({ code, path });
  }
}

describe("validatePredicate", () => {
  it("returns a typed predicate on success", () => {
    expect(validatePredicate("!^=", "tmp_")).toEqual({ ok: true, value: ["!^=", "tmp_"] });
    expect(validatePredicate(">=", 1.5)).toEqual({ ok: true, value: [">=", 1.5] });
    expect(validatePredicate("#<=", -0)).toEqual({ ok: true, value: ["#<=", -0] });
  });

  it("locates invalid operators and operands", () => {
    expectIssue(validatePredicate("??", 1), "invalid_operator", [0]);
    expectIssue(validatePredicate(">", "1"), "invalid_type", [1]);
    expectIssue(validatePredicate("=", 1), "invalid_type", [1]);
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])("rejects non-finite numeric operand %s", (operand) => {
    expectIssue(validatePredicate(">", operand), "non_finite_number", [1]);
  });

  it("enforces the I-JSON integer range for numeric operands", () => {
    expect(validatePredicate(">", Number.MAX_SAFE_INTEGER)).toMatchObject({ ok: true });
    expect(validatePredicate(">", 1.25)).toMatchObject({ ok: true });
    expectIssue(validatePredicate(">", Number.MAX_SAFE_INTEGER + 1), "unsafe_integer", [1]);
    expectIssue(validatePredicate("<", Number.MIN_SAFE_INTEGER - 1), "unsafe_integer", [1]);
  });

  it("requires length operands to be non-negative safe integers", () => {
    expectIssue(validatePredicate("#>", "1"), "invalid_type", [1]);
    expectIssue(validatePredicate("#>", 1.5), "non_integer", [1]);
    expectIssue(validatePredicate("#>", Number.MAX_SAFE_INTEGER + 1), "unsafe_integer", [1]);
    expectIssue(validatePredicate("#>", -1), "negative_integer", [1]);
  });

  it.each([
    "\ud800",
    "\udc00",
    "\ufdd0",
    "\ufffe",
    "\u{1fffe}",
    "\u{10ffff}",
  ])("rejects invalid Unicode string operand %j", (operand) => {
    expectIssue(validatePredicate("=", operand), "invalid_unicode", [1]);
  });

  it("accepts valid supplementary Unicode characters", () => {
    expect(validatePredicate("=", "😀")).toEqual({ ok: true, value: ["=", "😀"] });
  });
});

describe("validate", () => {
  it("returns the original valid AnyOf", () => {
    const strule = [
      ["=", "admin"],
      ["^=", "org_", "#<=", 100],
    ];
    const result = validate(strule);

    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.value).toBe(strule);
    }
    expect(isValid(strule)).toBe(true);
  });

  it.each([null, undefined, "rule", 1, {}, true])("rejects a non-array AnyOf %j", (strule) => {
    const result = validate(strule);
    expect(result).toMatchObject({ ok: false, issues: [{ code: "invalid_type", path: [] }] });
    expect(isValid(strule)).toBe(false);
  });

  it("rejects an empty AnyOf", () => {
    expect(validate([])).toMatchObject({ ok: false, issues: [{ code: "empty", path: [] }] });
  });

  it("collects independent structural and predicate issues", () => {
    const result = validate([[], ["??", [], "#>"], ["??"], "not-an-all-of"]);
    expect(result).toMatchObject({
      ok: false,
      issues: [
        { code: "empty", path: [0] },
        { code: "invalid_operator", path: [1, 0] },
        { code: "missing_operand", path: [1, 3] },
        { code: "invalid_operator", path: [2, 0] },
        { code: "missing_operand", path: [2, 1] },
        { code: "invalid_type", path: [3] },
      ],
    });
  });

  it("locates operand errors within an AnyOf", () => {
    const result = validate([
      ["=", []],
      [">", "10"],
      ["#<=", -1],
    ]);
    expect(result).toMatchObject({
      ok: false,
      issues: [
        { code: "invalid_type", path: [0, 1] },
        { code: "invalid_type", path: [1, 1] },
        { code: "negative_integer", path: [2, 1] },
      ],
    });
  });

  it("does not report an operand constraint when the operator is unknown", () => {
    const result = validate([["??", []]]);
    expect(result).toMatchObject({ ok: false, issues: [{ code: "invalid_operator", path: [0, 0] }] });
    if (!result.ok) {
      expect(result.issues).toHaveLength(1);
    }
  });
});
