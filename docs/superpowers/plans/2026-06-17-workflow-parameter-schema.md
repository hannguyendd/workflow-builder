# Workflow Parameter Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users author a workflow's `parameterSchema` as a JSON Schema via a right-side form panel (with raw-JSON fallback), move the node Inspector to the bottom, and feed the schema into `$parameters.<field>` expression autocomplete.

**Architecture:** A new pure module (`schema/parameterSchema.ts`) converts between a JSON Schema object and an editable field list. A new `ParametersPanel` (right, width-resizable, toggleable) edits it via a Redux reducer. The Inspector relocates to the bottom of the canvas column (height-resizable). The schema's top-level fields are threaded from the store through the condition editor into `ExpressionInput`, where `getSuggestions` suggests them after `$parameters.`.

**Tech Stack:** Bun, React 19, Redux Toolkit, `@xyflow/react`, Tailwind v4, `bun test`.

## Global Constraints

- **Runtime/tooling:** Bun only — `bun test`, `bunx tsc --noEmit`. Never npm/node/jest/vitest.
- **No magic strings/numbers:** extract literals into named constants/`as const` maps.
- **Imports:** prefer aliases (`@/*`, `@features/*`, `@services/*`, `@store/*`, `@types/*`) over relative `../../` — but within the `features/workflow` folder, match the existing relative-import style used by sibling files (e.g. `./constants`, `../components/ExpressionInput`).
- **State lives in the slice:** components select from the store and dispatch; all schema↔fields logic lives in the pure module. Mutations go through reducers.
- **Tailwind:** canonical class names, grouped layout→box→spacing→typography→color; reuse existing panel/resize styling.
- **Tests:** cover pure modules and the slice with `bun test`. UI components have no DOM test infra — verify via `bunx tsc --noEmit`; keep logic in tested pure modules.
- **Commit convention:** Conventional Commits, imperative, lowercase, no trailing period, scope `workflow`. End commit messages with the `Co-Authored-By` trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## File Structure

- **Create** `src/features/workflow/schema/parameterSchema.ts` — pure JSON-Schema↔fields codec + autocomplete entries.
- **Create** `src/features/workflow/schema/parameterSchema.test.ts` — `bun test` for the codec.
- **Create** `src/features/workflow/ParametersPanel.tsx` — right-side schema editor (form + JSON fallback), width-resizable, closable.
- **Modify** `src/features/workflow/workflowSlice.ts` — add `updateParameterSchema` reducer + export.
- **Modify** `src/features/workflow/workflowSlice.test.ts` — cover the reducer.
- **Modify** `src/features/workflow/expression/suggestions.ts` — `$parameters.` suggestions via optional `parameters` arg.
- **Modify** `src/features/workflow/expression/suggestions.test.ts` — cover `$parameters.`.
- **Modify** `src/features/workflow/Inspector.tsx` — relocate to bottom (height-resize, top handle).
- **Modify** `src/features/workflow/WorkflowBuilderPage.tsx` — 3-region layout, panel state.
- **Modify** `src/features/workflow/Toolbar.tsx` — Parameters toggle button.
- **Modify** `src/features/workflow/components/ExpressionInput.tsx` — `parameters` prop → `getSuggestions`.
- **Modify** `src/features/workflow/condition/ConditionEditor.tsx` + `ConditionBuilder.tsx` — thread `parameters`.
- **Modify** `src/features/workflow/CLAUDE.md` — document the new module/panel and bottom-inspector layout.

---

## Task 1: Parameter schema codec (pure module)

**Files:**
- Create: `src/features/workflow/schema/parameterSchema.ts`
- Test: `src/features/workflow/schema/parameterSchema.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type ParamType = "string" | "number" | "integer" | "boolean"`
  - `const PARAM_TYPES: readonly ParamType[]`
  - `interface ParameterField { name: string; type: ParamType; description: string; required: boolean }`
  - `interface ParameterEntry { name: string; type: string }`
  - `function schemaToFields(schema: unknown): ParameterField[] | null`
  - `function fieldsToSchema(fields: ParameterField[]): Record<string, unknown>`
  - `function parameterEntries(schema: unknown): ParameterEntry[]`

- [ ] **Step 1: Write the failing test**

Create `src/features/workflow/schema/parameterSchema.test.ts`:

```ts
import { expect, test } from "bun:test";
import {
  PARAM_TYPES,
  fieldsToSchema,
  parameterEntries,
  schemaToFields,
  type ParameterField,
} from "./parameterSchema";

const SAMPLE = {
  type: "object",
  properties: {
    patient_name: { type: "string", description: "Patient's display name" },
    systolic: { type: "number", description: "Systolic BP" },
  },
  required: ["patient_name"],
};

test("PARAM_TYPES lists the four supported scalar types", () => {
  expect([...PARAM_TYPES]).toEqual(["string", "number", "integer", "boolean"]);
});

test("schemaToFields parses properties, descriptions, and required flags", () => {
  expect(schemaToFields(SAMPLE)).toEqual([
    { name: "patient_name", type: "string", description: "Patient's display name", required: true },
    { name: "systolic", type: "number", description: "Systolic BP", required: false },
  ]);
});

test("schemaToFields treats the default empty schema as no fields", () => {
  expect(schemaToFields({ type: "object", properties: {}, required: [] })).toEqual([]);
});

test("schemaToFields returns null for non-object roots", () => {
  expect(schemaToFields({ type: "string" })).toBeNull();
  expect(schemaToFields(null)).toBeNull();
  expect(schemaToFields("nope")).toBeNull();
});

test("schemaToFields returns null when a property is not a supported scalar", () => {
  expect(schemaToFields({ type: "object", properties: { tags: { type: "array" } } })).toBeNull();
  expect(
    schemaToFields({ type: "object", properties: { user: { type: "object" } } }),
  ).toBeNull();
  expect(
    schemaToFields({ type: "object", properties: { x: { type: "string", enum: ["a"] } } }),
  ).toBeNull();
});

test("fieldsToSchema emits properties in order and a required array", () => {
  const fields: ParameterField[] = [
    { name: "patient_name", type: "string", description: "Patient's display name", required: true },
    { name: "systolic", type: "number", description: "Systolic BP", required: false },
  ];
  expect(fieldsToSchema(fields)).toEqual(SAMPLE);
});

test("fieldsToSchema omits description when empty and required when none", () => {
  expect(fieldsToSchema([{ name: "x", type: "string", description: "", required: false }])).toEqual({
    type: "object",
    properties: { x: { type: "string" } },
    required: [],
  });
});

test("schemaToFields <-> fieldsToSchema round-trips", () => {
  const fields = schemaToFields(SAMPLE)!;
  expect(fieldsToSchema(fields)).toEqual(SAMPLE);
});

test("parameterEntries returns top-level name/type pairs", () => {
  expect(parameterEntries(SAMPLE)).toEqual([
    { name: "patient_name", type: "string" },
    { name: "systolic", type: "number" },
  ]);
});

test("parameterEntries tolerates schemas the form can't represent", () => {
  expect(parameterEntries({ type: "object", properties: { tags: { type: "array" } } })).toEqual([
    { name: "tags", type: "array" },
  ]);
  expect(parameterEntries({ type: "string" })).toEqual([]);
  expect(parameterEntries(null)).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/features/workflow/schema/parameterSchema.test.ts`
Expected: FAIL — cannot resolve `./parameterSchema`.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/workflow/schema/parameterSchema.ts`:

```ts
/**
 * Codec between a flat JSON Schema `parameterSchema` object and an editable
 * field list. `schemaToFields` returns null when the schema uses features the
 * form builder can't represent (nested objects, arrays, enums, unknown types,
 * non-object root) — that triggers raw-JSON editing in the panel.
 */

export type ParamType = "string" | "number" | "integer" | "boolean";

export const PARAM_TYPES: readonly ParamType[] = ["string", "number", "integer", "boolean"];

export interface ParameterField {
  name: string;
  type: ParamType;
  description: string;
  required: boolean;
}

/** A top-level parameter, for autocomplete labels. */
export interface ParameterEntry {
  name: string;
  type: string;
}

const ROOT_TYPE = "object";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isParamType(value: unknown): value is ParamType {
  return typeof value === "string" && (PARAM_TYPES as readonly string[]).includes(value);
}

/** True when a property object is a bare scalar the form can represent. */
function isSimpleProperty(prop: unknown): prop is { type: ParamType; description?: string } {
  if (!isPlainObject(prop)) return false;
  if (!isParamType(prop.type)) return false;
  // Only `type` and `description` are representable; anything else (enum,
  // items, format, properties, ...) must be edited as JSON.
  return Object.keys(prop).every((k) => k === "type" || k === "description");
}

/** JSON Schema object -> editable fields, or null if not form-representable. */
export function schemaToFields(schema: unknown): ParameterField[] | null {
  if (!isPlainObject(schema)) return null;
  if (schema.type !== ROOT_TYPE) return null;
  const props = schema.properties ?? {};
  if (!isPlainObject(props)) return null;
  const required = Array.isArray(schema.required) ? schema.required : [];

  const fields: ParameterField[] = [];
  for (const [name, prop] of Object.entries(props)) {
    if (!isSimpleProperty(prop)) return null;
    fields.push({
      name,
      type: prop.type,
      description: typeof prop.description === "string" ? prop.description : "",
      required: required.includes(name),
    });
  }
  return fields;
}

/** Editable fields -> JSON Schema object. */
export function fieldsToSchema(fields: ParameterField[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const f of fields) {
    const prop: Record<string, unknown> = { type: f.type };
    if (f.description) prop.description = f.description;
    properties[f.name] = prop;
    if (f.required) required.push(f.name);
  }
  return { type: ROOT_TYPE, properties, required };
}

/** Top-level { name, type } entries for autocomplete (best-effort). */
export function parameterEntries(schema: unknown): ParameterEntry[] {
  if (!isPlainObject(schema)) return [];
  const props = schema.properties;
  if (!isPlainObject(props)) return [];
  return Object.entries(props).map(([name, prop]) => ({
    name,
    type: isPlainObject(prop) && typeof prop.type === "string" ? prop.type : "",
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/features/workflow/schema/parameterSchema.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/workflow/schema/parameterSchema.ts src/features/workflow/schema/parameterSchema.test.ts
git commit -m "feat(workflow): add parameter-schema field codec

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `$parameters.` autocomplete in suggestions

**Files:**
- Modify: `src/features/workflow/expression/suggestions.ts`
- Test: `src/features/workflow/expression/suggestions.test.ts`

**Interfaces:**
- Consumes: `ParameterEntry` from `../schema/parameterSchema` (Task 1).
- Produces: `getSuggestions(input: string, nodeNames: string[], parameters?: ParameterEntry[]): Suggestion[]` — after `$parameters.`, suggests top-level field names (`value: "$parameters.<name>"`, `label: "<name> — <type>"`).

- [ ] **Step 1: Write the failing test**

Append to `src/features/workflow/expression/suggestions.test.ts`:

```ts
test("after $parameters. it suggests schema field names with type labels", () => {
  const params = [
    { name: "userId", type: "string" },
    { name: "limit", type: "number" },
  ];
  expect(getSuggestions("$parameters.", [], params)).toEqual([
    { value: "$parameters.userId", label: "userId — string" },
    { value: "$parameters.limit", label: "limit — number" },
  ]);
});

test("parameter names filter by the typed segment, case-insensitively", () => {
  const params = [
    { name: "userId", type: "string" },
    { name: "limit", type: "number" },
  ];
  expect(getSuggestions("$parameters.u", [], params).map((s) => s.label)).toEqual([
    "userId — string",
  ]);
});

test("no suggestions once a path goes deeper than the parameter name", () => {
  const params = [{ name: "user", type: "string" }];
  expect(getSuggestions("$parameters.user.id", [], params)).toEqual([]);
});

test("$parameters. with no schema yields no field suggestions", () => {
  expect(getSuggestions("$parameters.", [])).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/features/workflow/expression/suggestions.test.ts`
Expected: FAIL — `$parameters.` returns `[]` (no field handling yet).

- [ ] **Step 3: Write minimal implementation**

Replace the body of `src/features/workflow/expression/suggestions.ts` with:

```ts
import { CONTEXT_SOURCES } from "../constants";
import type { ParameterEntry } from "../schema/parameterSchema";

/** One autocomplete suggestion: `value` replaces the input, `label` is shown. */
export interface Suggestion {
  value: string;
  label: string;
}

const NODES_SOURCE = "$nodes";
const PARAMETERS_SOURCE = "$parameters";
const SEP = ".";

/**
 * Suggestions for the current operand `input`:
 * - empty or a `$` prefix -> matching source names
 * - after `$nodes.` (node-name segment) -> live node names
 * - after `$parameters.` (field segment) -> schema field names + type
 * - anything deeper -> no suggestions (free-form)
 */
export function getSuggestions(
  input: string,
  nodeNames: string[],
  parameters: ParameterEntry[] = [],
): Suggestion[] {
  const text = input.trimStart();
  const nodesPrefix = NODES_SOURCE + SEP;
  const paramsPrefix = PARAMETERS_SOURCE + SEP;

  if (text.startsWith(nodesPrefix)) {
    const rest = text.slice(nodesPrefix.length);
    if (rest.includes(SEP)) return []; // past the node-name segment
    const needle = rest.toLowerCase();
    return nodeNames
      .filter((name) => name.toLowerCase().startsWith(needle))
      .map((name) => ({ value: `${nodesPrefix}${name}${SEP}`, label: name }));
  }

  if (text.startsWith(paramsPrefix)) {
    const rest = text.slice(paramsPrefix.length);
    if (rest.includes(SEP)) return []; // past the field-name segment
    const needle = rest.toLowerCase();
    return parameters
      .filter((p) => p.name.toLowerCase().startsWith(needle))
      .map((p) => ({ value: `${paramsPrefix}${p.name}`, label: `${p.name} — ${p.type}` }));
  }

  if (text === "" || text.startsWith("$")) {
    const needle = text.toLowerCase();
    return CONTEXT_SOURCES.filter((s) => s.toLowerCase().startsWith(needle)).map((s) => ({
      value: s === NODES_SOURCE ? `${s}${SEP}` : s,
      label: s,
    }));
  }

  return [];
}
```

Note: the `$nodes` source still gets a trailing dot from the prefix list; `$parameters` does not, so the existing "filters sources" / `$nodes` tests stay green.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/features/workflow/expression/suggestions.test.ts`
Expected: PASS (all 7 original + 4 new tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/workflow/expression/suggestions.ts src/features/workflow/expression/suggestions.test.ts
git commit -m "feat(workflow): suggest \$parameters fields from the schema

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `updateParameterSchema` reducer

**Files:**
- Modify: `src/features/workflow/workflowSlice.ts`
- Test: `src/features/workflow/workflowSlice.test.ts`

**Interfaces:**
- Consumes: existing slice state (`state.meta.parameterSchema`).
- Produces: action creator `updateParameterSchema(schema: Record<string, unknown>)`; exported from the slice barrel.

- [ ] **Step 1: Write the failing test**

In `src/features/workflow/workflowSlice.test.ts`, add `updateParameterSchema` to the existing named import from `./workflowSlice` (the default import is `reducer`):

```ts
import reducer, {
  addNode,
  connected,
  renameNode,
  setWorkflow,
  updateNodeData,
  updateParameterSchema,
} from "./workflowSlice";
```

Then append this test (it reuses the `empty` fixture already defined in the file):

```ts
test("updateParameterSchema replaces meta.parameterSchema", () => {
  const schema = {
    type: "object",
    properties: { userId: { type: "string" } },
    required: ["userId"],
  };
  const state = reducer(empty, updateParameterSchema(schema));
  expect(state.meta.parameterSchema).toEqual(schema);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/features/workflow/workflowSlice.test.ts`
Expected: FAIL — `updateParameterSchema` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/features/workflow/workflowSlice.ts`, add a reducer inside the `reducers` object (next to `updateNodeData`):

```ts
    updateParameterSchema(state, action: PayloadAction<Record<string, unknown>>) {
      state.meta.parameterSchema = action.payload;
    },
```

Then add `updateParameterSchema` to the destructured `slice.actions` export:

```ts
export const {
  nodesChanged,
  edgesChanged,
  connected,
  addNode,
  updateNodeData,
  updateParameterSchema,
  renameNode,
  setWorkflow,
} = slice.actions;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/features/workflow/workflowSlice.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/workflow/workflowSlice.ts src/features/workflow/workflowSlice.test.ts
git commit -m "feat(workflow): add updateParameterSchema reducer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Relocate Inspector to the bottom

**Files:**
- Modify: `src/features/workflow/Inspector.tsx`
- Modify: `src/features/workflow/WorkflowBuilderPage.tsx`

**Interfaces:**
- Consumes: `updateParameterSchema` (not used here), existing slice selectors.
- Produces:
  - `Inspector` props change to `{ height: number; onHeightChange: (height: number) => void; onClose: () => void }`.
  - Exported constants `INSPECTOR_MIN_HEIGHT`, `INSPECTOR_MAX_HEIGHT`, `INSPECTOR_DEFAULT_HEIGHT` (replacing the `*_WIDTH` ones).

- [ ] **Step 1: Update the Inspector to a bottom panel**

In `src/features/workflow/Inspector.tsx`, replace the width constants/clamp, the `InspectorProps` interface, the `startResize` function, the `<aside>` opening tag, and the resize-handle `<div>`:

Replace:
```ts
/** Resizable-panel width bounds (px). */
export const INSPECTOR_MIN_WIDTH = 240;
export const INSPECTOR_MAX_WIDTH = 560;
export const INSPECTOR_DEFAULT_WIDTH = 288;

const clamp = (n: number) => Math.min(INSPECTOR_MAX_WIDTH, Math.max(INSPECTOR_MIN_WIDTH, n));

interface InspectorProps {
  width: number;
  onWidthChange: (width: number) => void;
  onClose: () => void;
}

export function Inspector({ width, onWidthChange, onClose }: InspectorProps) {
```
With:
```ts
/** Resizable-panel height bounds (px). */
export const INSPECTOR_MIN_HEIGHT = 160;
export const INSPECTOR_MAX_HEIGHT = 560;
export const INSPECTOR_DEFAULT_HEIGHT = 240;

const clamp = (n: number) => Math.min(INSPECTOR_MAX_HEIGHT, Math.max(INSPECTOR_MIN_HEIGHT, n));

interface InspectorProps {
  height: number;
  onHeightChange: (height: number) => void;
  onClose: () => void;
}

export function Inspector({ height, onHeightChange, onClose }: InspectorProps) {
```

Replace the `startResize` comment + body:
```ts
  // Panel is anchored to the right edge, so its width grows as the pointer
  // moves left: width = viewport width - pointer x.
  function startResize(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const onMove = (ev: PointerEvent) => onWidthChange(clamp(window.innerWidth - ev.clientX));
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
```
With:
```ts
  // Panel is anchored to the bottom edge, so its height grows as the pointer
  // moves up: height = viewport height - pointer y.
  function startResize(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const onMove = (ev: PointerEvent) => onHeightChange(clamp(window.innerHeight - ev.clientY));
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
```

Replace the `<aside>` opening tag:
```tsx
    <aside
      style={{ width }}
      className="relative flex shrink-0 flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
```
With:
```tsx
    <aside
      style={{ height }}
      className="relative flex w-full shrink-0 flex-col border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
```

Replace the resize-handle `<div>`:
```tsx
      <div
        onPointerDown={startResize}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize inspector"
        className="absolute inset-y-0 left-0 z-10 w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-primary/40"
      />
```
With:
```tsx
      <div
        onPointerDown={startResize}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize inspector"
        className="absolute inset-x-0 top-0 z-10 h-1.5 -translate-y-1/2 cursor-row-resize hover:bg-primary/40"
      />
```

- [ ] **Step 2: Wire the bottom layout in the page**

In `src/features/workflow/WorkflowBuilderPage.tsx`:

Change the import:
```ts
import { Inspector, INSPECTOR_DEFAULT_WIDTH } from "./Inspector";
```
to:
```ts
import { Inspector, INSPECTOR_DEFAULT_HEIGHT } from "./Inspector";
```

Change the state line:
```ts
  const [inspectorWidth, setInspectorWidth] = useState(INSPECTOR_DEFAULT_WIDTH);
```
to:
```ts
  const [inspectorHeight, setInspectorHeight] = useState(INSPECTOR_DEFAULT_HEIGHT);
```

Replace the canvas + inspector region:
```tsx
          <div className="min-w-0 flex-1">
            <WorkflowCanvas />
          </div>
          {inspectorOpen && (
            <Inspector
              width={inspectorWidth}
              onWidthChange={setInspectorWidth}
              onClose={() => setInspectorOpen(false)}
            />
          )}
```
With:
```tsx
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1">
              <WorkflowCanvas />
            </div>
            {inspectorOpen && (
              <Inspector
                height={inspectorHeight}
                onHeightChange={setInspectorHeight}
                onClose={() => setInspectorOpen(false)}
              />
            )}
          </div>
```

- [ ] **Step 3: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Visually verify**

Run: `bun dev`, open the app. Confirm: the Inspector now sits below the canvas (full width), select a node and the canvas shrinks to fit above it, the top edge drag resizes its height, and the × closes it.

- [ ] **Step 5: Commit**

```bash
git add src/features/workflow/Inspector.tsx src/features/workflow/WorkflowBuilderPage.tsx
git commit -m "feat(workflow): move node inspector to a resizable bottom panel

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Parameters panel + toolbar toggle

**Files:**
- Create: `src/features/workflow/ParametersPanel.tsx`
- Modify: `src/features/workflow/Toolbar.tsx`
- Modify: `src/features/workflow/WorkflowBuilderPage.tsx`

**Interfaces:**
- Consumes: `schemaToFields`, `fieldsToSchema`, `PARAM_TYPES`, `ParameterField`, `ParamType` (Task 1); `updateParameterSchema` (Task 3); store selector `s.workflow.meta.parameterSchema`.
- Produces:
  - `ParametersPanel` with props `{ width: number; onWidthChange: (width: number) => void; onClose: () => void }`.
  - Exported constants `PARAMETERS_MIN_WIDTH`, `PARAMETERS_MAX_WIDTH`, `PARAMETERS_DEFAULT_WIDTH`.
  - `Toolbar` props gain `parametersOpen: boolean; onToggleParameters: () => void`.

- [ ] **Step 1: Create the ParametersPanel**

Create `src/features/workflow/ParametersPanel.tsx`:

```tsx
import {
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateParameterSchema } from "./workflowSlice";
import {
  PARAM_TYPES,
  fieldsToSchema,
  schemaToFields,
  type ParameterField,
  type ParamType,
} from "./schema/parameterSchema";

/** Resizable-panel width bounds (px). */
export const PARAMETERS_MIN_WIDTH = 280;
export const PARAMETERS_MAX_WIDTH = 640;
export const PARAMETERS_DEFAULT_WIDTH = 340;

const clamp = (n: number) =>
  Math.min(PARAMETERS_MAX_WIDTH, Math.max(PARAMETERS_MIN_WIDTH, n));

type Mode = "builder" | "json";

const UNSUPPORTED_MSG =
  "This schema can't be edited in the builder (nested objects, arrays, enums, …). Keep editing as JSON.";

const emptyField = (): ParameterField => ({
  name: "",
  type: "string",
  description: "",
  required: false,
});

function safeParse(text: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(text);
    return typeof v === "object" && v !== null && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

interface ParametersPanelProps {
  width: number;
  onWidthChange: (width: number) => void;
  onClose: () => void;
}

export function ParametersPanel({ width, onWidthChange, onClose }: ParametersPanelProps) {
  const dispatch = useAppDispatch();
  const schema = useAppSelector((s) => s.workflow.meta.parameterSchema);

  // Parse once for initial mode; edits drive the store thereafter.
  const initialFields = useMemo(() => schemaToFields(schema), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [mode, setMode] = useState<Mode>(initialFields ? "builder" : "json");
  const [fields, setFields] = useState<ParameterField[]>(initialFields ?? []);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(schema, null, 2));
  const [jsonError, setJsonError] = useState("");

  function commitFields(next: ParameterField[]) {
    setFields(next);
    dispatch(updateParameterSchema(fieldsToSchema(next)));
  }

  function updateField(index: number, patch: Partial<ParameterField>) {
    const next = fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
    commitFields(next);
  }

  function removeField(index: number) {
    commitFields(fields.filter((_, i) => i !== index));
  }

  function updateJson(text: string) {
    setJsonText(text);
    const parsed = safeParse(text);
    if (parsed === null) {
      setJsonError("Invalid JSON object");
      return;
    }
    setJsonError("");
    dispatch(updateParameterSchema(parsed));
  }

  function switchToJson() {
    setJsonText(JSON.stringify(fieldsToSchema(fields), null, 2));
    setJsonError("");
    setMode("json");
  }

  function switchToBuilder() {
    const parsed = schemaToFields(safeParse(jsonText));
    if (parsed) {
      setFields(parsed);
      setJsonError("");
      setMode("builder");
    } else {
      setJsonError(UNSUPPORTED_MSG);
    }
  }

  // Panel is anchored to the right edge, so its width grows as the pointer
  // moves left: width = viewport width - pointer x.
  function startResize(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const onMove = (ev: PointerEvent) => onWidthChange(clamp(window.innerWidth - ev.clientX));
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <aside
      style={{ width }}
      className="relative flex shrink-0 flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div
        onPointerDown={startResize}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize parameters panel"
        className="absolute inset-y-0 left-0 z-10 w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-primary/40"
      />

      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Parameters
        </span>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-slate-300 dark:border-slate-600">
            <button
              type="button"
              onClick={switchToBuilder}
              className={`px-2 py-0.5 text-xs ${
                mode === "builder"
                  ? "bg-primary text-white"
                  : "bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              Builder
            </button>
            <button
              type="button"
              onClick={switchToJson}
              className={`px-2 py-0.5 text-xs ${
                mode === "json"
                  ? "bg-primary text-white"
                  : "bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              JSON
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close parameters panel"
            className="rounded-md px-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ×
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {mode === "builder" ? (
          <>
            {fields.length === 0 && (
              <p className="text-sm text-slate-400">No parameters yet.</p>
            )}
            {fields.map((field, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={field.name}
                    placeholder="name"
                    onChange={(e) => updateField(i, { name: e.target.value })}
                    aria-label="Parameter name"
                    className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <select
                    value={field.type}
                    onChange={(e) => updateField(i, { type: e.target.value as ParamType })}
                    aria-label="Parameter type"
                    className="rounded-md border border-slate-300 bg-white px-1 py-1 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {PARAM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeField(i)}
                    aria-label="Remove parameter"
                    className="px-1 py-1 text-xs text-slate-400 hover:text-rose-500"
                  >
                    ✕
                  </button>
                </div>
                <input
                  type="text"
                  value={field.description}
                  placeholder="description"
                  onChange={(e) => updateField(i, { description: e.target.value })}
                  aria-label="Parameter description"
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateField(i, { required: e.target.checked })}
                  />
                  required
                </label>
              </div>
            ))}
            <button
              type="button"
              onClick={() => commitFields([...fields, emptyField()])}
              className="self-start rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              + Add parameter
            </button>
          </>
        ) : (
          <textarea
            value={jsonText}
            onChange={(e) => updateJson(e.target.value)}
            spellCheck={false}
            rows={16}
            className="w-full rounded-md border border-slate-300 bg-white p-2 font-mono text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        )}
        {jsonError && <p className="text-xs text-rose-500">{jsonError}</p>}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Add the Toolbar toggle**

In `src/features/workflow/Toolbar.tsx`, extend the props interface:
```ts
interface ToolbarProps {
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  parametersOpen: boolean;
  onToggleParameters: () => void;
}

export function Toolbar({
  inspectorOpen,
  onToggleInspector,
  parametersOpen,
  onToggleParameters,
}: ToolbarProps) {
```

Add a Parameters button immediately before the existing Inspector button:
```tsx
      <button
        className={parametersOpen ? btnActive : btn}
        onClick={onToggleParameters}
        aria-pressed={parametersOpen}
        title="Toggle parameters panel"
      >
        Parameters
      </button>
```

- [ ] **Step 3: Wire the panel into the page**

In `src/features/workflow/WorkflowBuilderPage.tsx`:

Add the import:
```ts
import { ParametersPanel, PARAMETERS_DEFAULT_WIDTH } from "./ParametersPanel";
```

Add state (next to the inspector state):
```ts
  const [parametersOpen, setParametersOpen] = useState(false);
  const [parametersWidth, setParametersWidth] = useState(PARAMETERS_DEFAULT_WIDTH);
```

Pass the new props to `<Toolbar>`:
```tsx
      <Toolbar
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((o) => !o)}
        parametersOpen={parametersOpen}
        onToggleParameters={() => setParametersOpen((o) => !o)}
      />
```

Add the panel as the last child of the row `<div className="flex min-h-0 flex-1">`, after the center column closes and before the row `</div>`:
```tsx
          {parametersOpen && (
            <ParametersPanel
              width={parametersWidth}
              onWidthChange={setParametersWidth}
              onClose={() => setParametersOpen(false)}
            />
          )}
```

- [ ] **Step 4: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Visually verify**

Run: `bun dev`. Click **Parameters** in the toolbar → a right panel opens. Add a parameter (name `userId`, type `string`, check required, add a description). Toggle **JSON** → see `{ "type": "object", "properties": { "userId": { "type": "string", "description": "…" } }, "required": ["userId"] }`. Edit JSON to add a second field, toggle back to **Builder** → both fields show. Drag the left edge to resize; × closes the panel.

- [ ] **Step 6: Commit**

```bash
git add src/features/workflow/ParametersPanel.tsx src/features/workflow/Toolbar.tsx src/features/workflow/WorkflowBuilderPage.tsx
git commit -m "feat(workflow): add parameter schema panel with builder and json modes

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Thread `$parameters` into expression autocomplete

**Files:**
- Modify: `src/features/workflow/components/ExpressionInput.tsx`
- Modify: `src/features/workflow/condition/ConditionEditor.tsx`
- Modify: `src/features/workflow/condition/ConditionBuilder.tsx`
- Modify: `src/features/workflow/Inspector.tsx`

**Interfaces:**
- Consumes: `getSuggestions(input, nodeNames, parameters?)` (Task 2); `parameterEntries`, `ParameterEntry` (Task 1).
- Produces: `parameters: ParameterEntry[]` prop added to `ExpressionInput`, `ConditionEditor`, and `ConditionBuilder` (alongside the existing `nodeNames`).

- [ ] **Step 1: ExpressionInput forwards parameters**

In `src/features/workflow/components/ExpressionInput.tsx`:

Add the import:
```ts
import type { ParameterEntry } from "../schema/parameterSchema";
```

Extend props and destructuring:
```ts
interface ExpressionInputProps {
  value: string;
  onChange: (value: string) => void;
  nodeNames: string[];
  parameters: ParameterEntry[];
  placeholder?: string;
  className?: string;
}

export function ExpressionInput({
  value,
  onChange,
  nodeNames,
  parameters,
  placeholder,
  className,
}: ExpressionInputProps) {
```

Update the suggestions memo:
```ts
  const suggestions = useMemo(
    () => getSuggestions(value, nodeNames, parameters),
    [value, nodeNames, parameters],
  );
```

- [ ] **Step 2: ConditionBuilder passes parameters through**

In `src/features/workflow/condition/ConditionBuilder.tsx`:

Add the import:
```ts
import type { ParameterEntry } from "../schema/parameterSchema";
```

Add `parameters` to `BuilderProps` and the function signature:
```ts
interface BuilderProps {
  group: Group;
  nodeNames: string[];
  parameters: ParameterEntry[];
  onChange: (group: Group) => void;
  onRemove?: () => void;
  depth?: number;
}

export function ConditionBuilder({
  group,
  nodeNames,
  parameters,
  onChange,
  onRemove,
  depth = 0,
}: BuilderProps) {
```

Pass `parameters` to the nested `<ConditionBuilder>` and both `<ComparisonRow>` usages:
```tsx
            <ConditionBuilder
              key={child.id}
              group={child}
              nodeNames={nodeNames}
              parameters={parameters}
              depth={depth + 1}
              onChange={(g) => updateChild(i, g)}
              onRemove={() => removeChild(i)}
            />
```
```tsx
            <ComparisonRow
              key={child.id}
              comparison={child}
              nodeNames={nodeNames}
              parameters={parameters}
              onChange={(c) => updateChild(i, c)}
              onRemove={() => removeChild(i)}
            />
```

Add `parameters` to `RowProps` and `ComparisonRow`, and pass it to both `<ExpressionInput>`s:
```ts
interface RowProps {
  comparison: Comparison;
  nodeNames: string[];
  parameters: ParameterEntry[];
  onChange: (c: Comparison) => void;
  onRemove: () => void;
}

function ComparisonRow({ comparison, nodeNames, parameters, onChange, onRemove }: RowProps) {
```
```tsx
        <ExpressionInput
          value={comparison.left}
          nodeNames={nodeNames}
          parameters={parameters}
          placeholder="$state.age"
          onChange={(left) => onChange({ ...comparison, left })}
        />
```
```tsx
        <ExpressionInput
          value={comparison.right}
          nodeNames={nodeNames}
          parameters={parameters}
          placeholder="18"
          onChange={(right) => onChange({ ...comparison, right })}
        />
```

- [ ] **Step 3: ConditionEditor passes parameters through**

In `src/features/workflow/condition/ConditionEditor.tsx`:

Add the import:
```ts
import type { ParameterEntry } from "../schema/parameterSchema";
```

Add `parameters` to props and destructuring:
```ts
interface ConditionEditorProps {
  condition: JsonLogicValue;
  nodeNames: string[];
  parameters: ParameterEntry[];
  onChange: (condition: JsonLogicValue) => void;
}

export function ConditionEditor({ condition, nodeNames, parameters, onChange }: ConditionEditorProps) {
```

Pass it to `<ConditionBuilder>`:
```tsx
        <ConditionBuilder group={tree} nodeNames={nodeNames} parameters={parameters} onChange={updateTree} />
```

- [ ] **Step 4: Inspector supplies parameters from the store**

In `src/features/workflow/Inspector.tsx`:

Add the import:
```ts
import { parameterEntries } from "./schema/parameterSchema";
```

Derive entries from the store (next to `const nodeNames = nodes.map((n) => n.id);`). Add a selector for the schema near the top of the component (next to the existing `nodes` selector):
```ts
  const parameterSchema = useAppSelector((s) => s.workflow.meta.parameterSchema);
```
And below, where `nodeNames` is defined:
```ts
  const parameters = parameterEntries(parameterSchema);
```

Pass `parameters` to `<ConditionEditor>`:
```tsx
              <ConditionEditor
                key={selected.id}
                condition={(data.parameters?.[CONDITION_KEY] ?? {}) as JsonLogicValue}
                nodeNames={nodeNames}
                parameters={parameters}
                onChange={(next) =>
```

- [ ] **Step 5: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Visually verify the end-to-end autocomplete**

Run: `bun dev`. In the **Parameters** panel add fields `systolic` (number) and `patient_email` (string). Add an `if` node, select it (Inspector at the bottom), add a condition, and in the left operand type `$parameters.` → both fields appear as `systolic — number` / `patient_email — string`. Type `$parameters.sy` → only `systolic — number`. Selecting it fills `$parameters.systolic`.

- [ ] **Step 7: Commit**

```bash
git add src/features/workflow/components/ExpressionInput.tsx src/features/workflow/condition/ConditionEditor.tsx src/features/workflow/condition/ConditionBuilder.tsx src/features/workflow/Inspector.tsx
git commit -m "feat(workflow): wire \$parameters autocomplete into the condition editor

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Documentation + full verification

**Files:**
- Modify: `src/features/workflow/CLAUDE.md`

**Interfaces:**
- Consumes: everything above.
- Produces: updated feature docs.

- [ ] **Step 1: Update the feature CLAUDE.md**

In `src/features/workflow/CLAUDE.md`, under the **Files** list, update the Inspector line and add two entries:

- Change the `Inspector.tsx` bullet to note it is now a **bottom** panel:
  `Inspector.tsx — bottom properties panel for the selected node (height-resizable, closable). Edits description and, for if nodes, the condition.`
- Add: `ParametersPanel.tsx — right-side, toggleable panel that edits the workflow-level parameterSchema (form builder + raw-JSON fallback).`
- Add: `schema/parameterSchema.ts — pure codec between the JSON Schema parameterSchema and an editable field list; parameterEntries() feeds $parameters autocomplete.`
- Update the `WorkflowBuilderPage.tsx` bullet: `page-level layout (toolbar + sidebar + canvas with a bottom inspector + right parameters panel).`

Under **Conventions**, add:
- `The workflow's parameterSchema (a JSON Schema object) is edited only via ParametersPanel and written through the updateParameterSchema reducer. Its top-level fields drive $parameters.<field> autocomplete (parameterEntries → ConditionEditor → ConditionBuilder → ExpressionInput → getSuggestions). The builder represents only scalar fields (string/number/integer/boolean); anything else falls back to JSON editing.`

- [ ] **Step 2: Full test suite**

Run: `bun test`
Expected: all tests pass (incl. new `parameterSchema`, `suggestions`, `workflowSlice` cases).

- [ ] **Step 3: Full type-check**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/workflow/CLAUDE.md
git commit -m "docs(workflow): document parameter schema panel and bottom inspector

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review notes

- **Spec coverage:** §1 layout → Tasks 4 (bottom inspector) + 5 (right panel/toggle); §2 schema model/editor → Tasks 1 (codec) + 5 (panel) + 3 (reducer); §3 autocomplete → Tasks 2 (logic) + 6 (wiring); §4 state/serialization → Task 3 (reducer; no DTO change, as specified); Testing → Tasks 1/2/3 (bun test) + 4/5/6 (tsc) + 7 (full run).
- **Type consistency:** `ParameterEntry`/`ParameterField`/`ParamType`/`PARAM_TYPES` defined in Task 1 and reused verbatim in Tasks 2, 5, 6. `updateParameterSchema(Record<string, unknown>)` defined in Task 3, consumed in Task 5. `getSuggestions(input, nodeNames, parameters?)` defined in Task 2, called in Task 1's-type-aware Task 6. Inspector prop rename `width→height` (Task 4) matches the page wiring.
- **No placeholders:** every code step shows complete code; commands include expected output.
