# Strule

[![Docs](https://img.shields.io/badge/Docs-read-%23fdf9f5)](https://crimx.github.io/strule)
[![Build Status](https://github.com/crimx/strule/actions/workflows/build.yml/badge.svg)](https://github.com/crimx/strule/actions/workflows/build.yml)
[![npm version](https://img.shields.io/npm/v/%40strule%2Fcore)](https://www.npmjs.com/package/@strule/core)
[![Coverage Status](https://crimx.github.io/strule/coverage-badges/strule.svg)](https://crimx.github.io/strule/coverage/)
[![minified size](https://img.shields.io/bundlephobia/minzip/%40strule%2Fcore)](https://bundlephobia.com/package/@strule/core)

Strule defines portable, user-configurable validation rules for strings. Rules combine common constraints with AND, OR, and negation, and contain no regular expressions, functions, or executable code.

## Install

```sh
npm add @strule/core
```

## Specification

See the [Strule Specification](./SPEC.md) for the complete syntax, semantics, and validity requirements.

Rules use a compact JSON encoding:

```json
[
  ["=", "admin"],
  ["*=", "foo", "*=", "bar", "!^=", "tmp_", "#>=", 10]
]
```

The outer array is OR. Each inner array is an AND group of adjacent operator and operand pairs. This keeps the structure compact and allows an operator to appear more than once in the same group.
