# Workflow Builder UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an xyflow canvas where a user can add Start/End nodes, drag and connect them, and Save/Load the workflow as a JSON file matching the Taggle workflow schema.

**Architecture:** Feature-first React app. Redux Toolkit holds xyflow-native `nodes[]`/`edges[]` as the single source of truth; a `serialize.ts` converts to/from the persisted JSON schema only at save/load. The Bun server persists a single `data/workflow.json` via `Bun.file`/`Bun.write`. The node `name` is used as the xyflow node `id`.

**Tech Stack:** Bun, React 19, `@xyflow/react` v12, Redux Toolkit + react-redux v9, Tailwind v4. Tests via `bun:test`. Type check via `bunx tsc --noEmit`.

**Spec:** `docs/superpowers/specs/2026-06-16-workflow-builder-ui-design.md`

**Conventions:**

- Import via the `@/*` alias (→ `./src/*`).
- Conventional Commits, scope `workflow`.
- End each commit message with the trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: Workflow types + ignore the data file

**Files:**

- Create: `src/types/workflow.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Create the shared workflow types**

`src/types/workflow.ts`:

```ts
import type { Node, Edge } from "@xyflow/react";

/** A workflow node as persisted in JSON (matches the Taggle workflow schema). */
export interface WorkflowNodeDto {
  name: string;
  type: string;
  description: string;
  parameters: Record<string, unknown>;
  position: { x: number; y: number };
}

/** One outgoing edge in the persisted JSON. */
export interface WorkflowEdgeDto {
  to: string;
  label: string;
}

/** Persisted edges: source node name -> outgoing edges. */
export type WorkflowEdgeMap = Record<string, WorkflowEdgeDto[]>;

/** A full workflow document as persisted to disk / sent to the backend. */
export interface WorkflowDto {
  name: string;
  description: string;
  parameterSchema: Record<string, unknown>;
  nodes: WorkflowNodeDto[];
  edges: WorkflowEdgeMap;
}

/** Workflow-level fields kept in the Redux store. */
export interface WorkflowMeta {
  name: string;
  description: string;
  parameterSchema: Record<string, unknown>;
}

/**
 * Convention for the `data` carried by every xyflow node in this app.
 * Nodes are stored as plain `Node`/`Edge`; `data` always has this shape.
 */
export interface WorkflowNodeData extends Record<string, unknown> {
  description: string;
  parameters: Record<string, unknown>;
}

/** The in-memory workflow shape the store holds and the serializer maps. */
export interface SerializableWorkflow {
  meta: WorkflowMeta;
  nodes: Node[];
  edges: Edge[];
}
```

- [ ] **Step 2: Ignore the live save file**

Append to `.gitignore` (after the `# output` block):

```
# workflow builder live save file
/data
```

- [ ] **Step 3: Type check**

Run: `bunx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 4: Commit**

```bash
git add src/types/workflow.ts .gitignore
git commit -m "feat(workflow): add workflow DTO and store types

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Serializer (xyflow ⇄ JSON schema) — TDD

**Files:**

- Create: `src/features/workflow/serialize.ts`
- Test: `src/features/workflow/serialize.test.ts`

- [ ] **Step 1: Write the failing round-trip test**

`src/features/workflow/serialize.test.ts`:

```ts
import { test, expect } from "bun:test";
import { fromWorkflowDto, toWorkflowDto } from "./serialize";
import type { WorkflowDto } from "@/types/workflow";

const sample: WorkflowDto = {
  name: "Sample",
  description: "desc",
  parameterSchema: { type: "object", properties: {}, required: [] },
  nodes: [
    {
      name: "start",
      type: "start",
      description: "Workflow entry point",
      parameters: {},
      position: { x: 300, y: 0 },
    },
    {
      name: "end",
      type: "end",
      description: "Workflow end",
      parameters: {},
      position: { x: 300, y: 300 },
    },
  ],
  edges: {
    start: [{ to: "end", label: "main" }],
  },
};

test("fromWorkflowDto maps names to ids and edges to a flat list", () => {
  const wf = fromWorkflowDto(sample);
  expect(wf.meta.name).toBe("Sample");
  expect(wf.nodes.map((n) => n.id)).toEqual(["start", "end"]);
  expect(wf.nodes[0]!.type).toBe("start");
  expect(wf.nodes[0]!.data).toEqual({
    description: "Workflow entry point",
    parameters: {},
  });
  expect(wf.edges).toHaveLength(1);
  expect(wf.edges[0]!.source).toBe("start");
  expect(wf.edges[0]!.target).toBe("end");
});

test("toWorkflowDto(fromWorkflowDto(dto)) round-trips unchanged", () => {
  expect(toWorkflowDto(fromWorkflowDto(sample))).toEqual(sample);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/features/workflow/serialize.test.ts`
Expected: FAIL — `Cannot find module './serialize'` (or "fromWorkflowDto is not a function").

- [ ] **Step 3: Implement the serializer**

`src/features/workflow/serialize.ts`:

```ts
import type {
  SerializableWorkflow,
  WorkflowDto,
  WorkflowEdgeMap,
  WorkflowNodeData,
  WorkflowNodeDto,
} from "@/types/workflow";
import type { Edge, Node } from "@xyflow/react";

/** xyflow store shape -> persisted JSON document. */
export function toWorkflowDto(wf: SerializableWorkflow): WorkflowDto {
  const nodes: WorkflowNodeDto[] = wf.nodes.map((n) => {
    const data = n.data as WorkflowNodeData;
    return {
      name: n.id,
      type: n.type ?? "",
      description: data.description,
      parameters: data.parameters,
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
    };
  });

  const edges: WorkflowEdgeMap = {};
  for (const e of wf.edges) {
    const label = typeof e.label === "string" ? e.label : "main";
    (edges[e.source] ??= []).push({ to: e.target, label });
  }

  return { ...wf.meta, nodes, edges };
}

/** Persisted JSON document -> xyflow store shape. */
export function fromWorkflowDto(dto: WorkflowDto): SerializableWorkflow {
  const nodes: Node[] = dto.nodes.map((n) => ({
    id: n.name,
    type: n.type,
    position: { x: n.position.x, y: n.position.y },
    data: {
      description: n.description,
      parameters: n.parameters,
    } satisfies WorkflowNodeData,
  }));

  const edges: Edge[] = [];
  for (const [source, list] of Object.entries(dto.edges)) {
    for (const e of list) {
      edges.push({
        id: `${source}->${e.to}:${e.label}`,
        source,
        target: e.to,
        label: e.label,
        data: { label: e.label },
      });
    }
  }

  return {
    meta: {
      name: dto.name,
      description: dto.description,
      parameterSchema: dto.parameterSchema,
    },
    nodes,
    edges,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/features/workflow/serialize.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Type check**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/workflow/serialize.ts src/features/workflow/serialize.test.ts
git commit -m "feat(workflow): add xyflow<->json serializer with round-trip test

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Redux slice — TDD

**Files:**

- Create: `src/features/workflow/workflowSlice.ts`
- Test: `src/features/workflow/workflowSlice.test.ts`

- [ ] **Step 1: Write the failing reducer tests**

`src/features/workflow/workflowSlice.test.ts`:

```ts
import { test, expect } from "bun:test";
import reducer, { addNode, connected, setWorkflow } from "./workflowSlice";
import type { WorkflowDto } from "@/types/workflow";

const empty = {
  meta: { name: "x", description: "", parameterSchema: {} },
  nodes: [],
  edges: [],
};

test("addNode appends a node whose id equals its type when unused", () => {
  const next = reducer(empty, addNode({ type: "start" }));
  expect(next.nodes).toHaveLength(1);
  expect(next.nodes[0]!.id).toBe("start");
  expect(next.nodes[0]!.type).toBe("start");
});

test("addNode generates a unique id when the type id is taken", () => {
  const once = reducer(empty, addNode({ type: "end" }));
  const twice = reducer(once, addNode({ type: "end" }));
  expect(twice.nodes.map((n) => n.id)).toEqual(["end", "end_2"]);
});

test("connected adds an edge labelled main", () => {
  const next = reducer(
    empty,
    connected({
      source: "start",
      target: "end",
      sourceHandle: null,
      targetHandle: null,
    }),
  );
  expect(next.edges).toHaveLength(1);
  expect(next.edges[0]!.source).toBe("start");
  expect(next.edges[0]!.target).toBe("end");
  expect(next.edges[0]!.label).toBe("main");
});

test("setWorkflow replaces state from a dto", () => {
  const dto: WorkflowDto = {
    name: "Loaded",
    description: "d",
    parameterSchema: {},
    nodes: [
      {
        name: "start",
        type: "start",
        description: "Workflow entry point",
        parameters: {},
        position: { x: 0, y: 0 },
      },
    ],
    edges: {},
  };
  const next = reducer(empty, setWorkflow(dto));
  expect(next.meta.name).toBe("Loaded");
  expect(next.nodes).toHaveLength(1);
  expect(next.nodes[0]!.id).toBe("start");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/features/workflow/workflowSlice.test.ts`
Expected: FAIL — `Cannot find module './workflowSlice'`.

- [ ] **Step 3: Implement the slice**

`src/features/workflow/workflowSlice.ts`:

```ts
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import type {
  SerializableWorkflow,
  WorkflowDto,
  WorkflowNodeData,
} from "@/types/workflow";
import { fromWorkflowDto } from "./serialize";

export type WorkflowState = SerializableWorkflow;

const DEFAULT_PARAMETER_SCHEMA = {
  type: "object",
  properties: {},
  required: [],
};

/** Initial seed: a Start and an End node, ready to connect. */
const initialState: WorkflowState = {
  meta: {
    name: "Untitled workflow",
    description: "",
    parameterSchema: DEFAULT_PARAMETER_SCHEMA,
  },
  nodes: [
    {
      id: "start",
      type: "start",
      position: { x: 300, y: 0 },
      data: nodeData("start"),
    },
    {
      id: "end",
      type: "end",
      position: { x: 300, y: 300 },
      data: nodeData("end"),
    },
  ],
  edges: [],
};

function nodeData(type: string): WorkflowNodeData {
  const description =
    type === "start"
      ? "Workflow entry point"
      : type === "end"
        ? "Workflow end"
        : "";
  return { description, parameters: {} };
}

/** Pick an unused id: the bare type, else `${type}_2`, `${type}_3`, ... */
function uniqueId(type: string, nodes: Node[]): string {
  const taken = new Set(nodes.map((n) => n.id));
  if (!taken.has(type)) return type;
  let i = 2;
  while (taken.has(`${type}_${i}`)) i++;
  return `${type}_${i}`;
}

const slice = createSlice({
  name: "workflow",
  initialState,
  reducers: {
    nodesChanged(state, action: PayloadAction<NodeChange[]>) {
      state.nodes = applyNodeChanges(action.payload, state.nodes);
    },
    edgesChanged(state, action: PayloadAction<EdgeChange[]>) {
      state.edges = applyEdgeChanges(action.payload, state.edges);
    },
    connected(state, action: PayloadAction<Connection>) {
      const c = action.payload;
      const edge: Edge = {
        id: `${c.source}->${c.target}`,
        source: c.source,
        target: c.target,
        sourceHandle: c.sourceHandle ?? null,
        targetHandle: c.targetHandle ?? null,
        label: "main",
        data: { label: "main" },
      };
      state.edges = addEdge(edge, state.edges);
    },
    addNode(state, action: PayloadAction<{ type: string }>) {
      const { type } = action.payload;
      state.nodes.push({
        id: uniqueId(type, state.nodes),
        type,
        position: { x: 200, y: 200 },
        data: nodeData(type),
      });
    },
    setWorkflow(state, action: PayloadAction<WorkflowDto>) {
      const wf = fromWorkflowDto(action.payload);
      state.meta = wf.meta;
      state.nodes = wf.nodes;
      state.edges = wf.edges;
    },
  },
});

export const { nodesChanged, edgesChanged, connected, addNode, setWorkflow } =
  slice.actions;
export default slice.reducer;
```

Note: the edge is built as a fully-typed `Edge` with a deterministic id; `addEdge` dedupes if the same source/target connection already exists.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/features/workflow/workflowSlice.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Type check**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/workflow/workflowSlice.ts src/features/workflow/workflowSlice.test.ts
git commit -m "feat(workflow): add redux slice for nodes, edges, and load

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Store wiring + typed hooks

**Files:**

- Create: `src/store/index.ts`
- Create: `src/store/hooks.ts`

- [ ] **Step 1: Configure the store**

`src/store/index.ts`:

```ts
import { configureStore } from "@reduxjs/toolkit";
import workflowReducer from "@/features/workflow/workflowSlice";

export const store = configureStore({
  reducer: {
    workflow: workflowReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

- [ ] **Step 2: Add typed hooks**

`src/store/hooks.ts`:

```ts
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "./index";

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
```

- [ ] **Step 3: Type check**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/store/index.ts src/store/hooks.ts
git commit -m "feat(workflow): wire redux store and typed hooks

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Server persistence route + client service

**Files:**

- Modify: `src/index.ts` (add the `/api/workflow` route to the `routes` object)
- Create: `src/services/workflow.ts`

- [ ] **Step 1: Add the `/api/workflow` route**

In `src/index.ts`, add this entry inside the `routes` object (e.g. directly after the `"/*": index,` line):

```ts
    "/api/workflow": {
      async GET() {
        const file = Bun.file("data/workflow.json");
        if (!(await file.exists())) {
          return new Response("Not found", { status: 404 });
        }
        return new Response(file, {
          headers: { "Content-Type": "application/json" },
        });
      },
      async PUT(req) {
        const body = await req.json();
        await Bun.write("data/workflow.json", JSON.stringify(body, null, 2));
        return new Response(null, { status: 204 });
      },
    },
```

- [ ] **Step 2: Add the client service**

`src/services/workflow.ts`:

```ts
import type { WorkflowDto } from "@/types/workflow";

/** GET the persisted workflow; null when none has been saved yet. */
export async function loadWorkflow(): Promise<WorkflowDto | null> {
  const res = await fetch("/api/workflow");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Load failed: ${res.status}`);
  return (await res.json()) as WorkflowDto;
}

/** PUT the workflow to disk. */
export async function saveWorkflow(dto: WorkflowDto): Promise<void> {
  const res = await fetch("/api/workflow", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  if (!res.ok) throw new Error(`Save failed: ${res.status}`);
}
```

- [ ] **Step 3: Type check**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Verify the route serves a 404 before any save**

Start the server in the background, then probe:

```bash
bun dev &
SERVER_PID=$!
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/workflow
kill $SERVER_PID
```

Expected: `404` (no `data/workflow.json` yet). If the server prints a different port, use that port.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/services/workflow.ts
git commit -m "feat(workflow): persist workflow to data/workflow.json via bun server

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Start/End node components + registry

**Files:**

- Create: `src/features/workflow/nodes/StartNode.tsx`
- Create: `src/features/workflow/nodes/EndNode.tsx`
- Create: `src/features/workflow/nodes/nodeTypes.ts`

- [ ] **Step 1: Create the Start node**

`src/features/workflow/nodes/StartNode.tsx` (source handle only — Start has no incoming edge):

```tsx
import { Handle, Position, type NodeProps } from "@xyflow/react";

export function StartNode(_props: NodeProps) {
  return (
    <div className="rounded-xl border border-emerald-300 bg-white px-5 py-3 shadow-sm dark:border-emerald-500/40 dark:bg-slate-900">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
        Start
      </p>
      <Handle
        type="source"
        position={Position.Bottom}
        className="bg-emerald-500!"
      />
    </div>
  );
}
```

- [ ] **Step 2: Create the End node**

`src/features/workflow/nodes/EndNode.tsx` (target handle only — End has no outgoing edge):

```tsx
import { Handle, Position, type NodeProps } from "@xyflow/react";

export function EndNode(_props: NodeProps) {
  return (
    <div className="rounded-xl border border-rose-300 bg-white px-5 py-3 shadow-sm dark:border-rose-500/40 dark:bg-slate-900">
      <Handle type="target" position={Position.Top} className="bg-rose-500!" />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
        End
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Create the node-type registry**

`src/features/workflow/nodes/nodeTypes.ts` (extensible — add agent/if/etc. here later):

```ts
import type { NodeTypes } from "@xyflow/react";
import { EndNode } from "./EndNode";
import { StartNode } from "./StartNode";

export const nodeTypes: NodeTypes = {
  start: StartNode,
  end: EndNode,
};
```

- [ ] **Step 4: Type check**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/workflow/nodes/
git commit -m "feat(workflow): add start and end node components and registry

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Canvas component

**Files:**

- Create: `src/features/workflow/WorkflowCanvas.tsx`

- [ ] **Step 1: Create the canvas wired to Redux**

`src/features/workflow/WorkflowCanvas.tsx`:

```tsx
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { connected, edgesChanged, nodesChanged } from "./workflowSlice";
import { nodeTypes } from "./nodes/nodeTypes";

export function WorkflowCanvas() {
  const dispatch = useAppDispatch();
  const nodes = useAppSelector((s) => s.workflow.nodes);
  const edges = useAppSelector((s) => s.workflow.edges);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={(changes: NodeChange[]) =>
          dispatch(nodesChanged(changes))
        }
        onEdgesChange={(changes: EdgeChange[]) =>
          dispatch(edgesChanged(changes))
        }
        onConnect={(connection: Connection) => dispatch(connected(connection))}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/workflow/WorkflowCanvas.tsx
git commit -m "feat(workflow): add react flow canvas bound to redux

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Toolbar component

**Files:**

- Create: `src/features/workflow/Toolbar.tsx`

- [ ] **Step 1: Create the toolbar**

`src/features/workflow/Toolbar.tsx`:

```tsx
import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { loadWorkflow, saveWorkflow } from "@/services/workflow";
import { addNode, setWorkflow } from "./workflowSlice";
import { toWorkflowDto } from "./serialize";

const btn =
  "rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

export function Toolbar() {
  const dispatch = useAppDispatch();
  const workflow = useAppSelector((s) => s.workflow);
  const [status, setStatus] = useState("");

  async function handleSave() {
    try {
      await saveWorkflow(toWorkflowDto(workflow));
      setStatus("Saved");
    } catch (err) {
      setStatus(`Save failed: ${(err as Error).message}`);
    }
  }

  async function handleLoad() {
    try {
      const dto = await loadWorkflow();
      if (!dto) {
        setStatus("No saved workflow");
        return;
      }
      dispatch(setWorkflow(dto));
      setStatus("Loaded");
    } catch (err) {
      setStatus(`Load failed: ${(err as Error).message}`);
    }
  }

  return (
    <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
      <span className="mr-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        Workflow Builder
      </span>
      <button
        className={btn}
        onClick={() => dispatch(addNode({ type: "start" }))}
      >
        Add Start
      </button>
      <button
        className={btn}
        onClick={() => dispatch(addNode({ type: "end" }))}
      >
        Add End
      </button>
      <span className="flex-1" />
      <span className="mr-2 text-xs text-slate-400 dark:text-slate-500">
        {status}
      </span>
      <button className={btn} onClick={handleLoad}>
        Load
      </button>
      <button
        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        onClick={handleSave}
      >
        Save
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/workflow/Toolbar.tsx
git commit -m "feat(workflow): add toolbar with add-node, save, and load

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Page, app root + Provider, CSS cleanup

**Files:**

- Create: `src/features/workflow/WorkflowBuilderPage.tsx`
- Create: `src/features/workflow/index.ts`
- Modify: `src/App.tsx` (replace whole file)
- Modify: `src/index.css`

- [ ] **Step 1: Create the page (loads the saved workflow on mount)**

`src/features/workflow/WorkflowBuilderPage.tsx`:

```tsx
import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { loadWorkflow } from "@/services/workflow";
import { setWorkflow } from "./workflowSlice";
import { Toolbar } from "./Toolbar";
import { WorkflowCanvas } from "./WorkflowCanvas";

export function WorkflowBuilderPage() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    loadWorkflow()
      .then((dto) => {
        if (dto) dispatch(setWorkflow(dto));
      })
      .catch(() => {
        /* no saved workflow yet — keep the seeded Start/End */
      });
  }, [dispatch]);

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-50 dark:bg-slate-950">
      <Toolbar />
      <div className="min-h-0 flex-1">
        <WorkflowCanvas />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the feature barrel**

`src/features/workflow/index.ts`:

```ts
export { WorkflowBuilderPage } from "./WorkflowBuilderPage";
export { default as workflowReducer } from "./workflowSlice";
```

- [ ] **Step 3: Replace `src/App.tsx` with the Provider-wrapped page**

Replace the entire contents of `src/App.tsx` with:

```tsx
import { Provider } from "react-redux";
import { store } from "@/store";
import { WorkflowBuilderPage } from "@/features/workflow";
import "./index.css";

export function App() {
  return (
    <Provider store={store}>
      <WorkflowBuilderPage />
    </Provider>
  );
}

export default App;
```

- [ ] **Step 4: Strip splash-only styling from `src/index.css`**

Replace the entire contents of `src/index.css` with (keeps the `@theme` tokens + dark variant; removes the centered-body, root background, and logo backdrop that fight a full-screen canvas; adds full-height roots):

```css
@import "tailwindcss";
@import "@xyflow/react/dist/style.css";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* Brand — violet-led */
  --color-primary-500: oklch(60.6% 0.25 292.717);
  --color-primary-600: oklch(54.1% 0.281 293.009);
  --color-primary-700: oklch(49.1% 0.27 292.581);
  --color-primary: oklch(54.1% 0.281 293.009);

  --color-secondary: oklch(70.4% 0.14 182.503); /* teal-500 */
  --color-tertiary: oklch(76.9% 0.188 70.08); /* amber-500 */
  --color-quaternary: oklch(66.7% 0.295 322.15); /* fuchsia-500 */

  /* Status (reserved — keep out of the brand namespace) */
  --color-success: oklch(69.6% 0.17 162.48); /* emerald-500 */
  --color-warning: oklch(76.9% 0.188 70.08); /* amber-500 */
  --color-danger: oklch(58.6% 0.222 17.585); /* rose-600 */
}

@layer base {
  html,
  body,
  #root {
    height: 100%;
  }

  body {
    margin: 0;
  }
}

@media (prefers-reduced-motion) {
  *,
  ::before,
  ::after {
    animation: none !important;
  }
}
```

Note: the xyflow stylesheet is imported here (and also in `WorkflowCanvas.tsx`); both are fine — Bun dedupes.

- [ ] **Step 5: Type check**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/workflow/WorkflowBuilderPage.tsx src/features/workflow/index.ts src/App.tsx src/index.css
git commit -m "feat(workflow): mount workflow builder page and clean up splash styling

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Full-test run + manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `bun test`
Expected: PASS (6 tests across serialize + slice).

- [ ] **Step 2: Type check the whole project**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Manual smoke test**

Run: `bun dev` and open the printed URL in a browser. Verify:

1. The page shows the toolbar and a canvas with a **Start** node and an **End** node.
2. Drag a node — it moves.
3. Drag from the Start node's bottom handle to the End node's top handle — an edge appears.
4. Click **Save** — status shows "Saved"; confirm `data/workflow.json` exists and contains `nodes` + an `edges.start` entry:
   ```bash
   cat data/workflow.json
   ```
5. Move a node, then click **Load** — the node snaps back to the saved position; status shows "Loaded".
6. Click **Add Start** and **Add End** — new nodes appear.

Expected: all six behaviors work. `data/workflow.json` matches the schema in the spec.

- [ ] **Step 4: Stop the dev server** (Ctrl-C).

There is nothing to commit in this task (verification only). If the manual test surfaced a fix, commit it with an appropriate `fix(workflow): …` message.
