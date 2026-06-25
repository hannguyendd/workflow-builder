# src/features/workflow

The workflow builder feature: a visual graph editor built on `@xyflow/react`, backed by a Redux slice, that serializes to/from the persisted `WorkflowDto`.

## Files

- `index.ts` — public surface of the feature. Re-exports `WorkflowBuilderPage` and `workflowReducer`. Import the feature through this barrel from outside the folder.
- `WorkflowBuilderPage.tsx` — page-level layout (toolbar + canvas).
- `WorkflowCanvas.tsx` — the `ReactFlow` canvas. Reads `nodes`/`edges` from the store and dispatches `nodesChanged` / `edgesChanged` / `connected`. Registers custom `nodeTypes`.
- `Toolbar.tsx` — actions (add node, save/load, etc.).
- `workflowSlice.ts` — Redux Toolkit slice. State is a `SerializableWorkflow`. Actions: `nodesChanged`, `edgesChanged`, `connected`, `addNode`, `setWorkflow`. Seeds an initial Start + End node.
- `serialize.ts` — `toWorkflowDto` / `fromWorkflowDto`, the only place that maps between store shape and persisted JSON.
- `nodes/` — custom xyflow node components (`StartNode`, `EndNode`) and the `nodeTypes` registry.
- `*.test.ts` — `bun test` specs for the slice and serializer.

## Conventions

- **State lives in the slice, not in components.** Components are thin: select from the store and dispatch actions. Use the typed hooks from `@/store/hooks`.
- Nodes/edges are stored as plain xyflow `Node`/`Edge`. Every node's `data` matches `WorkflowNodeData` (`{ description, parameters }`).
- Mutations go through `applyNodeChanges` / `applyEdgeChanges` / `addEdge` inside reducers (xyflow helpers), keeping the slice the single source of truth.
- All DTO ↔ store conversion goes through `serialize.ts`. Don't hand-roll mapping elsewhere; update the serializer (and its test) when the schema changes.
- Node `id` ⇄ persisted `name`. New node ids come from `uniqueId` (bare type, then `type_2`, `type_3`, …).
- Adding a node type: create the component in `nodes/`, register it in `nodes/nodeTypes.ts`, and ensure `addNode` can produce it.
- Cover slice and serializer changes with `bun test`.
