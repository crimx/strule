# Strule

[![Docs](https://img.shields.io/badge/Docs-read-%23fdf9f5)](https://crimx.github.io/strule)
[![Build Status](https://github.com/crimx/strule/actions/workflows/build.yml/badge.svg)](https://github.com/crimx/strule/actions/workflows/build.yml)
[![npm version](https://img.shields.io/npm/v/%40strule%2Fcore)](https://www.npmjs.com/package/@strule/core)
[![Coverage Status](https://crimx.github.io/strule/coverage-badges/strule.svg)](https://crimx.github.io/strule/coverage/)
[![minified size](https://img.shields.io/bundlephobia/minzip/%40strule%2Fcore)](https://bundlephobia.com/package/@strule/core)

Strule is a compact JSON format for portable, user-configurable string rules. It supports common string, numeric, and length predicates with AND, OR, and negation. Rules contain no regular expressions, functions, or executable code.

## Example

[Open the URL search-param rule builder](https://crimx.github.io/strule/example/) to configure rules, test a URL, and inspect the generated schema.

## Install

```sh
npm add @strule/core
```

## Define a Strule value

An `AnyOf` contains one or more `AllOf` arrays. The outer array is OR; adjacent operator and operand pairs within each inner array are AND.

```ts
const accessRule = [
  ["=", "admin"],
  ["^=", "org_", "$=", "_prod", "#>=", 10],
];
```

This value matches `"admin"` or a string that starts with `"org_"`, ends with `"_prod"`, and contains at least 10 Unicode code points.

See the [Strule Specification](./SPEC.md) for the complete syntax, numeric model, Unicode requirements, and validity rules.

## Match strings

Use `matches` for a single value:

```ts
import { matches } from "@strule/core";

matches(accessRule, "admin"); // true
matches(accessRule, "org_team_prod"); // true
matches(accessRule, "owner"); // false
```

Use `compile` when matching many values against the same configuration. Compilation validates and snapshots the configuration once.

```ts
import { compile } from "@strule/core";

const isAllowed = compile(accessRule);

isAllowed("admin");
isAllowed("org_team_prod");
```

`matches` and `compile` throw `InvalidStruleError` when the configuration is invalid. The error exposes the same structured issues returned by `validate`.

```ts
import { InvalidStruleError, compile } from "@strule/core";

try {
  compile([[">", "10"]]);
} catch (error) {
  if (error instanceof InvalidStruleError) {
    console.error(error.issues);
  }
}
```

## Validate configuration

Use `validate` for JSON, stored configuration, and editor state that must report errors without throwing.

```ts
import { validate } from "@strule/core";

const result = validate(JSON.parse(source));

if (result.ok) {
  console.log(result.value);
} else {
  for (const issue of result.issues) {
    console.error(issue.code, issue.path, issue.message);
  }
}
```

Each issue includes a stable `code`, an array-index `path`, the expected input, the received value, and a default English message.

## Validate an editor field

`validatePredicate` checks one operator and operand without requiring a complete `AnyOf`. This is useful while editing one predicate in a UI.

```ts
import { validatePredicate } from "@strule/core";

const result = validatePredicate(">", "number");

if (!result.ok) {
  // [{ code: "invalid_type", path: [1], ... }]
  showFieldErrors(result.issues);
}
```

Use `baseOperators` to populate an operator selector and `getOperandKind` to choose an input control.

```ts
import { baseOperators, getOperandKind } from "@strule/core";

baseOperators; // ["=", "^=", ..., "#<="]
getOperandKind("!>="); // "number"
getOperandKind("#<="); // "length"
```

Negation does not change the operand kind.
