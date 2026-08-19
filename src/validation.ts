import { getOperandKind, type ParsedOperator, parseOperator } from "./operators.js";
import type { AnyOf, Predicate, Result, ValidationIssue, ValidationIssueCode } from "./types.js";
import { isValidUnicodeString } from "./unicode.js";

function issue(
  code: ValidationIssueCode,
  path: readonly number[],
  expected: string,
  received: unknown,
  message: string,
): ValidationIssue {
  return { code, path, expected, received, message };
}

function invalidType(path: readonly number[], expected: string, received: unknown): ValidationIssue {
  return issue(
    "invalid_type",
    path,
    expected,
    received,
    `Expected ${expected}, received ${received === null ? "null" : typeof received}.`,
  );
}

function validateOperand(
  parsedOperator: ParsedOperator,
  operand: unknown,
  path: readonly number[],
): ValidationIssue | undefined {
  const operandKind = getOperandKind(parsedOperator.baseOperator);

  if (operandKind === "string") {
    if (typeof operand !== "string") {
      return invalidType(path, "a string operand", operand);
    }
    if (!isValidUnicodeString(operand)) {
      return issue(
        "invalid_unicode",
        path,
        "a Unicode scalar string without noncharacters",
        operand,
        "String operands must contain only Unicode scalar values and must not contain noncharacters.",
      );
    }
    return undefined;
  }

  if (typeof operand !== "number") {
    return invalidType(path, operandKind === "length" ? "a non-negative safe integer" : "a number operand", operand);
  }

  if (!Number.isFinite(operand)) {
    return issue("non_finite_number", path, "a finite number", operand, "Number operands must be finite.");
  }

  if (operandKind === "number") {
    if (Number.isInteger(operand) && !Number.isSafeInteger(operand)) {
      return issue(
        "unsafe_integer",
        path,
        "a safe integer",
        operand,
        "Integer operands must be within the safe integer range.",
      );
    }
    return undefined;
  }

  if (!Number.isInteger(operand)) {
    return issue("non_integer", path, "an integer", operand, "Length operands must be integers.");
  }
  if (!Number.isSafeInteger(operand)) {
    return issue(
      "unsafe_integer",
      path,
      "a safe integer",
      operand,
      "Length operands must be within the safe integer range.",
    );
  }
  if (operand < 0) {
    return issue("negative_integer", path, "a non-negative integer", operand, "Length operands must be non-negative.");
  }

  return undefined;
}

/** Validates one adjacent operator and operand pair without throwing. */
export function validatePredicate(operator: unknown, operand: unknown): Result<Predicate> {
  const parsedOperator = parseOperator(operator);
  if (!parsedOperator) {
    return {
      ok: false,
      issues: [issue("invalid_operator", [0], "a Strule operator", operator, "Expected a valid Strule operator.")],
    };
  }

  const operandIssue = validateOperand(parsedOperator, operand, [1]);
  if (operandIssue) {
    return { ok: false, issues: [operandIssue] };
  }

  return { ok: true, value: [operator, operand] as Predicate };
}

/** Validates an unknown value as a complete Strule AnyOf without throwing. */
export function validate(strule: unknown): Result<AnyOf> {
  if (!Array.isArray(strule)) {
    return { ok: false, issues: [invalidType([], "an AnyOf array", strule)] };
  }

  if (strule.length === 0) {
    return {
      ok: false,
      issues: [issue("empty", [], "a non-empty AnyOf", strule, "An AnyOf must contain at least one AllOf.")],
    };
  }

  const issues: ValidationIssue[] = [];

  for (let allOfIndex = 0; allOfIndex < strule.length; allOfIndex += 1) {
    const allOf = strule[allOfIndex];
    if (!Array.isArray(allOf)) {
      issues.push(invalidType([allOfIndex], "an AllOf array", allOf));
      continue;
    }

    if (allOf.length === 0) {
      issues.push(
        issue("empty", [allOfIndex], "a non-empty AllOf", allOf, "An AllOf must contain at least one Predicate."),
      );
      continue;
    }

    for (let operatorIndex = 0; operatorIndex < allOf.length; operatorIndex += 2) {
      const operator = allOf[operatorIndex];
      const operatorPath = [allOfIndex, operatorIndex];
      const parsedOperator = parseOperator(operator);

      if (!parsedOperator) {
        issues.push(
          issue("invalid_operator", operatorPath, "a Strule operator", operator, "Expected a valid Strule operator."),
        );
      }

      const operandIndex = operatorIndex + 1;
      if (operandIndex >= allOf.length) {
        const expectedKind = parsedOperator ? getOperandKind(parsedOperator.baseOperator) : undefined;
        issues.push(
          issue(
            "missing_operand",
            [allOfIndex, operandIndex],
            expectedKind ? `a ${expectedKind} operand` : "an operand",
            undefined,
            "Every operator must be followed by an operand.",
          ),
        );
        continue;
      }

      if (parsedOperator) {
        const operandIssue = validateOperand(parsedOperator, allOf[operandIndex], [allOfIndex, operandIndex]);
        if (operandIssue) {
          issues.push(operandIssue);
        }
      }
    }
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: strule as unknown as AnyOf };
}

/** Returns whether an unknown value is a valid Strule AnyOf. */
export function isValid(strule: unknown): strule is AnyOf {
  return validate(strule).ok;
}
