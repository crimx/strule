const storageKey = "@strule/core:example-draft";
const storageVersion = 1;

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPredicateDraft(value, operators) {
  return (
    isRecord(value) &&
    typeof value.negated === "boolean" &&
    typeof value.operator === "string" &&
    operators.has(value.operator) &&
    typeof value.value === "string"
  );
}

function isGroupDraft(value, operators) {
  return (
    isRecord(value) &&
    Array.isArray(value.predicates) &&
    value.predicates.length > 0 &&
    value.predicates.every((predicate) => isPredicateDraft(predicate, operators))
  );
}

function isParameterDraft(value, operators) {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.required === "boolean" &&
    Array.isArray(value.groups) &&
    value.groups.length > 0 &&
    value.groups.every((group) => isGroupDraft(group, operators))
  );
}

function serializeParams(params) {
  return params.map((param) => ({
    name: param.name,
    required: param.required,
    groups: param.groups.map((group) => ({
      predicates: group.predicates.map((predicate) => ({
        negated: predicate.negated,
        operator: predicate.operator,
        value: predicate.value,
      })),
    })),
  }));
}

/** Load a versioned UI draft. Invalid or unavailable storage is ignored. */
export function loadDraft(storage, allowedOperators) {
  if (!storage) {
    return undefined;
  }

  try {
    const source = storage.getItem(storageKey);
    if (source === null) {
      return undefined;
    }

    const payload = JSON.parse(source);
    const operators = new Set(allowedOperators);
    if (
      !isRecord(payload) ||
      payload.version !== storageVersion ||
      !Array.isArray(payload.params) ||
      !payload.params.every((param) => isParameterDraft(param, operators))
    ) {
      return undefined;
    }

    return serializeParams(payload.params);
  } catch {
    return undefined;
  }
}

/** Persist UI fields only; generated ids and derived schema data are omitted. */
export function saveDraft(storage, params) {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      storageKey,
      JSON.stringify({
        version: storageVersion,
        params: serializeParams(params),
      }),
    );
  } catch {
    // Storage can be disabled or full; the example remains usable in memory.
  }
}
