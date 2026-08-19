import { describe, expect, it } from "vitest";
import { compile, InvalidStruleError, matches, validate } from "./index.js";

describe("logical semantics", () => {
  it("combines AllOf values with OR and predicates with AND", () => {
    const strule = [
      ["=", "admin"],
      ["^=", "org_", "$=", "_prod", "#>=", 10],
    ];

    expect(matches(strule, "admin")).toBe(true);
    expect(matches(strule, "org_team_prod")).toBe(true);
    expect(matches(strule, "org_prod")).toBe(false);
    expect(matches(strule, "owner")).toBe(false);
  });

  it("reuses numeric parsing and code-point length within an AllOf", () => {
    expect(matches([[">", 0, "<", 10]], "5")).toBe(true);
    expect(matches([["#>", 1, "#<", 4]], "abc")).toBe(true);
  });
});

describe("string operators", () => {
  it.each([
    ["=", "admin", "admin", true],
    ["=", "admin", "Admin", false],
    ["^=", "org_", "org_team", true],
    ["^=", "org_", " org_team", false],
    ["$=", "_prod", "org_prod", true],
    ["*=", "foo", "afoobar", true],
    ["!=", "admin", "owner", true],
    ["!^=", "tmp_", "org_team", true],
    ["!$=", "_prod", "org_dev", true],
    ["!*=", "foo", "bar", true],
  ])("evaluates %s %j against %j", (operator, operand, value, expected) => {
    expect(matches([[operator, operand]], value)).toBe(expected);
  });

  it("does not normalize Unicode", () => {
    expect(matches([["=", "é"]], "e\u0301")).toBe(false);
  });
});

describe("numeric operators", () => {
  it.each([
    [">", 10, "10.5", true],
    [">=", 10, "10", true],
    ["<", 10, "9e0", true],
    ["<=", -1, "-1", true],
    ["!>", 10, "5", true],
    ["!>=", 10, "10", false],
    ["!<", 10, "11", true],
    ["!<=", 10, "10", false],
  ])("evaluates %s %s against %j", (operator, operand, value, expected) => {
    expect(matches([[operator, operand]], value)).toBe(expected);
  });

  it.each(["12.5", "-1", "1e3", "1E+3", "0", "-0", "1.0"])("accepts JSON number %j", (value) => {
    expect(matches([[">=", -1]], value)).toBe(true);
  });

  it.each([
    " 12 ",
    "+1",
    "01",
    "12px",
    "NaN",
    "Infinity",
    ".5",
    "1.",
    "1e309",
    "9007199254740992",
  ])("rejects numeric input outside the Strule numeric domain %j", (value) => {
    expect(matches([[">", 0]], value)).toBe(false);
    expect(matches([["!>", 0]], value)).toBe(false);
  });
});

describe("length operators", () => {
  it.each([
    ["#>", 1, "ab", true],
    ["#>=", 2, "ab", true],
    ["#<", 3, "ab", true],
    ["#<=", 2, "ab", true],
    ["!#>", 2, "ab", true],
    ["!#>=", 2, "ab", false],
    ["!#<", 2, "ab", true],
    ["!#<=", 2, "ab", false],
  ])("evaluates %s %s against %j", (operator, operand, value, expected) => {
    expect(matches([[operator, operand]], value)).toBe(expected);
  });

  it("counts Unicode code points instead of UTF-16 code units", () => {
    expect(matches([["#<=", 1]], "😀")).toBe(true);
    expect(matches([["#>", 1]], "e\u0301")).toBe(true);
  });
});

describe("execution errors and input domain", () => {
  it("throws the validation issues for an invalid Strule value", () => {
    const strule = [[">", "10"]];
    const validation = validate(strule);

    expect(() => compile(strule)).toThrow(InvalidStruleError);
    expect(() => matches(strule, "11")).toThrow(InvalidStruleError);

    try {
      compile(strule);
    } catch (error) {
      expect(error).toBeInstanceOf(TypeError);
      expect(error).toBeInstanceOf(InvalidStruleError);
      expect((error as InvalidStruleError).issues).toEqual(validation.ok ? [] : validation.issues);
    }
  });

  it("throws TypeError for non-string input", () => {
    const matcher = compile([["=", "1"]]);
    expect(() => matcher(1 as unknown as string)).toThrow(TypeError);
    expect(() => matches([["=", "1"]], 1 as unknown as string)).toThrow(TypeError);
  });

  it.each([
    "\ud800",
    "\udc00",
    "\ufdd0",
    "\u{10ffff}",
  ])("treats invalid Unicode input as outside every predicate domain %j", (value) => {
    expect(matches([["=", "valid"]], value)).toBe(false);
    expect(matches([["!=", "valid"]], value)).toBe(false);
  });

  it("captures a snapshot of the configuration", () => {
    const strule: unknown[][] = [["=", "admin"]];
    const matcher = compile(strule);

    strule[0][1] = "owner";

    expect(matcher("admin")).toBe(true);
    expect(matcher("owner")).toBe(false);
  });
});
