# src/features/workflow

The workflow builder feature: a visual graph editor built on `@xyflow/react`, backed by a Redux slice, that serializes to/from the persisted `WorkflowDto`.

## Files

- `index.ts` — public surface of the feature. Re-exports `WorkflowBuilderPage` and `workflowReducer`. Import the feature through this barrel from outside the folder.
- `WorkflowBuilderPage.tsx` — page-level layout (toolbar + sidebar + canvas + inspector).
- `WorkflowCanvas.tsx` — the `ReactFlow` canvas. Reads `nodes`/`edges` from the store and dispatches `nodesChanged` / `edgesChanged` / `connected`. Registers custom `nodeTypes`.
- `Toolbar.tsx` — actions (add node, save/load, etc.).
- `Inspector.tsx` — right-side properties panel for the selected node (xyflow `selected` flag). Edits `description` and, for `if` nodes, the condition.
- `constants.ts` — frontend mirror of the chat service's `core/constants/workflow.py` (`NodeType`, `EdgeLabel`, `ConditionEdge`, `CONTEXT_SOURCES`). Guarded by `constants.test.ts`.
- `workflowSlice.ts` — Redux Toolkit slice. State is a `SerializableWorkflow`. Actions: `nodesChanged`, `edgesChanged`, `connected`, `addNode`, `updateNodeData`, `setWorkflow`. Seeds an initial Start + End node.
- `serialize.ts` — `toWorkflowDto` / `fromWorkflowDto`, the only place that maps between store shape and persisted JSON.
- `components/ExpressionInput.tsx` — reusable autocomplete text input for `$source.path` operands.
- `expression/` — pure operand codec (`operand.ts`) and autocomplete logic (`suggestions.ts`).
- `condition/` — JSON Logic condition: tree model (`types.ts`), codec (`jsonLogic.ts`), one-line summary (`summarize.ts`), and the editor UI (`ConditionBuilder.tsx`, `ConditionEditor.tsx`).
- `nodes/` — custom xyflow node components (`StartNode`, `EndNode`, `IfNode` — one target handle, two source handles `true`/`false`) and the `nodeTypes` registry.
- `*.test.ts` — `bun test` specs for the slice, serializer, constants, and the pure expression/condition modules.

## Conventions

- **State lives in the slice, not in components.** Components are thin: select from the store and dispatch actions. Use the typed hooks from `@/store/hooks`.
- Nodes/edges are stored as plain xyflow `Node`/`Edge`. Every node's `data` matches `WorkflowNodeData` (`{ description, parameters }`).
- Mutations go through `applyNodeChanges` / `applyEdgeChanges` / `addEdge` inside reducers (xyflow helpers), keeping the slice the single source of truth.
- All DTO ↔ store conversion goes through `serialize.ts`. Don't hand-roll mapping elsewhere; update the serializer (and its test) when the schema changes.
- Node `id` ⇄ persisted `name`. New node ids come from `uniqueId` (bare type, then `type_2`, `type_3`, …).
- Adding a node type: create the component in `nodes/`, register it in `nodes/nodeTypes.ts`, and ensure `addNode` can produce it.
- The if node (`type: "if"`) stores its JSON Logic condition in `data.parameters.condition`. Edit it via the Inspector; never hand-edit elsewhere. The builder ↔ JSON Logic codec lives in `condition/jsonLogic.ts` — extend it (and its test) when adding operators.
- Edge labels come from the source handle (`connected` uses `sourceHandle ?? "main"`). The if node's handles are `true`/`false`; all other nodes use the default handle → `main`.
- Variable paths follow the chat service: `$state`/`$config`/`$variables`/`$parameters`/`$nodes.<name>.<path>`/`$trigger`. Keep `constants.ts` in sync with `core/constants/workflow.py`.
- Cover slice and serializer changes with `bun test`. UI components have no DOM test infra — extract their logic into pure, tested modules (see `expression/`, `condition/`) and verify the components via `bunx tsc --noEmit`.
