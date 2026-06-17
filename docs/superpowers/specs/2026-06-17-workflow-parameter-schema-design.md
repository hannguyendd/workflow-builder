# Workflow Parameter Schema + Layout Reorg + `$parameters` Autocomplete

**Date:** 2026-06-17
**Branch:** `feat/workflow-parameter-schema`
**Status:** Approved design

## Problem

The workflow document already carries a `parameterSchema` (a JSON Schema object,
default `{ type: "object", properties: {}, required: [] }`), but:

1. There is no UI to edit it.
2. Nothing reads it — expression autocomplete cannot suggest parameter names.
3. The node Inspector occupies the right edge, where the new parameter editor
   belongs.

We want to let users define the workflow's input parameters as a JSON Schema,
edit them with a guided form (with a raw-JSON escape hatch), move the per-node
Inspector to the bottom, and feed the schema into `$parameters.<field>`
autocomplete.

### Reference schema shape

The persisted `parameterSchema` is a flat JSON Schema object (from
`taggle-ext-chat` workflow examples):

```json
{
  "type": "object",
  "properties": {
    "patient_name": { "type": "string", "description": "Patient's display name" },
    "patient_email": { "type": "string", "description": "Patient's email address" },
    "systolic": { "type": "number", "description": "Systolic blood pressure in mmHg" },
    "diastolic": { "type": "number", "description": "Diastolic blood pressure in mmHg" }
  },
  "required": ["patient_name", "patient_email", "systolic", "diastolic"]
}
```

Expressions reference these flat: `{ "var": "$parameters.systolic" }` and, in
string templates, `{{$parameters.patient_name}}`. Because real schemas are flat,
autocomplete only needs top-level fields (no nested drill-down).

## Goals

- Edit `parameterSchema` via a form builder (name / type / required /
  description) with a raw-JSON fallback, mirroring the existing
  `ConditionEditor` builder+JSON pattern.
- Move the node Inspector from the right edge to the bottom (height-resizable,
  closable).
- Add a new right-side, toggleable **Parameters** panel hosting the schema
  editor (width-resizable, closable).
- Extend `$parameters.` autocomplete to suggest top-level schema fields, with a
  `name — type` label.

## Non-goals (YAGNI)

- Nested object / array drill-down in autocomplete or the form builder. Advanced
  JSON Schema (nested objects, arrays, enums, `format`, etc.) is edited only via
  the raw-JSON fallback and gets no field-level autocomplete.
- Validating workflow runs against the schema. The schema is authoring metadata
  only.
- Changing the persisted DTO — `parameterSchema` already round-trips.

## Design

### 1. Layout reorganization

`WorkflowBuilderPage` row gains a third region; the center column splits
vertically.

```
Toolbar  ── toggles: [Sidebar] [Parameters ▸] [Inspector ▾]
ReactFlowProvider
└─ row (flex min-h-0 flex-1)
   ├─ Sidebar (left, existing)
   ├─ center column (flex min-w-0 flex-1 flex-col)
   │   ├─ WorkflowCanvas (flex-1)
   │   └─ Inspector  ← bottom panel: horizontal, height-resizable, closable
   └─ ParametersPanel ← right aside: width-resizable, closable
```

- **Inspector** keeps all current behavior (node name, description, `if`
  condition). Only its anchor/orientation changes: it becomes a bottom panel.
  The current pointer-drag resize logic is mirrored from width to height
  (`window.innerHeight - ev.clientY`, clamped); the resize handle moves to the
  top edge (`role="separator"`, `aria-orientation="horizontal"`). Constants
  become `INSPECTOR_MIN_HEIGHT` / `INSPECTOR_MAX_HEIGHT` /
  `INSPECTOR_DEFAULT_HEIGHT` (replacing the `*_WIDTH` ones).
- **ParametersPanel** reuses the right-`aside` width-resize pattern that the
  Inspector uses today (verbatim: `window.innerWidth - ev.clientX`, clamped),
  with its own `PARAMETERS_MIN/MAX/DEFAULT_WIDTH` constants.
- Both panels toggle independently from the Toolbar; both may be open at once.
  `WorkflowBuilderPage` owns the open/width/height state (as it does today for
  the Inspector).

### 2. Parameter schema model + editor

New pure module `src/features/workflow/schema/parameterSchema.ts`:

```ts
export type ParamType = "string" | "number" | "integer" | "boolean";
export interface ParameterField {
  name: string;
  type: ParamType;
  description: string;
  required: boolean;
}

// JSON Schema object -> editable fields, or null if not form-representable
// (nested objects, arrays, enums, unknown types, non-object root, etc.).
export function schemaToFields(schema: unknown): ParameterField[] | null;

// Editable fields -> JSON Schema object { type:"object", properties, required }.
export function fieldsToSchema(fields: ParameterField[]): Record<string, unknown>;

// A top-level parameter, for autocomplete labels.
export interface ParameterEntry { name: string; type: string }

// Top-level entries for autocomplete (best-effort; tolerates schemas the
// form can't represent).
export function parameterEntries(schema: unknown): ParameterEntry[];
```

- `schemaToFields` returns `null` (→ raw-JSON mode) when the schema isn't a
  plain `type:"object"` with simple-typed properties. The `required` array
  drives each field's `required` flag.
- `fieldsToSchema` emits `properties` in field order and a `required` array
  containing the names of required fields (omitted/empty when none).
- Constant for the supported type list (no magic strings):
  `PARAM_TYPES = ["string","number","integer","boolean"] as const`.

`ParametersPanel.tsx` (new) renders the editor, mirroring `ConditionEditor`:

- **Builder mode** (when `schemaToFields` is non-null): a row per field —
  name input, `type` `<select>` (from `PARAM_TYPES`), `required` checkbox,
  `description` input, and a remove button; plus an **Add parameter** button.
- **JSON mode**: a `<textarea>` showing the pretty-printed schema with parse
  validation (invalid JSON shows an error and does not dispatch), matching how
  `ConditionEditor` handles its JSON fallback.
- A `{ } JSON` toggle switches modes. If the schema isn't form-representable,
  it opens in JSON mode and the toggle to builder is disabled (same spirit as
  the condition editor).
- Edits dispatch a new `updateParameterSchema(schema)` reducer that writes
  `state.meta.parameterSchema`.

The component is thin: it selects `meta.parameterSchema` from the store and
dispatches. All schema<->fields logic lives in the pure module.

### 3. `$parameters.` autocomplete

`getSuggestions` gains parameter awareness via an additive optional argument
(keeps the existing positional `nodeNames` and all current tests green):

```ts
getSuggestions(input: string, nodeNames: string[], parameters?: ParameterEntry[]): Suggestion[]
```

Behavior:

- After `$parameters.` (no further `.`): suggest top-level parameter names
  whose name starts with the typed needle. `value = "$parameters.<name>"`,
  `label = "<name> — <type>"`. So `$parameters.u` → `userId — string`.
- `$nodes.<name>.` → live node names (unchanged).
- empty / `$` prefix → the `CONTEXT_SOURCES` list (unchanged).
- anything deeper → no suggestions (unchanged).

`ExpressionInput` gains a `parameters` prop alongside `nodeNames` and forwards
both to `getSuggestions`. The `parameters` list (from `meta.parameterSchema`
via `parameterEntries`) is threaded from the store through
`Inspector → ConditionEditor → ConditionBuilder → ExpressionInput`, parallel to
the existing `nodeNames` flow.

### 4. State / serialization

- New reducer `updateParameterSchema(state, action: PayloadAction<Record<string, unknown>>)`
  setting `state.meta.parameterSchema`. Exported from the slice barrel.
- No DTO/serializer change: `parameterSchema` already maps both directions and
  is seeded by `DEFAULT_PARAMETER_SCHEMA`.

## Testing

- `schema/parameterSchema.test.ts` — `schemaToFields`/`fieldsToSchema`
  round-trip (incl. `required` array, field order, empty schema); `null`
  fallback for nested/array/enum/non-object schemas; `parameterEntries`
  top-level extraction and tolerance of non-representable schemas.
- `expression/suggestions.test.ts` — extend for `$parameters.` prefix and
  needle filtering, label format, and "no suggestions past the field segment".
  Update existing call sites to the new `ctx` signature.
- `workflowSlice.test.ts` — `updateParameterSchema` updates `meta.parameterSchema`.
- UI (`ParametersPanel`, relocated `Inspector`, `WorkflowBuilderPage`,
  `Toolbar`) verified via `bunx tsc --noEmit` — no DOM test infra, per the
  feature convention (logic lives in tested pure modules).

## Affected files

- New: `src/features/workflow/schema/parameterSchema.ts` (+ test),
  `src/features/workflow/ParametersPanel.tsx`.
- Edit: `Inspector.tsx` (relocate to bottom, height resize),
  `WorkflowBuilderPage.tsx` (3-region layout + panel state),
  `Toolbar.tsx` (Parameters toggle), `workflowSlice.ts` (+ reducer),
  `expression/suggestions.ts` (+ parameters), `components/ExpressionInput.tsx`
  (+ `parameters` prop), `condition/ConditionEditor.tsx` +
  `condition/ConditionBuilder.tsx` (thread `parameters`), feature `CLAUDE.md`
  (document the new module/panel and layout). `ParametersPanel` stays internal
  to the feature (used only by `WorkflowBuilderPage`), so — like `Inspector` —
  it is not re-exported from `index.ts`.
- Update tests: `suggestions.test.ts`, `workflowSlice.test.ts`.

## Open conventions honored

- No magic strings/numbers — type lists, source prefixes, separators, and
  resize bounds are named constants.
- Alias imports (`@/…`).
- Tailwind canonical classes; reuse the existing panel/resize styling.
