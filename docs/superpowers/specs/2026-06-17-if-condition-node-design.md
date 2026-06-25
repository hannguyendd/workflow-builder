# Design: "If" (condition) node for the workflow builder

Date: 2026-06-17
Branch: `feat/workflow-if-node` (from `feat/workflow-builder-ui`)

## Goal

Add an **If / condition** node to the workflow builder. The node branches the
graph into `true` / `false` paths based on a **JSON Logic** condition, matching
the chat service's `ConditionNode`
(`taggle-ext-chat/packages/domain/domain/workflow/nodes/condition.py`).

Before building the node, introduce a **reusable expression input** with
autocomplete for variable paths, so operands can reference workflow values the
same way the chat service resolves them.

## Target schema (chat service — authoritative)

- The if node is `NodeType.CONDITION` → serialized `type: "if"`.
- The condition is **JSON Logic** (a `dict`) stored in `parameters.condition`,
  e.g. `{ ">": [ { "var": "$state.age" }, 18 ] }`.
- It has exactly two outgoing edges, labelled `true` / `false`
  (`ConditionEdge.TRUE` / `ConditionEdge.FALSE`). The engine uses the *first*
  edge per label.
- `{ "var": "<path>" }` references values via variable paths. Sources
  (`ContextSource`): `$state`, `$config`, `$variables`, `$parameters`,
  `$nodes.<node_name>.<path>`, `$trigger`. A bare key falls back to state.
- `expression.py` (`is_variable_path`, `parse_literal`) defines how a string is
  classified as a variable path vs. a literal — the frontend mirrors this.

## Decisions (from brainstorming)

1. **Condition UX:** visual builder **+ raw-JSON fallback**.
2. **Edit location:** a **right inspector panel** (reusable for future nodes).
3. **Nesting:** the builder supports **arbitrary nested AND/OR groups**.
4. **Autocomplete:** suggest the 6 `$`-sources, and after `$nodes.` suggest the
   **live node names** from the current graph.
5. Operator set (decided): `== != > >= < <= in`. No strict `===`/`!==` or unary
   truthiness yet.
6. Node **rename is out of scope** — a node's `name` is its xyflow `id`;
   renaming would break edges. The inspector shows the name read-only.

## Architecture

### 1. Shared constants — `src/features/workflow/constants.ts`

Mirror the relevant parts of the chat service's `core/constants/workflow.py`
(also removes the existing inline `"start"`/`"end"` magic strings in the slice):

- `NodeType` (`START="start"`, `END="end"`, `IF="if"`, …)
- `EdgeLabel.MAIN="main"`, `ConditionEdge.TRUE="true"` / `FALSE="false"`
- `CONTEXT_SOURCES = ["$state","$config","$variables","$parameters","$nodes","$trigger"]`

### 2. Shared `ExpressionInput` — `src/features/workflow/components/ExpressionInput.tsx`

A controlled text input with a hand-rolled suggestion dropdown (no UI-kit, per
the constitution). Presentational only: props `{ value, onChange, nodeNames,
placeholder }`. Keyboard nav (↑/↓/Enter/Esc) + click to accept.

Backed by two pure, unit-testable modules under `src/features/workflow/expression/`:

- `suggestions.ts` — `getSuggestions(input, nodeNames)`: suggests the 6
  `$`-sources; after `$nodes.` suggests the `nodeNames` passed in; free-form
  afterward.
- `operand.ts` — `operandToJsonLogic(text)` / `jsonLogicToOperand(node)`.
  Mirrors `is_variable_path` + `parse_literal`: a `$…` or `a.b.c` path →
  `{ "var": path }`; `42`/`true`/`false`/`null` → literal; otherwise a string
  literal. This is the bridge between a text operand and a JSON Logic operand.

### 3. Condition model + JSON Logic codec — `src/features/workflow/condition/`

`types.ts`:

```ts
type CombineOp = "and" | "or";
type CompareOp = "==" | "!=" | ">" | ">=" | "<" | "<=" | "in";
interface Comparison { kind: "comparison"; id: string; left: string; op: CompareOp; right: string }
interface Group { kind: "group"; id: string; combinator: CombineOp; children: ConditionTree[] }
type ConditionTree = Group | Comparison;
```

`jsonLogic.ts`:

- `treeToJsonLogic(tree)` → `{ and|or: [...] }` / `{ <op>: [leftJL, rightJL] }`.
- `jsonLogicToTree(jl)` → `ConditionTree | null`. Returns `null` when the JSON
  can't be represented by the builder (unknown operator, hand-written shape).
  `null` is the trigger to open the editor in raw-JSON mode.

### 4. Condition editor UI — `src/features/workflow/condition/`

- `ConditionBuilder.tsx` — recursive. A `Group` renders its AND/OR toggle, its
  child rows / sub-groups, and "+ Add condition" / "+ Add group". A `Comparison`
  renders `ExpressionInput` (left) · operator `<select>` · `ExpressionInput`
  (right) · remove. Supports arbitrary nesting.
- `ConditionEditor.tsx` — wraps the builder + a **Builder / JSON** toggle. On
  load it tries `jsonLogicToTree`; if `null`, it starts in JSON mode. JSON mode
  is a textarea with a transient text buffer (local state) that writes back to
  Redux only when it parses as valid JSON.

**Editing-state rule:** the persisted condition (JSON Logic) lives in Redux at
`node.data.parameters.condition` — the single source of truth. The builder keeps
a local tree (with stable `id`s for React keys / input focus), re-seeded via
`key={selectedNodeId}` when selection changes, and dispatches the serialized
JSON Logic on every edit. This matches how `Toolbar` already uses local
`useState` for transient UI while graph state stays in Redux.

### 5. Inspector panel — `src/features/workflow/Inspector.tsx`

Reads the selected node via xyflow's existing `selected` flag
(`nodes.find(n => n.selected)`) — no new selection state. Shows node type, name
(read-only), an editable description, and for `type === "if"` renders
`ConditionEditor`. Mounted on the right in `WorkflowBuilderPage`; visible only
when a node is selected.

### 6. `IfNode` + wiring

- `nodes/IfNode.tsx` — a card with one **target** handle (top) and two **source**
  handles with ids `true` / `false` (labelled, colour-coded), plus a one-line
  summary of the condition.
- Register `if` in `nodes/nodeTypes.ts`; add `{ type: "if", label: "If / Condition" }`
  to `PALETTE_ITEMS` in `nodes/dragData.ts`.

### 7. Slice changes — `workflowSlice.ts`

- `nodeData("if")` seeds `parameters: { condition: {} }`.
- `connected`: set the edge label from the source handle —
  `label = c.sourceHandle ?? EdgeLabel.MAIN`. The if node's handles are
  `true`/`false`; every other node uses the default handle → `"main"`. No
  node-type special-casing.
- Add `updateNodeData({ id, data })` reducer for the inspector to patch
  `description` / `parameters`.

### 8. Serialization — no schema change

`parameters.condition` and edge `label`s already round-trip through
`serialize.ts`. The if node serializes to `type: "if"` with
`parameters.condition` (JSON Logic) and `true`/`false` edges, matching the chat
service's `ConditionNodeBuilder`.

## Data flow

1. User drags **If / Condition** from the palette → `addNode("if")` seeds
   `parameters.condition = {}`.
2. User selects the node → `Inspector` renders `ConditionEditor` with the node's
   `parameters.condition`.
3. `ConditionEditor` parses JSON Logic → tree (or JSON mode if unrepresentable).
   Edits update the local tree, serialize to JSON Logic, and dispatch
   `updateNodeData`.
4. User connects from the `true` / `false` handles → `connected` records edges
   labelled `true` / `false`.
5. `Save` → `toWorkflowDto` emits `type: "if"`, `parameters.condition`, and the
   labelled edges.

## Testing (`bun test`)

- `condition/jsonLogic.test.ts` — nested round-trip (`treeToJsonLogic` ∘
  `jsonLogicToTree`) and `null` on unrepresentable JSON.
- `expression/operand.test.ts` — var-path vs. literal classification.
- `expression/suggestions.test.ts` — suggestion computation incl. `$nodes.` +
  live node names.
- `workflowSlice.test.ts` — `addNode("if")` seeds condition; `connected` derives
  `true`/`false` labels from the source handle; `updateNodeData` patches data.
- `serialize.test.ts` — if-node + true/false edge round-trip.

## Out of scope / known limitations

- **Single edge per branch:** the engine uses the first `true`/`false` edge; the
  UI does not restrict each handle to one connection (noted, not enforced).
- **Node rename** (name = id).
- Strict equality (`===`/`!==`), unary truthiness, and `$nodes.<name>.<field>`
  output-field autocomplete (only node *names* are suggested).
- Nested-group autocomplete for output fields by node type.

## File summary

New:
- `src/features/workflow/constants.ts`
- `src/features/workflow/components/ExpressionInput.tsx`
- `src/features/workflow/expression/suggestions.ts`
- `src/features/workflow/expression/operand.ts`
- `src/features/workflow/condition/types.ts`
- `src/features/workflow/condition/jsonLogic.ts`
- `src/features/workflow/condition/ConditionBuilder.tsx`
- `src/features/workflow/condition/ConditionEditor.tsx`
- `src/features/workflow/Inspector.tsx`
- `src/features/workflow/nodes/IfNode.tsx`
- tests listed above

Changed:
- `src/features/workflow/workflowSlice.ts` (constants, `nodeData("if")`,
  `connected` label, `updateNodeData`)
- `src/features/workflow/nodes/nodeTypes.ts` (register `if`)
- `src/features/workflow/nodes/dragData.ts` (palette item)
- `src/features/workflow/WorkflowBuilderPage.tsx` (mount inspector)
- `src/features/workflow/CLAUDE.md` (document new pieces)
