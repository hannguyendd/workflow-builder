# Workflow Builder UI — Design (v1)

Date: 2026-06-16
Status: Approved

## Goal

An xyflow-based canvas where a user can add **Start** and **End** nodes, drag
them around, connect them, and **Save / Load** the workflow as a JSON file that
matches the schema used by the Taggle chat backend (see
`taggle-ext-chat/https/programme-recommendation-workflow-test.http`). The build
is structured so the remaining node types (`agent`, `if`,
`programme_invitation`, `notification`) can be added later without rework.

This is the first increment. Persistence is deliberately simple (a local JSON
file on disk via the Bun server) and will be upgraded later — potentially to the
real backend API (`POST/GET /chat2/api/v1/workflows`).

## Constraints (from the project constitution)

- **Workflow UI:** `@xyflow/react` (React Flow). No hand-rolled canvas/SVG.
- **Styling:** Tailwind CSS v4 utility classes. No CSS-in-JS.
- **State:** Redux Toolkit as the single source of truth for graph state.
- **Structure:** feature-first `src/` layout; the workflow feature owns its
  components, slice, and serializer under `src/features/workflow/`.
- **Runtime:** Bun-native fullstack — one `Bun.serve()` serves API + SPA. Use
  `Bun.file` / `Bun.write` for disk I/O (not `node:fs`). Import via `@/*` alias.

## Scope

**In scope (v1):**

- Canvas rendering nodes/edges with pan, zoom, drag, and connect.
- Two node types: `start` and `end`, behind an extensible node-type registry.
- Toolbar: Add Start · Add End · Save · Load (with a small status line).
- JSON save/load round-tripping the full workflow schema to `data/workflow.json`.

**Out of scope (v1, deferred):**

- The other 4 node types and their parameter editors.
- Editing `parameterSchema`, node `parameters`, conditions, or edge labels via UI.
- Real backend API integration / auth.
- Multiple saved workflows (single `data/workflow.json` only).
- Validation of graph correctness (e.g. start has no incoming edge).

## Key design decision — Redux ⇄ xyflow state model

The persisted JSON schema keys nodes by `name` and stores edges as a
`source → [{ to, label }]` map. xyflow works with `Node[]` / `Edge[]` keyed by
`id`. Chosen approach **(A)**:

- Store **xyflow-native** `nodes[]` / `edges[]` in Redux. Interactions flow
  through `applyNodeChanges` / `applyEdgeChanges` / `addEdge`.
- Convert to/from the JSON schema **only at save/load**, isolated in
  `serialize.ts`.
- Use the node `name` as the xyflow node `id`, so the mapping is a clean 1:1.

Rejected (B): storing the canonical JSON schema in Redux and deriving xyflow
shape via selectors — adds conversion on every interaction and complicates the
change handlers.

## File layout

```
src/
├── index.ts                    # + GET/PUT /api/workflow (Bun.file / Bun.write → data/workflow.json)
├── App.tsx                     # <Provider store> → <WorkflowBuilderPage/> (replaces splash)
├── store/
│   ├── index.ts                # configureStore, RootState, AppDispatch
│   └── hooks.ts                # typed useAppDispatch / useAppSelector
├── services/
│   └── workflow.ts             # loadWorkflow() / saveWorkflow() → fetch /api/workflow
├── types/
│   └── workflow.ts             # WorkflowDto, WorkflowNodeDto, WorkflowEdgeMap (matches .http schema)
└── features/workflow/
    ├── index.ts                # barrel exports
    ├── workflowSlice.ts        # state { meta, nodes, edges }; reducers below
    ├── serialize.ts            # toWorkflowDto(state) / fromWorkflowDto(dto)
    ├── WorkflowBuilderPage.tsx # page shell: Toolbar + Canvas
    ├── WorkflowCanvas.tsx      # <ReactFlow> wired to Redux dispatch
    ├── Toolbar.tsx             # Add Start · Add End · Save · Load + status
    └── nodes/
        ├── StartNode.tsx
        ├── EndNode.tsx
        └── nodeTypes.ts        # registry { start, end } — extensible
```

## Redux slice

State:

```ts
{
  meta: { name, description, parameterSchema },   // workflow-level fields
  nodes: RFNode[],                                 // xyflow nodes (data carries type/description/parameters)
  edges: RFEdge[],                                 // xyflow edges (label defaults to "main")
}
```

Reducers:

- `nodesChanged(changes)` → `applyNodeChanges`
- `edgesChanged(changes)` → `applyEdgeChanges`
- `connected(connection)` → `addEdge` (label `"main"`)
- `addNode({ type })` → append a node of `type` with a default position and the
  type's default `parameters`; generate a unique `name`/`id`
  (e.g. `start`, `end`, `start_2`).
- `setWorkflow(dto)` → replace whole state from a loaded `WorkflowDto`.

## Data flow

- **Mount** → `loadWorkflow()`:
  - file exists → `fromWorkflowDto` → `setWorkflow` → xyflow renders it.
  - missing (server 404) → seed an in-memory Start + End node (not yet saved).
- **Edit** → xyflow `onNodesChange` / `onEdgesChange` / `onConnect` → dispatch →
  reducers update Redux → re-render.
- **Add Start / Add End** → dispatch `addNode`.
- **Save** → `toWorkflowDto(state)` → `saveWorkflow(dto)` → `PUT /api/workflow`
  → server `Bun.write("data/workflow.json", json)`.
- **Load** → `GET /api/workflow` → server reads via `Bun.file`.

## Persisted JSON shape

Exactly the sample workflow shape:

```json
{
  "name": "…",
  "description": "…",
  "parameterSchema": { "type": "object", "properties": {}, "required": [] },
  "nodes": [
    { "name": "start", "type": "start", "description": "Workflow entry point",
      "parameters": {}, "position": { "x": 300, "y": 0 } },
    { "name": "end", "type": "end", "description": "Workflow end",
      "parameters": {}, "position": { "x": 300, "y": 300 } }
  ],
  "edges": {
    "start": [ { "to": "end", "label": "main" } ]
  }
}
```

Mapping rules:

- xyflow node `id` == workflow node `name`.
- node `data` carries `type`, `description`, `parameters`.
- xyflow edge → entry under `edges[source]` with `{ to: target, label }`;
  `label` defaults to `"main"`.

## Server routes (`src/index.ts`)

- `GET /api/workflow` → read `data/workflow.json` via `Bun.file`; return JSON, or
  `404` when the file does not exist.
- `PUT /api/workflow` → `Bun.write("data/workflow.json", JSON.stringify(body))`;
  return `204`/`200`.

`data/workflow.json` is the live save file and is git-ignored.

## Error handling

- Load: no file / fetch error → seed default graph (Start + End), show
  "New workflow" status. Do not block the canvas.
- Save: non-OK response / network error → show an error status in the toolbar;
  keep current state intact.

## Testing

- One unit test for `serialize.ts`: a `WorkflowDto` round-trips through
  `fromWorkflowDto` → `toWorkflowDto` unchanged (the riskiest pure logic). Run
  with `bun test`.
- Type check: `bunx tsc --noEmit`.

## Commit convention

Conventional Commits, e.g. `feat(workflow): add xyflow canvas with start/end nodes`.
