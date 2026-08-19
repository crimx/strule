import { type BaseOperator, baseOperators, type OperandKind, type Operator } from "./types.js";

const operandKinds: Readonly<Record<BaseOperator, OperandKind>> = Object.freeze({
  "=": "string",
  "^=": "string",
  "$=": "string",
  "*=": "string",
  ">": "number",
  ">=": "number",
  "<": "number",
  "<=": "number",
  "#>": "length",
  "#>=": "length",
  "#<": "length",
  "#<=": "length",
});

const baseOperatorSet: ReadonlySet<string> = new Set(baseOperators);

export interface ParsedOperator {
  readonly baseOperator: BaseOperator;
  readonly negated: boolean;
}

export function parseOperator(operator: unknown): ParsedOperator | undefined {
  if (typeof operator !== "string") {
    return undefined;
  }

  const negated = operator.startsWith("!");
  const baseOperator = negated ? operator.slice(1) : operator;

  if (!baseOperatorSet.has(baseOperator)) {
    return undefined;
  }

  return { baseOperator: baseOperator as BaseOperator, negated };
}

/**
 * Returns the operand kind required by an operator.
 *
 * Negation does not change the operand kind. Invalid operators return
 * `undefined`.
 */
export function getOperandKind(operator: Operator): OperandKind;
export function getOperandKind(operator: unknown): OperandKind | undefined;
export function getOperandKind(operator: unknown): OperandKind | undefined {
  const parsed = parseOperator(operator);
  return parsed ? operandKinds[parsed.baseOperator] : undefined;
}
