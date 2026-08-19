import { getOperandKind, matches, validate, validatePredicate } from "@strule/core";

/**
 * Form controls keep every operand as text. Conversion to Strule's JSON shape
 * happens only in this module, immediately before validation or matching.
 */
export function toOperator(predicateDraft) {
  return `${predicateDraft.negated ? "!" : ""}${predicateDraft.operator}`;
}

export function getDraftOperandKind(predicateDraft) {
  return getOperandKind(toOperator(predicateDraft));
}

function toOperand(predicateDraft) {
  if (getDraftOperandKind(predicateDraft) === "string") {
    return predicateDraft.value;
  }

  const trimmedValue = predicateDraft.value.trim();
  if (trimmedValue === "") {
    return predicateDraft.value;
  }

  const number = Number(trimmedValue);
  return Number.isFinite(number) ? number : predicateDraft.value;
}

/** Convert one UI group into Strule's flat AllOf tuple. */
export function toAllOf(allOfDraft) {
  return allOfDraft.predicates.flatMap((predicateDraft) => [toOperator(predicateDraft), toOperand(predicateDraft)]);
}

/** Convert all OR alternatives for one search parameter into an AnyOf. */
export function toRule(parameterDraft) {
  return parameterDraft.groups.map(toAllOf);
}

/** Keep the application-level JSON shape explicit and easy to reuse. */
export function toSearchParamConfig(parameterDraft) {
  return {
    name: parameterDraft.name.trim(),
    required: parameterDraft.required,
    rule: toRule(parameterDraft),
  };
}

export function toSchema(parameterDrafts) {
  return parameterDrafts.map(toSearchParamConfig);
}

function duplicateNames(schema) {
  const counts = new Map();
  for (const config of schema) {
    if (config.name !== "") {
      counts.set(config.name, (counts.get(config.name) ?? 0) + 1);
    }
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([name]) => name));
}

/**
 * Analyze the complete draft without removing invalid UI rows. Results use the
 * same parameter/group/predicate indexes as the draft so the view can render
 * errors without knowing how Strule validation works.
 */
export function analyzeSchemaDraft(parameterDrafts) {
  const schema = toSchema(parameterDrafts);
  const duplicates = duplicateNames(schema);
  const parameters = parameterDrafts.map((parameterDraft, parameterIndex) => {
    const config = schema[parameterIndex];
    const nameIssue = config.name === "" ? "empty" : duplicates.has(config.name) ? "duplicate" : undefined;
    const predicateResults = parameterDraft.groups.map((group) =>
      group.predicates.map((predicateDraft) =>
        validatePredicate(toOperator(predicateDraft), toOperand(predicateDraft)),
      ),
    );
    const ruleResult = validate(config.rule);

    return {
      nameIssue,
      predicateResults,
      ruleResult,
      valid: nameIssue === undefined && ruleResult.ok,
    };
  });

  return {
    schema,
    parameters,
    valid: parameters.every((parameter) => parameter.valid),
  };
}

/**
 * Produce only usable JSON for the preview. Invalid names remove the whole
 * config; invalid AllOf alternatives are removed independently.
 */
export function toPreviewSchema(analysis) {
  return analysis.schema.flatMap((config, parameterIndex) => {
    if (analysis.parameters[parameterIndex].nameIssue !== undefined) {
      return [];
    }

    const rule = config.rule.filter((allOf) => validate([allOf]).ok);
    if (!validate(rule).ok) {
      return [];
    }

    return [
      {
        name: config.name,
        required: config.required,
        rule,
      },
    ];
  });
}

/** Match already-validated search-param JSON against a parsed URL. */
export function matchSearchParams(schema, url) {
  const parameters = schema.map((config) => {
    const present = url.searchParams.has(config.name);
    const matched = present ? matches(config.rule, url.searchParams.get(config.name) ?? "") : !config.required;

    return {
      name: config.name,
      required: config.required,
      present,
      matched,
    };
  });

  return {
    matched: parameters.every((parameter) => parameter.matched),
    parameters,
  };
}
