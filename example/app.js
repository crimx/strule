import { baseOperators, getOperandKind } from "@strule/core";
import { loadDraft, saveDraft } from "./draft-storage.js";
import { analyzeSchemaDraft, getDraftOperandKind, matchSearchParams, toPreviewSchema } from "./schema.js";

const operatorLabels = {
  "=": "equals",
  "^=": "starts with",
  "$=": "ends with",
  "*=": "contains",
  ">": "greater than",
  ">=": "at least",
  "<": "less than",
  "<=": "at most",
  "#>": "longer than",
  "#>=": "minimum length",
  "#<": "shorter than",
  "#<=": "maximum length",
};

const nameIssueMessages = {
  empty: "Search Param is required.",
  duplicate: "Search Param must be unique.",
};

const operatorGroupLabels = {
  string: "String",
  number: "Number",
  length: "Length",
};

let nextId = 1;

function id(prefix) {
  const value = `${prefix}-${nextId}`;
  nextId += 1;
  return value;
}

function predicate(operator, value, negated = false) {
  return { id: id("predicate"), negated, operator, value };
}

function allOf(...predicates) {
  return { id: id("all-of"), predicates };
}

function parameter(name, required, ...groups) {
  return { id: id("param"), name, required, groups };
}

function hydrateParams(params) {
  return params.map((param) =>
    parameter(
      param.name,
      param.required,
      ...param.groups.map((group) =>
        allOf(...group.predicates.map((row) => predicate(row.operator, row.value, row.negated))),
      ),
    ),
  );
}

function defaultParams() {
  return [
    parameter("q", true, allOf(predicate("*=", "strule"))),
    parameter("page", false, allOf(predicate(">=", "1"), predicate("<=", "10"))),
  ];
}

function getLocalStorage() {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

const draftStorage = getLocalStorage();
const storedParams = loadDraft(draftStorage, baseOperators);
const state = {
  params: storedParams ? hydrateParams(storedParams) : defaultParams(),
};

const rulesElement = document.querySelector("#rules");
const previewElement = document.querySelector("#schema-preview");
const schemaStatusElement = document.querySelector("#schema-status");
const testUrlElement = document.querySelector("#test-url");
const testStatusElement = document.querySelector("#test-status");
const testDetailsElement = document.querySelector("#test-details");
const addParamElement = document.querySelector("#add-param");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function indentation(level) {
  return "  ".repeat(level);
}

function formatAllOf(allOf, level) {
  const pairs = [];
  for (let index = 0; index < allOf.length; index += 2) {
    pairs.push(`${indentation(level + 1)}${JSON.stringify(allOf[index])}, ${JSON.stringify(allOf[index + 1])}`);
  }
  return `[\n${pairs.join(",\n")}\n${indentation(level)}]`;
}

function formatAnyOf(anyOf, level) {
  const allOfGroups = anyOf.map((allOf) => `${indentation(level + 1)}${formatAllOf(allOf, level + 1)}`);
  return `[\n${allOfGroups.join(",\n")}\n${indentation(level)}]`;
}

/** Format the preview without changing the application-level JSON shape. */
function formatSchemaPreview(schema) {
  if (schema.length === 0) {
    return "[]";
  }

  const configs = schema.map(
    (config) => `  {
    "name": ${JSON.stringify(config.name)},
    "required": ${JSON.stringify(config.required)},
    "rule": ${formatAnyOf(config.rule, 2)}
  }`,
  );
  return `[\n${configs.join(",\n")}\n]`;
}

function operatorOptions(selected) {
  return Object.entries(operatorGroupLabels)
    .map(([kind, label]) => {
      const options = baseOperators
        .filter((operator) => getOperandKind(operator) === kind)
        .map(
          (operator) =>
            `<option value="${operator}" ${operator === selected ? "selected" : ""}>${operatorLabels[operator]} (${escapeHtml(operator)})</option>`,
        )
        .join("");
      return `<optgroup label="${label}">${options}</optgroup>`;
    })
    .join("");
}

function predicateMarkup(param, group, row) {
  const kind = getDraftOperandKind(row);
  const placeholder = kind === "string" ? "Value" : kind === "length" ? "Non-negative integer" : "JSON number";
  const canDelete = group.predicates.length > 1 || param.groups.length > 1;

  return `
    <div class="predicate-row" data-row-id="${row.id}">
      <label>
        <span class="field-label mobile-label">Requirement</span>
        <select data-field="negated" aria-label="Requirement">
          <option value="" ${row.negated ? "" : "selected"}>Must</option>
          <option value="!" ${row.negated ? "selected" : ""}>Must not</option>
        </select>
      </label>
      <label>
        <span class="field-label mobile-label">Operator</span>
        <select data-field="operator" aria-label="Operator">
          ${operatorOptions(row.operator)}
        </select>
      </label>
      <label class="value-wrap">
        <span class="field-label mobile-label">Value</span>
        <span class="value-control ${kind === "length" ? "has-suffix" : ""}">
          <input
            data-field="value"
            value="${escapeHtml(row.value)}"
            inputmode="${kind === "string" ? "text" : "decimal"}"
            placeholder="${placeholder}"
            autocomplete="off"
            aria-label="${kind === "length" ? "Predicate length in characters" : "Predicate value"}"
          />
          ${kind === "length" ? '<span class="value-suffix" aria-hidden="true">characters</span>' : ""}
        </span>
        <span class="row-error" aria-live="polite"></span>
      </label>
      <div class="row-actions">
        <button class="button logic-button" data-action="and" type="button">And</button>
        <button class="button logic-button" data-action="or" type="button">Or</button>
        <button
          class="button button-danger"
          data-action="delete-predicate"
          type="button"
          ${canDelete ? "" : "disabled"}
          title="${canDelete ? "Delete predicate" : "An AnyOf needs at least one Predicate"}"
        >Delete</button>
      </div>
    </div>`;
}

function groupMarkup(param, group, index) {
  const predicates = group.predicates.map((row) => predicateMarkup(param, group, row)).join("");
  const groupClass = group.predicates.length === 1 ? "all-of is-single" : "all-of";

  return `
    ${index === 0 ? "" : '<div class="or-divider"><span>OR</span></div>'}
    <div class="${groupClass}" data-group-id="${group.id}">
      <span class="all-of-rail" aria-hidden="true"><span>AND</span></span>
      ${predicates}
    </div>`;
}

function paramMarkup(param) {
  return `
    <article class="param-card" data-param-id="${param.id}">
      <div class="param-meta">
        <label class="field">
          <span class="field-label">Search Param</span>
          <input
            data-field="name"
            value="${escapeHtml(param.name)}"
            placeholder="e.g. q"
            autocomplete="off"
            spellcheck="false"
          />
          <span class="param-error" aria-live="polite"></span>
        </label>
        <label class="checkbox-field">
          <input data-field="required" type="checkbox" ${param.required ? "checked" : ""} />
          Required
        </label>
        <button class="button button-danger" data-action="delete-param" type="button">Delete Param</button>
      </div>
      <div class="predicate-editor">
        <div class="column-labels" aria-hidden="true">
          <span>Requirement</span>
          <span>Operator</span>
          <span>Value</span>
          <span>Actions</span>
        </div>
        ${param.groups.map((group, index) => groupMarkup(param, group, index)).join("")}
      </div>
    </article>`;
}

function renderRules() {
  rulesElement.innerHTML =
    state.params.length === 0
      ? '<div class="empty-state">No search params yet. Add one to build a schema.</div>'
      : state.params.map(paramMarkup).join("");
  refreshDerivedState();
}

function commitRules(options = {}) {
  saveDraft(draftStorage, state.params);
  if (options.render) {
    renderRules();
  } else {
    refreshDerivedState();
  }
}

function findParam(paramId) {
  return state.params.find((param) => param.id === paramId);
}

function findGroup(param, groupId) {
  return param.groups.find((group) => group.id === groupId);
}

function findRow(group, rowId) {
  return group.predicates.find((row) => row.id === rowId);
}

function refreshValidation(analysis) {
  state.params.forEach((param, paramIndex) => {
    const parameterAnalysis = analysis.parameters[paramIndex];
    const paramElement = rulesElement.querySelector(`[data-param-id="${param.id}"]`);
    const nameInput = paramElement?.querySelector('[data-field="name"]');
    const nameError = paramElement?.querySelector(".param-error");
    const nameMessage = nameIssueMessages[parameterAnalysis.nameIssue] ?? "";

    if (nameInput) {
      nameInput.setAttribute("aria-invalid", String(Boolean(nameMessage)));
    }
    if (nameError) {
      nameError.textContent = nameMessage;
    }
    param.groups.forEach((group, groupIndex) => {
      group.predicates.forEach((row, predicateIndex) => {
        const rowElement = paramElement?.querySelector(`[data-row-id="${row.id}"]`);
        const valueInput = rowElement?.querySelector('[data-field="value"]');
        const errorElement = rowElement?.querySelector(".row-error");
        const result = parameterAnalysis.predicateResults[groupIndex][predicateIndex];
        const error = result.ok ? "" : result.issues[0].message;

        if (valueInput) {
          valueInput.setAttribute("aria-invalid", String(Boolean(error)));
        }
        if (errorElement) {
          errorElement.textContent = error;
        }
      });
    });
  });

  schemaStatusElement.textContent = analysis.valid ? "Valid schema" : "Needs attention";
  schemaStatusElement.dataset.state = analysis.valid ? "success" : "error";
}

function refreshUrlTest(schema, schemaValid) {
  let url;
  try {
    url = new URL(testUrlElement.value);
    testUrlElement.setAttribute("aria-invalid", "false");
  } catch {
    testUrlElement.setAttribute("aria-invalid", "true");
    testStatusElement.textContent = "Invalid URL";
    testStatusElement.dataset.state = "error";
    testDetailsElement.innerHTML = "";
    return;
  }

  if (!schemaValid) {
    testStatusElement.textContent = "Fix schema to test";
    testStatusElement.dataset.state = "error";
    testDetailsElement.innerHTML = "";
    return;
  }

  const result = matchSearchParams(schema, url);

  testStatusElement.textContent = result.matched ? "URL matches" : "URL does not match";
  testStatusElement.dataset.state = result.matched ? "success" : "error";
  testDetailsElement.innerHTML = result.parameters
    .map((parameter) => {
      const state = parameter.present
        ? parameter.matched
          ? "matches"
          : "does not match"
        : parameter.required
          ? "missing"
          : "optional";
      return `<span class="test-chip" data-state="${parameter.matched ? "success" : "error"}">${escapeHtml(`${parameter.name}: ${state}`)}</span>`;
    })
    .join("");
}

function refreshDerivedState() {
  const analysis = analyzeSchemaDraft(state.params);
  previewElement.textContent = formatSchemaPreview(toPreviewSchema(analysis));
  refreshValidation(analysis);
  refreshUrlTest(analysis.schema, analysis.valid);
}

rulesElement.addEventListener("input", (event) => {
  const target = event.target;
  const paramElement = target.closest("[data-param-id]");
  const param = findParam(paramElement?.dataset.paramId);
  if (!param) {
    return;
  }

  if (target.dataset.field === "name") {
    param.name = target.value;
  } else if (target.dataset.field === "value") {
    const groupElement = target.closest("[data-group-id]");
    const rowElement = target.closest("[data-row-id]");
    const group = findGroup(param, groupElement?.dataset.groupId);
    const row = group && findRow(group, rowElement?.dataset.rowId);
    if (row) {
      row.value = target.value;
    }
  }

  commitRules();
});

rulesElement.addEventListener("change", (event) => {
  const target = event.target;
  const paramElement = target.closest("[data-param-id]");
  const param = findParam(paramElement?.dataset.paramId);
  if (!param) {
    return;
  }

  if (target.dataset.field === "required") {
    param.required = target.checked;
    commitRules();
    return;
  }

  const groupElement = target.closest("[data-group-id]");
  const rowElement = target.closest("[data-row-id]");
  const group = findGroup(param, groupElement?.dataset.groupId);
  const row = group && findRow(group, rowElement?.dataset.rowId);
  if (!row) {
    return;
  }

  if (target.dataset.field === "negated") {
    row.negated = target.value === "!";
  } else if (target.dataset.field === "operator") {
    row.operator = target.value;
    const kind = getDraftOperandKind(row);
    if (kind !== "string" && (row.value.trim() === "" || !Number.isFinite(Number(row.value)))) {
      row.value = "0";
    }
  }

  commitRules({ render: true });
});

rulesElement.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const paramElement = button.closest("[data-param-id]");
  const param = findParam(paramElement?.dataset.paramId);
  if (!param) {
    return;
  }

  if (button.dataset.action === "delete-param") {
    state.params = state.params.filter((candidate) => candidate !== param);
    commitRules({ render: true });
    return;
  }

  const groupElement = button.closest("[data-group-id]");
  const rowElement = button.closest("[data-row-id]");
  const group = findGroup(param, groupElement?.dataset.groupId);
  const row = group && findRow(group, rowElement?.dataset.rowId);
  if (!group || !row) {
    return;
  }

  if (button.dataset.action === "and") {
    group.predicates.push(predicate("=", ""));
  } else if (button.dataset.action === "or") {
    const groupIndex = param.groups.indexOf(group);
    param.groups.splice(groupIndex + 1, 0, allOf(predicate("=", "")));
  } else if (button.dataset.action === "delete-predicate") {
    if (group.predicates.length > 1) {
      group.predicates = group.predicates.filter((candidate) => candidate !== row);
    } else if (param.groups.length > 1) {
      param.groups = param.groups.filter((candidate) => candidate !== group);
    }
  }

  commitRules({ render: true });
});

addParamElement.addEventListener("click", () => {
  state.params.push(parameter("", false, allOf(predicate("=", ""))));
  commitRules({ render: true });
});

testUrlElement.addEventListener("input", refreshDerivedState);

renderRules();
