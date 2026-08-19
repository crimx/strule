import { describe, expect, it } from "vitest";
import { baseOperators, getOperandKind } from "./index.js";

describe("operator metadata", () => {
  it("lists every base operator in UI order", () => {
    expect(baseOperators).toEqual(["=", "^=", "$=", "*=", ">", ">=", "<", "<=", "#>", "#>=", "#<", "#<="]);
    expect(Object.isFrozen(baseOperators)).toBe(true);
  });

  it.each([
    ["=", "string"],
    ["!^=", "string"],
    [">", "number"],
    ["!<=", "number"],
    ["#>", "length"],
    ["!#<=", "length"],
  ] as const)("returns the operand kind for %s", (operator, kind) => {
    expect(getOperandKind(operator)).toBe(kind);
  });

  it.each(["", "!", "!!=", "??", 1, null, undefined])("returns undefined for invalid operator %j", (operator) => {
    expect(getOperandKind(operator)).toBeUndefined();
  });
});
