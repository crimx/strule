import { type ParsedOperator, parseOperator } from "./operators.js";
import type { AnyOf, BaseOperator, Matcher, Operand, ValidationIssue } from "./types.js";
import { countCodePoints, isValidUnicodeString } from "./unicode.js";
import { validate } from "./validation.js";

const jsonNumberPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

interface CompiledPredicate {
  readonly baseOperator: BaseOperator;
  readonly negated: boolean;
  readonly operand: Operand;
}

interface EvaluationContext {
  readonly value: string;
  numericParsed: boolean;
  numericValue: number | undefined;
  length: number | undefined;
}

/** Thrown when an execution API receives an invalid Strule value. */
export class InvalidStruleError extends TypeError {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    super("Invalid Strule value.");
    this.name = "InvalidStruleError";
    this.issues = issues;
  }
}

function parseNumericInput(value: string): number | undefined {
  if (!jsonNumberPattern.test(value)) {
    return undefined;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return undefined;
  }
  if (Number.isInteger(numericValue) && !Number.isSafeInteger(numericValue)) {
    return undefined;
  }

  return numericValue;
}

function numericValue(context: EvaluationContext): number | undefined {
  if (!context.numericParsed) {
    context.numericValue = parseNumericInput(context.value);
    context.numericParsed = true;
  }
  return context.numericValue;
}

function codePointLength(context: EvaluationContext): number {
  if (context.length === undefined) {
    context.length = countCodePoints(context.value);
  }
  return context.length;
}

function compare(baseOperator: BaseOperator, left: string | number, right: Operand): boolean {
  switch (baseOperator) {
    case "=":
      return left === right;
    case "^=":
      return (left as string).startsWith(right as string);
    case "$=":
      return (left as string).endsWith(right as string);
    case "*=":
      return (left as string).includes(right as string);
    case ">":
    case "#>":
      return (left as number) > (right as number);
    case ">=":
    case "#>=":
      return (left as number) >= (right as number);
    case "<":
    case "#<":
      return (left as number) < (right as number);
    case "<=":
    case "#<=":
      return (left as number) <= (right as number);
  }
}

function evaluatePredicate(predicate: CompiledPredicate, context: EvaluationContext): boolean {
  let left: string | number;

  if (predicate.baseOperator.startsWith("#")) {
    left = codePointLength(context);
  } else if (
    predicate.baseOperator === ">" ||
    predicate.baseOperator === ">=" ||
    predicate.baseOperator === "<" ||
    predicate.baseOperator === "<="
  ) {
    const numeric = numericValue(context);
    if (numeric === undefined) {
      return false;
    }
    left = numeric;
  } else {
    left = context.value;
  }

  const result = compare(predicate.baseOperator, left, predicate.operand);
  return predicate.negated ? !result : result;
}

function compileValid(strule: AnyOf): Matcher {
  const compiled = strule.map((allOf) => {
    const predicates: CompiledPredicate[] = [];
    for (let index = 0; index < allOf.length; index += 2) {
      const parsedOperator = parseOperator(allOf[index]) as ParsedOperator;
      predicates.push({
        baseOperator: parsedOperator.baseOperator,
        negated: parsedOperator.negated,
        operand: allOf[index + 1] as Operand,
      });
    }
    return predicates;
  });

  return (value: string): boolean => {
    if (typeof value !== "string") {
      throw new TypeError("Strule input must be a string.");
    }
    if (!isValidUnicodeString(value)) {
      return false;
    }

    const context: EvaluationContext = {
      value,
      numericParsed: false,
      numericValue: undefined,
      length: undefined,
    };

    return compiled.some((allOf) => allOf.every((predicate) => evaluatePredicate(predicate, context)));
  };
}

/**
 * Validates and compiles a Strule value into a reusable matcher.
 *
 * @throws {@link InvalidStruleError} if `strule` is invalid.
 */
export function compile(strule: unknown): Matcher {
  const result = validate(strule);
  if (!result.ok) {
    throw new InvalidStruleError(result.issues);
  }
  return compileValid(result.value);
}

/**
 * Returns whether a string matches a Strule value.
 *
 * @throws {@link InvalidStruleError} if `strule` is invalid.
 */
export function matches(strule: unknown, value: string): boolean {
  return compile(strule)(value);
}
