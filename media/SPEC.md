# Strule Specification

## 1. Scope

Strule is a JSON format for describing string validation rules.

Strule validates string values only. It does not describe object structures and does not support regular expressions, functions, or executable code.

Unless otherwise specified, JSON terminology and syntax conform to [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259.html).

## 2. Data Model

```text
Strule    := AnyOf
AnyOf     := non-empty array<AllOf>
AllOf     := Predicate+
Predicate := Operator Operand

Operator     := BaseOperator | "!" BaseOperator
BaseOperator := "=" | ">" | ">=" | "<" | "<=" | "^=" | "$=" | "*=" | "#>" | "#>=" | "#<" | "#<="
```

A Strule value MUST be an AnyOf.

An AnyOf MUST be a non-empty JSON array. Each element of the array MUST be an AllOf.

An AllOf MUST be a non-empty JSON array containing one or more adjacent Predicates. Each Predicate is serialized as an Operator immediately followed by its Operand; a Predicate is not represented as a nested JSON array. Using zero-based indexing, each even-indexed element of an AllOf is an Operator and the following odd-indexed element is its Operand. The order of Predicates within an AllOf has no semantic significance.

Example:

```json
[
  ["=", "admin"],
  ["^=", "org_", "$=", "_prod", "#<=", 100]
]
```

## 3. Logical Semantics

AllOf values within an AnyOf are combined with OR. Predicates within an AllOf are combined with AND.

An input value matches a Strule value if and only if every Predicate in at least one AllOf matches the input value.

```json
[
  ["=", "admin"],
  ["=", "owner"],
  ["^=", "org_", "$=", "_prod", "#>=", 10, "#<=", 100]
]
```

The rule above means:

```text
value = "admin"
OR
value = "owner"
OR
(
  value starts with "org_"
  AND value ends with "_prod"
  AND length(value) >= 10
  AND length(value) <= 100
)
```

A Strule expression is in disjunctive normal form (DNF) and can represent `(A AND B) OR (C AND D)`. An expression such as `(A OR B) AND C` MUST be expanded to `(A AND C) OR (B AND C)`.

## 4. Operators

| Operator | Meaning | Operand |
| --- | --- | --- |
| `=` | Equal to | String |
| `^=` | Starts with | String |
| `$=` | Ends with | String |
| `*=` | Contains | String |
| `>` | Numerically greater than | Finite JSON number |
| `>=` | Numerically greater than or equal to | Finite JSON number |
| `<` | Numerically less than | Finite JSON number |
| `<=` | Numerically less than or equal to | Finite JSON number |
| `#>` | Length greater than | Safe non-negative integer |
| `#>=` | Length greater than or equal to | Safe non-negative integer |
| `#<` | Length less than | Safe non-negative integer |
| `#<=` | Length less than or equal to | Safe non-negative integer |

Length operators count Unicode code points.

### 4.1. Numeric Comparisons

Strule uses the IEEE 754 binary64 numeric model. A numeric Operand MUST be representable as a finite binary64 value. An integer value MUST be within the safe integer range from `-(2^53 - 1)` through `2^53 - 1`. A length Operand MUST be an integer from `0` through `2^53 - 1`. These limits follow the interoperability constraints for numbers in [RFC 7493, I-JSON](https://www.rfc-editor.org/rfc/rfc7493.html#section-2.2).

The `>`, `>=`, `<`, and `<=` operators apply only to input strings that can be parsed as values in this numeric model. The entire input string MUST conform to the JSON number grammar in RFC 8259. Leading or trailing whitespace, a leading `+`, and redundant leading zeros are not allowed. Parsing and comparison MUST use binary64 semantics.

For example, `"12.5"`, `"-1"`, and `"1e3"` are numeric inputs. `" 12 "`, `"+1"`, `"01"`, `"12px"`, and `"NaN"` are not numeric inputs.

An input outside the numeric domain does not match a numeric comparison operator. Numeric comparisons MUST NOT use lexicographic string ordering.

### 4.2. Negation

Prefixing an Operator with `!` negates its predicate result. For example, `!=` means not equal to, `!^=` means does not start with, and `!#>=` means length less than.

`!` MUST NOT appear more than once and MUST be the first character of an Operator. Adding `!` does not change the Operand type or value range of the BaseOperator. A Strule value with an Operand that does not satisfy the BaseOperator requirements remains invalid.

`!` negates a predicate only when the input is within the domain of its BaseOperator. An input outside that domain still does not match. For example, a non-numeric string matches neither `>` nor `!>`.

## 5. Strings

- A Strule input value MUST be a string. Behavior for other input types is outside the scope of this specification.
- Comparisons MUST be case-sensitive.
- Except for parsing defined by numeric comparison operators, an implementation MUST NOT apply Unicode normalization, whitespace trimming, case conversion, or implicit type coercion to an input value or Operand.
- Input values and string Operands MUST consist of Unicode scalar values and MUST NOT contain Unicode noncharacters. An isolated UTF-16 surrogate is invalid; a well-formed surrogate pair encoding a supplementary code point is valid. These constraints follow the character interoperability requirements in [RFC 7493, I-JSON](https://www.rfc-editor.org/rfc/rfc7493.html#section-2.1).

## 6. Strule Validity

A Strule value MUST satisfy all of the following requirements:

- The AnyOf is a non-empty JSON array.
- Every element of the AnyOf is a non-empty JSON array representing an AllOf.
- Strule does not define array Operands. An array in any Operand position makes the Strule value invalid, including an empty array.
- Each AllOf contains an even number of elements.
- Each value at an even index in an AllOf is an Operator defined by this specification.
- The Operand following each Operator satisfies the type and value-range requirements of that Operator.
- `!` appears at most once in an Operator and only as its prefix.

A Strule value that fails any of these requirements is invalid. How a program reports or handles an invalid Strule value is outside the scope of this specification.
