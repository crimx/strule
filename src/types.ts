/** The base operators defined by the Strule specification. */
export const baseOperators = Object.freeze([
  "=",
  "^=",
  "$=",
  "*=",
  ">",
  ">=",
  "<",
  "<=",
  "#>",
  "#>=",
  "#<",
  "#<=",
] as const);

/** A Strule operator without negation. */
export type BaseOperator = (typeof baseOperators)[number];

/** A base operator, optionally prefixed with `!` to negate its predicate. */
export type Operator = BaseOperator | `!${BaseOperator}`;

/** The kind of operand required by an operator. */
export type OperandKind = "string" | "number" | "length";

/** A value that can occupy an operand position in a valid Strule value. */
export type Operand = string | number;

/** An adjacent operator and operand pair within an {@link AllOf}. */
export type Predicate =
  | readonly [operator: "=" | "!=" | "^=" | "!^=" | "$=" | "!$=" | "*=" | "!*=", operand: string]
  | readonly [operator: ">" | "!>" | ">=" | "!>=" | "<" | "!<" | "<=" | "!<=", operand: number]
  | readonly [operator: "#>" | "!#>" | "#>=" | "!#>=" | "#<" | "!#<" | "#<=" | "!#<=", operand: number];

/**
 * A non-empty, flat sequence of predicates combined with AND.
 *
 * TypeScript cannot fully express the alternating operator and operand layout,
 * so use {@link validate} for values received at runtime.
 */
export type AllOf = readonly [operator: Operator, operand: Operand, ...rest: (Operator | Operand)[]];

/** A non-empty sequence of {@link AllOf} values combined with OR. */
export type AnyOf = readonly [allOf: AllOf, ...alternatives: AllOf[]];

/** A stable, programmatic category for a validation issue. */
export type ValidationIssueCode =
  | "invalid_type"
  | "empty"
  | "missing_operand"
  | "invalid_operator"
  | "non_finite_number"
  | "non_integer"
  | "unsafe_integer"
  | "negative_integer"
  | "invalid_unicode";

/** A problem found while validating a Strule value or predicate. */
export interface ValidationIssue {
  readonly code: ValidationIssueCode;
  readonly path: readonly number[];
  readonly expected: string;
  readonly received: unknown;
  readonly message: string;
}

/** The result of a non-throwing validation operation. */
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

/** A reusable matcher produced by {@link compile}. */
export type Matcher = (value: string) => boolean;
