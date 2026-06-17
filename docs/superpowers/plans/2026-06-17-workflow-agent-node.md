# Agent Node Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `agent` node to the workflow builder that picks a Taggle agent configuration, maps its input-schema fields to workflow expressions, and exposes its returned fields (`response` / `structuredResponse` / `messages`) to downstream-only expression autocomplete.

**Architecture:** A Bun server proxy (`/api/agents`) forwards to the Taggle agent API; a Redux slice caches the agents. The node stores camelCase params (`agentConfigurationId`, `input`, `output`). Expression autocomplete is refactored from a flat `nodeNames: string[]` to a richer `NodeOutputs[]` model that is pre-filtered to upstream (ancestor) nodes and carries each agent node's output fields.

**Tech Stack:** React, Redux Toolkit (`createSlice` / `createAsyncThunk`), `@xyflow/react`, Tailwind v4, Bun (`Bun.serve`, `bun test`), TypeScript (strict, `noEmit`).

## Global Constraints

- **Bun tooling only:** `bun test`, `bun install`, `bunx tsc --noEmit` — never node/npm/jest/vitest. Use built-in `fetch` in the proxy (not axios/node-fetch).
- **Alias imports** over relative where they cross folders: `@/*`, `@features/*`, `@services/*`, `@store/*`, `@types/*`. Within a folder, the codebase uses relative imports (`./`, `../`) — match the neighbouring files.
- **No magic strings/numbers:** extract literals into named constants (the existing files already do this; follow suit).
- **camelCase everywhere for the agent node** — params `agentConfigurationId`/`input`/`output`, returned fields `response`/`structuredResponse`/`messages`. ⚠️ The chat service is still snake_case on both sides; it will be updated. Flag this in code comments where the keys are defined.
- **Tailwind:** match the surrounding class style; dark-mode variants on every coloured element.
- **State lives in the slice**, components are thin and use the typed `useAppDispatch`/`useAppSelector` from `@/store/hooks`.
- **Commits:** Conventional Commits, `feat(workflow):` / `test(workflow):` / `docs(workflow):`, imperative, lowercase, no trailing period. End each commit message body with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **No DOM test infra:** components are verified with `bunx tsc --noEmit`; all logic worth testing is extracted into pure modules tested with `bun test`.

---

## File map

**Create**
- `src/types/agent.ts` — `AgentConfig` frontend type.
- `src/services/agents.ts` — `listAgents()` transport + `toAgentConfig()` mapper.
- `src/features/workflow/agents/agentsSlice.ts` — agents cache slice + `loadAgents` thunk.
- `src/features/workflow/schema/json.ts` — shared `isPlainObject` guard.
- `src/features/workflow/agent/inputFields.ts` (+ `.test.ts`) — `agentInputFields()`.
- `src/features/workflow/expression/graph.ts` (+ `.test.ts`) — `upstreamNodeIds()`.
- `src/features/workflow/expression/nodeOutputs.ts` (+ `.test.ts`) — `NodeOutputs` model, `agentOutputFields()`, `buildNodeOutputs()`.
- `src/features/workflow/agent/AgentEditor.tsx` — inspector editor for agent nodes.
- `src/features/workflow/nodes/AgentNode.tsx` — xyflow node component.

**Modify**
- `src/features/workflow/constants.ts` (+ `constants.test.ts`) — add `NodeType.AGENT`, `AgentNodeField`.
- `src/index.ts` — add `/api/agents` proxy.
- `src/store/index.ts` — register the `agents` reducer.
- `src/features/workflow/expression/suggestions.ts` (+ `suggestions.test.ts`) — `NodeOutputs[]` signature + field drilling.
- `src/features/workflow/components/ExpressionInput.tsx` — `nodeNames` → `nodeOutputs`.
- `src/features/workflow/condition/ConditionBuilder.tsx` — `nodeNames` → `nodeOutputs`.
- `src/features/workflow/condition/ConditionEditor.tsx` — `nodeNames` → `nodeOutputs`.
- `src/features/workflow/nodes/nodeTypes.ts` — register `AgentNode`.
- `src/features/workflow/nodes/dragData.ts` — add palette item.
- `src/features/workflow/workflowSlice.ts` (+ `workflowSlice.test.ts`) — seed agent params.
- `src/features/workflow/serialize.test.ts` — agent round-trip.
- `src/features/workflow/Inspector.tsx` — build `nodeOutputs`, render `AgentEditor`.
- `src/features/workflow/WorkflowBuilderPage.tsx` — dispatch `loadAgents` on mount.
- CLAUDE.md docs (final task).

---

## Task 1: Constants — `NodeType.AGENT` + `AgentNodeField`

**Files:**
- Modify: `src/features/workflow/constants.ts`
- Test: `src/features/workflow/constants.test.ts`

**Interfaces:**
- Produces: `NodeType.AGENT === "agent"`; `AgentNodeField.AGENT_PARAM.{AGENT_CONFIGURATION_ID,INPUT,OUTPUT}` (camelCase); `AgentNodeField.AGENT_OUTPUT.{RESPONSE,STRUCTURED_RESPONSE,MESSAGES}` (camelCase).

- [ ] **Step 1: Write the failing tests**

Add to `src/features/workflow/constants.test.ts` (update the import on line 2 to include `AgentNodeField`):

```ts
import { AgentNodeField, CONTEXT_SOURCES, ConditionEdge, EdgeLabel, NodeType } from "./constants";

test("agent node type matches the chat-service schema", () => {
  expect(NodeType.AGENT).toBe("agent");
});

test("agent node param keys are camelCase", () => {
  expect(AgentNodeField.AGENT_PARAM.AGENT_CONFIGURATION_ID).toBe("agentConfigurationId");
  expect(AgentNodeField.AGENT_PARAM.INPUT).toBe("input");
  expect(AgentNodeField.AGENT_PARAM.OUTPUT).toBe("output");
});

test("agent node output keys are camelCase", () => {
  expect(AgentNodeField.AGENT_OUTPUT.RESPONSE).toBe("response");
  expect(AgentNodeField.AGENT_OUTPUT.STRUCTURED_RESPONSE).toBe("structuredResponse");
  expect(AgentNodeField.AGENT_OUTPUT.MESSAGES).toBe("messages");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/features/workflow/constants.test.ts`
Expected: FAIL — `NodeType.AGENT` is undefined, `AgentNodeField` is not exported.

- [ ] **Step 3: Add the constants**

In `src/features/workflow/constants.ts`, add `AGENT: "agent"` to the `NodeType` object (after `IF`):

```ts
export const NodeType = {
  START: "start",
  END: "end",
  IF: "if",
  AGENT: "agent",
} as const;
```

Then add this block after the `ConditionEdge` definition:

```ts
/**
 * Field keys for the agent node — mirror of `AgentNodeField` in the chat
 * service's `core/constants/workflow.py`, BUT intentionally camelCase.
 * The chat service is currently snake_case (`agent_configuration_id`,
 * `structured_response`); it will be migrated to these camelCase keys so the
 * builder's saved params load and `$nodes.<name>.structuredResponse` resolves
 * at runtime. Keep this comment until that backend change lands.
 */
export const AgentNodeField = {
  /** Persisted node parameters (read by AgentNode on the backend). */
  AGENT_PARAM: {
    AGENT_CONFIGURATION_ID: "agentConfigurationId",
    INPUT: "input",
    OUTPUT: "output",
  },
  /** Fields exposed under `$nodes.<name>.` after the node runs. */
  AGENT_OUTPUT: {
    RESPONSE: "response",
    STRUCTURED_RESPONSE: "structuredResponse",
    MESSAGES: "messages",
  },
} as const;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/features/workflow/constants.test.ts`
Expected: PASS (all tests, including the existing ones).

- [ ] **Step 5: Commit**

```bash
git add src/features/workflow/constants.ts src/features/workflow/constants.test.ts
git commit -m "feat(workflow): add agent node type and AgentNodeField constants" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Agent type + transport service + Bun proxy

**Files:**
- Create: `src/types/agent.ts`
- Create: `src/services/agents.ts`
- Create: `src/services/agents.test.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Produces: `AgentConfig { id: string; name: string; description: string; inputSchema: Record<string, unknown> | null; outputSchema: Record<string, unknown> | null; status: string }`; `toAgentConfig(raw): AgentConfig`; `listAgents(): Promise<AgentConfig[]>`.

- [ ] **Step 1: Create the type**

Create `src/types/agent.ts`:

```ts
/** A Taggle agent configuration, as the builder needs it (camelCase, trimmed). */
export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  /** JSON Schema of the agent's input (drives the input-mapping form). */
  inputSchema: Record<string, unknown> | null;
  /** JSON Schema of the structured output, or null for free-text responses. */
  outputSchema: Record<string, unknown> | null;
  status: string;
}
```

- [ ] **Step 2: Write the failing test for the mapper**

Create `src/services/agents.test.ts`:

```ts
import { expect, test } from "bun:test";
import { toAgentConfig } from "./agents";

test("toAgentConfig keeps camelCase fields and defaults nullables", () => {
  expect(
    toAgentConfig({
      id: "a1",
      name: "Coach",
      description: "Health coach",
      inputSchema: { type: "object", properties: { messages: { type: "array" } } },
      outputSchema: null,
      status: "Published",
    }),
  ).toEqual({
    id: "a1",
    name: "Coach",
    description: "Health coach",
    inputSchema: { type: "object", properties: { messages: { type: "array" } } },
    outputSchema: null,
    status: "Published",
  });
});

test("toAgentConfig fills missing optional fields", () => {
  const result = toAgentConfig({ id: "a2", name: "Bare" });
  expect(result.description).toBe("");
  expect(result.inputSchema).toBeNull();
  expect(result.outputSchema).toBeNull();
  expect(result.status).toBe("");
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun test src/services/agents.test.ts`
Expected: FAIL — cannot find module `./agents`.

- [ ] **Step 4: Create the transport service**

Create `src/services/agents.ts`:

```ts
import type { AgentConfig } from "@/types/agent";

const AGENTS_ENDPOINT = "/api/agents";
const PAGE_SIZE = 200;

/** The raw agent item as returned by the proxied Taggle API (camelCase). */
interface RawAgent {
  id: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown> | null;
  outputSchema?: Record<string, unknown> | null;
  status?: string;
}

interface RawPagingResponse {
  items: RawAgent[];
}

/** Map one raw API agent to the trimmed `AgentConfig` the builder uses. */
export function toAgentConfig(raw: RawAgent): AgentConfig {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? "",
    inputSchema: raw.inputSchema ?? null,
    outputSchema: raw.outputSchema ?? null,
    status: raw.status ?? "",
  };
}

/** GET the (proxied) agent list. Throws on a non-OK response. */
export async function listAgents(): Promise<AgentConfig[]> {
  const res = await fetch(`${AGENTS_ENDPOINT}?page=1&pageSize=${PAGE_SIZE}`);
  if (!res.ok) throw new Error(`List agents failed: ${res.status}`);
  const data = (await res.json()) as RawPagingResponse;
  return data.items.map(toAgentConfig);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test src/services/agents.test.ts`
Expected: PASS.

- [ ] **Step 6: Add the Bun proxy route**

In `src/index.ts`, add config constants just below the imports (top of file, after line 2):

```ts
// Taggle agent API — proxied so the tenant header stays server-side and the
// browser avoids CORS. Override via env in deployment.
const TAGGLE_API_BASE_URL = process.env.TAGGLE_API_BASE_URL ?? "http://localhost:8000";
const TAGGLE_API_PREFIX = process.env.TAGGLE_API_PREFIX ?? "/chat2/api/v1";
const TAGGLE_ORGANIZATION = process.env.TAGGLE_ORGANIZATION ?? "TAGGLE";
```

Add this route inside the `routes` object (e.g. right after the `"/api/workflow"` block):

```ts
    "/api/agents": {
      async GET(req) {
        const incoming = new URL(req.url);
        const target = new URL(`${TAGGLE_API_BASE_URL}${TAGGLE_API_PREFIX}/agents`);
        incoming.searchParams.forEach((value, key) => target.searchParams.set(key, value));
        try {
          const upstream = await fetch(target, {
            headers: { Organization: TAGGLE_ORGANIZATION },
          });
          if (!upstream.ok) {
            return new Response(`Upstream error: ${upstream.status}`, { status: 502 });
          }
          return new Response(upstream.body, {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch {
          return new Response("Agent service unreachable", { status: 502 });
        }
      },
    },
```

- [ ] **Step 7: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Update the services + types docs**

In `src/services/CLAUDE.md`, under "Files", add:
`- \`agents.ts\` — \`listAgents()\` (GET \`/api/agents\`, proxied to the Taggle agent API) and the pure \`toAgentConfig\` mapper. Returns \`AgentConfig[]\` from \`@/types/agent\`.`

In `src/types/CLAUDE.md`, under "Files", add:
`- \`agent.ts\` — \`AgentConfig\`, the trimmed agent-configuration shape the builder consumes (camelCase; \`inputSchema\`/\`outputSchema\` nullable).`

- [ ] **Step 9: Commit**

```bash
git add src/types/agent.ts src/services/agents.ts src/services/agents.test.ts src/index.ts src/services/CLAUDE.md src/types/CLAUDE.md
git commit -m "feat(workflow): proxy and fetch Taggle agent configurations" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> **Manual check (optional, needs the chat service running):** `curl 'http://localhost:3000/api/agents'` should return the paged agent JSON; with the backend down it returns `502`.

---

## Task 3: Agents slice + store registration

**Files:**
- Create: `src/features/workflow/agents/agentsSlice.ts`
- Create: `src/features/workflow/agents/agentsSlice.test.ts`
- Modify: `src/store/index.ts`

**Interfaces:**
- Consumes: `listAgents` (Task 2), `AgentConfig` (Task 2).
- Produces: default export `agentsReducer`; `loadAgents` thunk; state shape `{ byId: Record<string, AgentConfig>; ids: string[]; status: "idle" | "loading" | "ready" | "error"; error: string | null }` mounted at `state.agents`.

- [ ] **Step 1: Write the failing test**

Create `src/features/workflow/agents/agentsSlice.test.ts`:

```ts
import { expect, test } from "bun:test";
import reducer, { loadAgents } from "./agentsSlice";
import type { AgentConfig } from "@/types/agent";

const initial = reducer(undefined, { type: "@@INIT" });

const agent: AgentConfig = {
  id: "a1",
  name: "Coach",
  description: "",
  inputSchema: null,
  outputSchema: null,
  status: "Published",
};

test("starts idle and empty", () => {
  expect(initial).toEqual({ byId: {}, ids: [], status: "idle", error: null });
});

test("pending sets loading", () => {
  const next = reducer(initial, { type: loadAgents.pending.type });
  expect(next.status).toBe("loading");
});

test("fulfilled indexes agents by id and marks ready", () => {
  const next = reducer(initial, { type: loadAgents.fulfilled.type, payload: [agent] });
  expect(next.status).toBe("ready");
  expect(next.ids).toEqual(["a1"]);
  expect(next.byId.a1).toEqual(agent);
});

test("rejected records the error", () => {
  const next = reducer(initial, {
    type: loadAgents.rejected.type,
    error: { message: "boom" },
  });
  expect(next.status).toBe("error");
  expect(next.error).toBe("boom");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/features/workflow/agents/agentsSlice.test.ts`
Expected: FAIL — cannot find module `./agentsSlice`.

- [ ] **Step 3: Create the slice**

Create `src/features/workflow/agents/agentsSlice.ts`:

```ts
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { AgentConfig } from "@/types/agent";
import { listAgents } from "@/services/agents";

export interface AgentsState {
  byId: Record<string, AgentConfig>;
  ids: string[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
}

const initialState: AgentsState = { byId: {}, ids: [], status: "idle", error: null };

/** Fetch the agent list into the cache. Dispatched once on page mount. */
export const loadAgents = createAsyncThunk("agents/load", () => listAgents());

const slice = createSlice({
  name: "agents",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadAgents.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loadAgents.fulfilled, (state, action) => {
        state.byId = {};
        state.ids = [];
        for (const agent of action.payload) {
          state.byId[agent.id] = agent;
          state.ids.push(agent.id);
        }
        state.status = "ready";
      })
      .addCase(loadAgents.rejected, (state, action) => {
        state.status = "error";
        state.error = action.error.message ?? "Failed to load agents";
      });
  },
});

export default slice.reducer;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/features/workflow/agents/agentsSlice.test.ts`
Expected: PASS.

- [ ] **Step 5: Register the reducer**

In `src/store/index.ts`, add the import and reducer entry:

```ts
import { configureStore } from "@reduxjs/toolkit";
import workflowReducer from "@/features/workflow/workflowSlice";
import themeReducer from "@/features/theme/themeSlice";
import agentsReducer from "@/features/workflow/agents/agentsSlice";

export const store = configureStore({
  reducer: {
    workflow: workflowReducer,
    theme: themeReducer,
    agents: agentsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

- [ ] **Step 6: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Update the store doc**

In `src/store/index.ts`'s sibling `src/store/CLAUDE.md`, update the `index.ts` bullet's reducer map note to mention `agents` (e.g. "the root reducer map (`workflow`, `theme`, `agents`)").

- [ ] **Step 8: Commit**

```bash
git add src/features/workflow/agents/agentsSlice.ts src/features/workflow/agents/agentsSlice.test.ts src/store/index.ts src/store/CLAUDE.md
git commit -m "feat(workflow): add agents slice with loadAgents thunk" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Agent input-fields helper

**Files:**
- Create: `src/features/workflow/schema/json.ts`
- Create: `src/features/workflow/agent/inputFields.ts`
- Create: `src/features/workflow/agent/inputFields.test.ts`

**Interfaces:**
- Produces: `isPlainObject(value): value is Record<string, unknown>`; `AgentInputField { name: string; type: string; description: string; required: boolean }`; `agentInputFields(inputSchema: unknown): AgentInputField[]`.

- [ ] **Step 1: Write the failing test**

Create `src/features/workflow/agent/inputFields.test.ts`:

```ts
import { expect, test } from "bun:test";
import { agentInputFields } from "./inputFields";

const schema = {
  type: "object",
  properties: {
    messages: { type: "array", description: "Conversation" },
    user_name: { type: "string" },
  },
  required: ["messages"],
};

test("lists each top-level property with type, description and required flag", () => {
  expect(agentInputFields(schema)).toEqual([
    { name: "messages", type: "array", description: "Conversation", required: true },
    { name: "user_name", type: "string", description: "", required: false },
  ]);
});

test("returns [] for a non-object or schema without properties", () => {
  expect(agentInputFields(null)).toEqual([]);
  expect(agentInputFields({ type: "object" })).toEqual([]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/features/workflow/agent/inputFields.test.ts`
Expected: FAIL — cannot find module `./inputFields`.

- [ ] **Step 3: Create the shared guard and the helper**

Create `src/features/workflow/schema/json.ts`:

```ts
/** Narrow to a non-null, non-array object. Shared JSON-Schema guard. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

Create `src/features/workflow/agent/inputFields.ts`:

```ts
import { isPlainObject } from "../schema/json";

/** One mappable agent input field, rendered as one expression input. */
export interface AgentInputField {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

/**
 * Flatten an agent `inputSchema` into a list of top-level fields. Every field
 * maps to a workflow expression, so any property type is allowed (no scalar
 * restriction, unlike the parameter-schema form builder).
 */
export function agentInputFields(inputSchema: unknown): AgentInputField[] {
  if (!isPlainObject(inputSchema)) return [];
  const props = inputSchema.properties;
  if (!isPlainObject(props)) return [];
  const required = Array.isArray(inputSchema.required) ? inputSchema.required : [];
  return Object.entries(props).map(([name, prop]) => ({
    name,
    type: isPlainObject(prop) && typeof prop.type === "string" ? prop.type : "",
    description:
      isPlainObject(prop) && typeof prop.description === "string" ? prop.description : "",
    required: required.includes(name),
  }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/features/workflow/agent/inputFields.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/workflow/schema/json.ts src/features/workflow/agent/inputFields.ts src/features/workflow/agent/inputFields.test.ts
git commit -m "feat(workflow): derive mappable input fields from an agent schema" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Upstream-node graph helper

**Files:**
- Create: `src/features/workflow/expression/graph.ts`
- Create: `src/features/workflow/expression/graph.test.ts`

**Interfaces:**
- Produces: `upstreamNodeIds(target: string, edges: Edge[]): Set<string>` — the set of node ids with a directed path **to** `target` (ancestors), excluding `target` itself.

- [ ] **Step 1: Write the failing test**

Create `src/features/workflow/expression/graph.test.ts`:

```ts
import { expect, test } from "bun:test";
import type { Edge } from "@xyflow/react";
import { upstreamNodeIds } from "./graph";

/** Minimal edge factory — only source/target matter here. */
const e = (source: string, target: string): Edge => ({ id: `${source}->${target}`, source, target });

test("returns all ancestors along a chain", () => {
  const edges = [e("start", "a"), e("a", "b"), e("b", "end")];
  expect([...upstreamNodeIds("end", edges)].sort()).toEqual(["a", "b", "start"]);
  expect([...upstreamNodeIds("a", edges)]).toEqual(["start"]);
});

test("a root node has no ancestors", () => {
  expect([...upstreamNodeIds("start", [e("start", "a")])]).toEqual([]);
});

test("excludes nodes only reachable downstream (siblings of a branch)", () => {
  // start -> gate; gate -true-> yes; gate -false-> no
  const edges = [e("start", "gate"), e("gate", "yes"), e("gate", "no")];
  expect([...upstreamNodeIds("yes", edges)].sort()).toEqual(["gate", "start"]);
  expect([...upstreamNodeIds("yes", edges)]).not.toContain("no");
});

test("terminates on a cycle and excludes the target itself", () => {
  const edges = [e("a", "b"), e("b", "a")];
  expect([...upstreamNodeIds("a", edges)]).toEqual(["b"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/features/workflow/expression/graph.test.ts`
Expected: FAIL — cannot find module `./graph`.

- [ ] **Step 3: Implement the helper**

Create `src/features/workflow/expression/graph.ts`:

```ts
import type { Edge } from "@xyflow/react";

/**
 * The ancestor set of `target`: every node with a directed path into it.
 * Used so an expression in a node can only reference nodes that run before it.
 * Walks the reverse adjacency with a visited guard (safe on cycles) and never
 * includes `target` itself.
 */
export function upstreamNodeIds(target: string, edges: Edge[]): Set<string> {
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    const list = incoming.get(edge.target);
    if (list) list.push(edge.source);
    else incoming.set(edge.target, [edge.source]);
  }

  const result = new Set<string>();
  const stack = [...(incoming.get(target) ?? [])];
  while (stack.length) {
    const node = stack.pop()!;
    if (result.has(node)) continue;
    result.add(node);
    for (const source of incoming.get(node) ?? []) stack.push(source);
  }
  result.delete(target); // guard against cycles that loop back to target
  return result;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/features/workflow/expression/graph.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/workflow/expression/graph.ts src/features/workflow/expression/graph.test.ts
git commit -m "feat(workflow): compute upstream node ancestors from edges" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: NodeOutputs model + agent output fields + builder

**Files:**
- Create: `src/features/workflow/expression/nodeOutputs.ts`
- Create: `src/features/workflow/expression/nodeOutputs.test.ts`

**Interfaces:**
- Consumes: `AgentNodeField`, `NodeType` (Task 1); `isPlainObject` (Task 4); `AgentConfig` (Task 2).
- Produces:
  - `NodeOutputField { name: string; type: string; description?: string; children?: NodeOutputField[] }`
  - `NodeOutputs { name: string; type: string; fields: NodeOutputField[] }`
  - `NodeDescriptor { name: string; type: string; agentConfigurationId?: string }`
  - `agentOutputFields(agent: AgentConfig | undefined): NodeOutputField[]`
  - `buildNodeOutputs(nodes: NodeDescriptor[], agentsById: Record<string, AgentConfig>): NodeOutputs[]`

- [ ] **Step 1: Write the failing test**

Create `src/features/workflow/expression/nodeOutputs.test.ts`:

```ts
import { expect, test } from "bun:test";
import type { AgentConfig } from "@/types/agent";
import { agentOutputFields, buildNodeOutputs } from "./nodeOutputs";

const agent: AgentConfig = {
  id: "a1",
  name: "Coach",
  description: "",
  inputSchema: null,
  outputSchema: {
    type: "object",
    properties: {
      score: { type: "number", description: "0-100" },
      summary: { type: "string" },
    },
  },
  status: "Published",
};

test("agentOutputFields exposes camelCase top-level fields", () => {
  const fields = agentOutputFields(undefined);
  expect(fields.map((f) => f.name)).toEqual(["response", "structuredResponse", "messages"]);
  // No outputSchema -> structuredResponse has no children.
  expect(fields.find((f) => f.name === "structuredResponse")!.children).toBeUndefined();
});

test("agentOutputFields drills structuredResponse from the outputSchema", () => {
  const structured = agentOutputFields(agent).find((f) => f.name === "structuredResponse")!;
  expect(structured.children!.map((c) => c.name)).toEqual(["score", "summary"]);
  expect(structured.children!.find((c) => c.name === "score")!.description).toBe("0-100");
});

test("buildNodeOutputs gives non-agent nodes no fields", () => {
  const out = buildNodeOutputs([{ name: "gate", type: "if" }], {});
  expect(out).toEqual([{ name: "gate", type: "if", fields: [] }]);
});

test("buildNodeOutputs resolves an agent node's fields via agentsById", () => {
  const out = buildNodeOutputs(
    [{ name: "coach", type: "agent", agentConfigurationId: "a1" }],
    { a1: agent },
  );
  expect(out[0]!.fields.map((f) => f.name)).toEqual(["response", "structuredResponse", "messages"]);
  expect(out[0]!.fields[1]!.children!.map((c) => c.name)).toEqual(["score", "summary"]);
});

test("buildNodeOutputs handles an agent node whose agent is unknown", () => {
  const out = buildNodeOutputs([{ name: "coach", type: "agent", agentConfigurationId: "missing" }], {});
  expect(out[0]!.fields.map((f) => f.name)).toEqual(["response", "structuredResponse", "messages"]);
  expect(out[0]!.fields[1]!.children).toBeUndefined();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/features/workflow/expression/nodeOutputs.test.ts`
Expected: FAIL — cannot find module `./nodeOutputs`.

- [ ] **Step 3: Implement the model + builder**

Create `src/features/workflow/expression/nodeOutputs.ts`:

```ts
import type { AgentConfig } from "@/types/agent";
import { AgentNodeField, NodeType } from "../constants";
import { isPlainObject } from "../schema/json";

/** One autocompletable field under `$nodes.<name>.` (may nest via `children`). */
export interface NodeOutputField {
  name: string;
  type: string;
  description?: string;
  children?: NodeOutputField[];
}

/** The outputs a node exposes to downstream expressions. */
export interface NodeOutputs {
  name: string;
  type: string;
  fields: NodeOutputField[];
}

/** Minimal node shape the builder needs (mapped from the store in Inspector). */
export interface NodeDescriptor {
  name: string;
  type: string;
  agentConfigurationId?: string;
}

/** Top-level properties of a JSON-Schema object as leaf output fields. */
function schemaProperties(schema: unknown): NodeOutputField[] {
  if (!isPlainObject(schema)) return [];
  const props = schema.properties;
  if (!isPlainObject(props)) return [];
  return Object.entries(props).map(([name, prop]) => {
    const field: NodeOutputField = {
      name,
      type: isPlainObject(prop) && typeof prop.type === "string" ? prop.type : "",
    };
    if (isPlainObject(prop) && typeof prop.description === "string" && prop.description) {
      field.description = prop.description;
    }
    return field;
  });
}

/** The fields an agent node exposes: response / structuredResponse / messages. */
export function agentOutputFields(agent: AgentConfig | undefined): NodeOutputField[] {
  const out = AgentNodeField.AGENT_OUTPUT;
  const structured: NodeOutputField = {
    name: out.STRUCTURED_RESPONSE,
    type: "object",
    description: "Structured output (shaped by the agent's output schema)",
  };
  const children = agent ? schemaProperties(agent.outputSchema) : [];
  if (children.length) structured.children = children;

  return [
    { name: out.RESPONSE, type: "string", description: "Agent text response" },
    structured,
    { name: out.MESSAGES, type: "array", description: "Full output messages" },
  ];
}

/** Map node descriptors to their downstream-visible outputs. */
export function buildNodeOutputs(
  nodes: NodeDescriptor[],
  agentsById: Record<string, AgentConfig>,
): NodeOutputs[] {
  return nodes.map((node) => {
    if (node.type === NodeType.AGENT) {
      const agent = node.agentConfigurationId ? agentsById[node.agentConfigurationId] : undefined;
      return { name: node.name, type: node.type, fields: agentOutputFields(agent) };
    }
    return { name: node.name, type: node.type, fields: [] };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/features/workflow/expression/nodeOutputs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/workflow/expression/nodeOutputs.ts src/features/workflow/expression/nodeOutputs.test.ts
git commit -m "feat(workflow): model node outputs and agent return fields" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: NodeOutputs-aware autocomplete (suggestions + UI threading)

This task changes `getSuggestions` from `nodeNames: string[]` to `nodeOutputs: NodeOutputs[]` and threads the new prop through the three components that pass it down. The pure logic is tested with `bun test`; the components are gated with `bunx tsc --noEmit`.

**Files:**
- Modify: `src/features/workflow/expression/suggestions.ts`
- Modify: `src/features/workflow/expression/suggestions.test.ts`
- Modify: `src/features/workflow/components/ExpressionInput.tsx`
- Modify: `src/features/workflow/condition/ConditionBuilder.tsx`
- Modify: `src/features/workflow/condition/ConditionEditor.tsx`

**Interfaces:**
- Consumes: `NodeOutputs`, `NodeOutputField` (Task 6).
- Produces: `getSuggestions(input: string, nodes?: NodeOutputs[], parameters?: ParameterEntry[]): Suggestion[]`; `ExpressionInput`/`ConditionBuilder`/`ConditionEditor` now take a `nodeOutputs: NodeOutputs[]` prop (replacing `nodeNames: string[]`).

- [ ] **Step 1: Replace the suggestions tests**

Overwrite `src/features/workflow/expression/suggestions.test.ts` with:

```ts
import { expect, test } from "bun:test";
import { getSuggestions } from "./suggestions";
import type { NodeOutputs } from "./nodeOutputs";

const ifNode: NodeOutputs = { name: "kyc_check", type: "if", fields: [] };
const fetchNode: NodeOutputs = { name: "fetch_patient", type: "if", fields: [] };
const agentNode: NodeOutputs = {
  name: "coach",
  type: "agent",
  fields: [
    { name: "response", type: "string" },
    {
      name: "structuredResponse",
      type: "object",
      children: [
        { name: "score", type: "number", description: "0-100" },
        { name: "summary", type: "string" },
      ],
    },
    { name: "messages", type: "array" },
  ],
};

test("empty input suggests all six sources", () => {
  expect(getSuggestions("", []).map((s) => s.label)).toEqual([
    "$state",
    "$config",
    "$variables",
    "$parameters",
    "$nodes",
    "$trigger",
  ]);
});

test("typing a prefix filters sources", () => {
  expect(getSuggestions("$st", []).map((s) => s.value)).toEqual(["$state"]);
});

test("$nodes suggestion carries a trailing dot to invite the node step", () => {
  expect(getSuggestions("$no", [])).toEqual([{ value: "$nodes.", label: "$nodes" }]);
});

test("after $nodes. it suggests the available node names", () => {
  expect(getSuggestions("$nodes.", [ifNode, fetchNode])).toEqual([
    { value: "$nodes.kyc_check.", label: "kyc_check" },
    { value: "$nodes.fetch_patient.", label: "fetch_patient" },
  ]);
});

test("node names filter by the typed segment, case-insensitively", () => {
  expect(getSuggestions("$nodes.KY", [ifNode, fetchNode]).map((s) => s.label)).toEqual([
    "kyc_check",
  ]);
});

test("a node with no fields yields nothing past its name", () => {
  expect(getSuggestions("$nodes.kyc_check.status", [ifNode])).toEqual([]);
});

test("an agent node suggests its top-level output fields", () => {
  expect(getSuggestions("$nodes.coach.", [agentNode])).toEqual([
    { value: "$nodes.coach.response", label: "response — string" },
    { value: "$nodes.coach.structuredResponse.", label: "structuredResponse — object" },
    { value: "$nodes.coach.messages", label: "messages — array" },
  ]);
});

test("structuredResponse drills into the output-schema children", () => {
  expect(getSuggestions("$nodes.coach.structuredResponse.", [agentNode])).toEqual([
    { value: "$nodes.coach.structuredResponse.score", label: "score — number", description: "0-100" },
    { value: "$nodes.coach.structuredResponse.summary", label: "summary — string" },
  ]);
});

test("field suggestions filter by the typed segment", () => {
  expect(
    getSuggestions("$nodes.coach.structuredResponse.sc", [agentNode]).map((s) => s.label),
  ).toEqual(["score — number"]);
});

test("unknown node name yields no suggestions", () => {
  expect(getSuggestions("$nodes.ghost.", [agentNode])).toEqual([]);
});

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

test("parameter suggestions carry the field description when present", () => {
  const params = [{ name: "userId", type: "string", description: "The user identifier" }];
  expect(getSuggestions("$parameters.", [], params)).toEqual([
    { value: "$parameters.userId", label: "userId — string", description: "The user identifier" },
  ]);
});

test("no suggestions once a path goes deeper than the parameter name", () => {
  const params = [{ name: "user", type: "string" }];
  expect(getSuggestions("$parameters.user.id", [], params)).toEqual([]);
});

test("$parameters. with no schema yields no field suggestions", () => {
  expect(getSuggestions("$parameters.", [])).toEqual([]);
});

test("non-$ input yields no suggestions", () => {
  expect(getSuggestions("age", [])).toEqual([]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/features/workflow/expression/suggestions.test.ts`
Expected: FAIL — current `getSuggestions` treats the second arg as `string[]`; the agent-field tests fail.

- [ ] **Step 3: Rewrite `suggestions.ts`**

Overwrite `src/features/workflow/expression/suggestions.ts` with:

```ts
import { CONTEXT_SOURCES } from "../constants";
import type { ParameterEntry } from "../schema/parameterSchema";
import type { NodeOutputField, NodeOutputs } from "./nodeOutputs";

/** One autocomplete suggestion: `value` replaces the input, `label` is shown. */
export interface Suggestion {
  value: string;
  label: string;
  description?: string;
}

const NODES_SOURCE = "$nodes";
const PARAMETERS_SOURCE = "$parameters";
const SEP = ".";

/** Walk `fields` down the already-chosen `completed` segments to the level to suggest. */
function fieldsAtPath(fields: NodeOutputField[], completed: string[]): NodeOutputField[] {
  let current = fields;
  for (const segment of completed) {
    const match = current.find((f) => f.name === segment);
    if (!match || !match.children) return [];
    current = match.children;
  }
  return current;
}

/** Suggestions for the field path after a known node name. */
function nodeFieldSuggestions(node: NodeOutputs, fieldSegments: string[]): Suggestion[] {
  const completed = fieldSegments.slice(0, -1);
  const partial = (fieldSegments[fieldSegments.length - 1] ?? "").toLowerCase();
  const level = fieldsAtPath(node.fields, completed);
  const prefix = completed.length ? completed.join(SEP) + SEP : "";
  const base = `${NODES_SOURCE}${SEP}${node.name}${SEP}${prefix}`;

  return level
    .filter((f) => f.name.toLowerCase().startsWith(partial))
    .map((f) => {
      const hasChildren = !!(f.children && f.children.length);
      const suggestion: Suggestion = {
        value: `${base}${f.name}${hasChildren ? SEP : ""}`,
        label: `${f.name} — ${f.type}`,
      };
      if (f.description) suggestion.description = f.description;
      return suggestion;
    });
}

/**
 * Suggestions for the current operand `input`:
 * - empty or a `$` prefix -> matching source names
 * - after `$nodes.` (node-name segment) -> available (upstream) node names
 * - after `$nodes.<name>.` -> that node's output fields, drilling into children
 * - after `$parameters.` (field segment) -> schema field names + type
 * - anything else -> no suggestions (free-form)
 */
export function getSuggestions(
  input: string,
  nodes: NodeOutputs[] = [],
  parameters: ParameterEntry[] = [],
): Suggestion[] {
  const text = input.trimStart();
  const nodesPrefix = NODES_SOURCE + SEP;
  const paramsPrefix = PARAMETERS_SOURCE + SEP;

  if (text.startsWith(nodesPrefix)) {
    const rest = text.slice(nodesPrefix.length);
    const segments = rest.split(SEP);
    if (segments.length === 1) {
      const needle = segments[0]!.toLowerCase();
      return nodes
        .filter((n) => n.name.toLowerCase().startsWith(needle))
        .map((n) => ({ value: `${nodesPrefix}${n.name}${SEP}`, label: n.name }));
    }
    const node = nodes.find((n) => n.name === segments[0]);
    if (!node) return [];
    return nodeFieldSuggestions(node, segments.slice(1));
  }

  if (text.startsWith(paramsPrefix)) {
    const rest = text.slice(paramsPrefix.length);
    if (rest.includes(SEP)) return []; // past the field-name segment
    const needle = rest.toLowerCase();
    return parameters
      .filter((p) => p.name.toLowerCase().startsWith(needle))
      .map((p) => {
        const suggestion: Suggestion = {
          value: `${paramsPrefix}${p.name}`,
          label: `${p.name} — ${p.type}`,
        };
        if (p.description) suggestion.description = p.description;
        return suggestion;
      });
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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/features/workflow/expression/suggestions.test.ts`
Expected: PASS.

- [ ] **Step 5: Thread the prop through `ExpressionInput`**

In `src/features/workflow/components/ExpressionInput.tsx`:
- Replace the import `import type { ParameterEntry } from "../schema/parameterSchema";` block by also importing the model: add `import type { NodeOutputs } from "../expression/nodeOutputs";`.
- In `ExpressionInputProps`, replace `nodeNames: string[];` with `nodeOutputs: NodeOutputs[];`.
- In the component params, replace `nodeNames` with `nodeOutputs`.
- In the `useMemo`, change the call and deps:

```tsx
  const suggestions = useMemo(
    () => getSuggestions(value, nodeOutputs, parameters),
    [value, nodeOutputs, parameters],
  );
```

- [ ] **Step 6: Thread the prop through `ConditionBuilder`**

In `src/features/workflow/condition/ConditionBuilder.tsx`:
- Add `import type { NodeOutputs } from "../expression/nodeOutputs";`.
- In `BuilderProps` and `RowProps`, replace `nodeNames: string[];` with `nodeOutputs: NodeOutputs[];`.
- Replace every `nodeNames` usage (destructure, recursive `<ConditionBuilder>`, `<ComparisonRow>`, and both `<ExpressionInput>` calls) with `nodeOutputs`. There are 6 occurrences; rename all.

- [ ] **Step 7: Thread the prop through `ConditionEditor`**

In `src/features/workflow/condition/ConditionEditor.tsx`:
- Add `import type { NodeOutputs } from "../expression/nodeOutputs";`.
- In `ConditionEditorProps`, replace `nodeNames: string[];` with `nodeOutputs: NodeOutputs[];`.
- In the component params and the `<ConditionBuilder>` call, replace `nodeNames` with `nodeOutputs`.

- [ ] **Step 8: Type-check**

Run: `bunx tsc --noEmit`
Expected: errors ONLY in `Inspector.tsx` (still passes `nodeNames` to `ConditionEditor`) — that file is updated in Task 9. If any OTHER file errors, fix it here.

> Note: `Inspector.tsx` is intentionally left broken until Task 9. If you are running each task as an isolated commit and want a clean `tsc` at this commit, do Step 9 of Task 9 (the Inspector edit) before committing; otherwise proceed — Task 9 restores a clean type-check.

- [ ] **Step 9: Commit**

```bash
git add src/features/workflow/expression/suggestions.ts src/features/workflow/expression/suggestions.test.ts src/features/workflow/components/ExpressionInput.tsx src/features/workflow/condition/ConditionBuilder.tsx src/features/workflow/condition/ConditionEditor.tsx
git commit -m "feat(workflow): drive expression autocomplete from node outputs" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Agent node component, palette, and seeded params

**Files:**
- Create: `src/features/workflow/nodes/AgentNode.tsx`
- Modify: `src/features/workflow/nodes/nodeTypes.ts`
- Modify: `src/features/workflow/nodes/dragData.ts`
- Modify: `src/features/workflow/workflowSlice.ts`
- Modify: `src/features/workflow/workflowSlice.test.ts`
- Modify: `src/features/workflow/serialize.test.ts`

**Interfaces:**
- Consumes: `NodeType.AGENT`, `AgentNodeField` (Task 1); `state.agents.byId` (Task 3).
- Produces: the `agent` node renders in the canvas; `addNode({ type: "agent" })` seeds `{ agentConfigurationId: "", input: {}, output: "" }`.

- [ ] **Step 1: Write the failing slice + serialize tests**

Add to `src/features/workflow/workflowSlice.test.ts`:

```ts
test("addNode('agent') seeds empty camelCase agent params", () => {
  const state = reducer(undefined, addNode({ type: "agent" }));
  const node = state.nodes.find((n) => n.type === "agent");
  expect(node).toBeDefined();
  expect((node!.data as WorkflowNodeData).parameters).toEqual({
    agentConfigurationId: "",
    input: {},
    output: "",
  });
});
```

Add to `src/features/workflow/serialize.test.ts`:

```ts
test("toWorkflowDto emits an agent node with camelCase params verbatim", () => {
  const wf: SerializableWorkflow = {
    meta: { name: "wf", description: "", parameterSchema: {} },
    nodes: [
      {
        id: "coach",
        type: "agent",
        position: { x: 0, y: 0 },
        data: {
          description: "",
          parameters: {
            agentConfigurationId: "a1",
            input: { messages: "$parameters.question" },
            output: "state.answer",
          },
        },
      },
    ],
    edges: [],
  };
  const dto = toWorkflowDto(wf);
  expect(dto.nodes[0]!.parameters).toEqual({
    agentConfigurationId: "a1",
    input: { messages: "$parameters.question" },
    output: "state.answer",
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/features/workflow/workflowSlice.test.ts src/features/workflow/serialize.test.ts`
Expected: the slice test FAILS (agent seeds `{}` today). The serialize test PASSES already (serializer is generic) — that's fine; it guards the round-trip.

- [ ] **Step 3: Seed agent params in the slice**

In `src/features/workflow/workflowSlice.ts`:
- Add to the imports from `./constants`: `import { NodeType, EdgeLabel, AgentNodeField } from "./constants";`
- In `nodeData`, add an agent branch before the final `return`:

```ts
  if (type === NodeType.AGENT) {
    const p = AgentNodeField.AGENT_PARAM;
    return {
      description: "",
      parameters: { [p.AGENT_CONFIGURATION_ID]: "", [p.INPUT]: {}, [p.OUTPUT]: "" },
    };
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/features/workflow/workflowSlice.test.ts src/features/workflow/serialize.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the node component**

Create `src/features/workflow/nodes/AgentNode.tsx`:

```tsx
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useAppSelector } from "@/store/hooks";
import type { WorkflowNodeData } from "@/types/workflow";
import { AgentNodeField } from "../constants";

const PARAM = AgentNodeField.AGENT_PARAM;

export function AgentNode({ data, selected }: NodeProps) {
  const d = data as WorkflowNodeData;
  const agentId = d.parameters?.[PARAM.AGENT_CONFIGURATION_ID] as string | undefined;
  const output = d.parameters?.[PARAM.OUTPUT] as string | undefined;
  const agentName = useAppSelector((s) => (agentId ? s.agents.byId[agentId]?.name : undefined));

  return (
    <div
      className={`min-w-[180px] rounded-xl border bg-white px-4 py-3 shadow-sm dark:bg-slate-900 ${
        selected ? "border-primary" : "border-violet-300 dark:border-violet-500/40"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-violet-500" />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
        Agent
      </p>
      <p
        className="mt-0.5 max-w-[220px] truncate text-sm font-medium text-slate-800 dark:text-slate-100"
        title={agentName ?? "No agent selected"}
      >
        {agentName ?? "No agent selected"}
      </p>
      {output && (
        <p className="mt-0.5 max-w-[220px] truncate text-[11px] text-slate-400" title={output}>
          → {output}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-violet-500" />
    </div>
  );
}
```

- [ ] **Step 6: Register the node type**

Overwrite `src/features/workflow/nodes/nodeTypes.ts`:

```ts
import type { NodeTypes } from "@xyflow/react";
import { NodeType } from "../constants";
import { AgentNode } from "./AgentNode";
import { EndNode } from "./EndNode";
import { IfNode } from "./IfNode";
import { StartNode } from "./StartNode";

export const nodeTypes: NodeTypes = {
  [NodeType.START]: StartNode,
  [NodeType.END]: EndNode,
  [NodeType.IF]: IfNode,
  [NodeType.AGENT]: AgentNode,
};
```

- [ ] **Step 7: Add the palette item**

In `src/features/workflow/nodes/dragData.ts`, add the agent entry to `PALETTE_ITEMS` (before `End`):

```ts
export const PALETTE_ITEMS: PaletteItem[] = [
  { type: NodeType.START, label: "Start" },
  { type: NodeType.IF, label: "If / Condition" },
  { type: NodeType.AGENT, label: "Agent" },
  { type: NodeType.END, label: "End" },
];
```

- [ ] **Step 8: Type-check**

Run: `bunx tsc --noEmit`
Expected: same residual `Inspector.tsx` error from Task 7 only (resolved in Task 9). No new errors.

- [ ] **Step 9: Commit**

```bash
git add src/features/workflow/nodes/AgentNode.tsx src/features/workflow/nodes/nodeTypes.ts src/features/workflow/nodes/dragData.ts src/features/workflow/workflowSlice.ts src/features/workflow/workflowSlice.test.ts src/features/workflow/serialize.test.ts
git commit -m "feat(workflow): add the agent node and palette entry" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: AgentEditor + Inspector wiring + agent loading

**Files:**
- Create: `src/features/workflow/agent/AgentEditor.tsx`
- Modify: `src/features/workflow/Inspector.tsx`
- Modify: `src/features/workflow/WorkflowBuilderPage.tsx`

**Interfaces:**
- Consumes: `agentInputFields` (Task 4); `upstreamNodeIds` (Task 5); `buildNodeOutputs`, `NodeDescriptor`, `NodeOutputs` (Task 6); `ExpressionInput` (Task 7); `AgentNodeField` (Task 1); `loadAgents` (Task 3); `state.agents` (Task 3).
- Produces: the agent node's inspector UI; `Inspector` passes `nodeOutputs` to `ConditionEditor` and `AgentEditor`; agents load on page mount.

- [ ] **Step 1: Create `AgentEditor`**

Create `src/features/workflow/agent/AgentEditor.tsx`:

```tsx
import { useAppSelector } from "@/store/hooks";
import type { WorkflowNodeData } from "@/types/workflow";
import { ExpressionInput } from "../components/ExpressionInput";
import { AgentNodeField } from "../constants";
import type { NodeOutputs } from "../expression/nodeOutputs";
import type { ParameterEntry } from "../schema/parameterSchema";
import { agentInputFields } from "./inputFields";

const PARAM = AgentNodeField.AGENT_PARAM;

interface AgentEditorProps {
  parameters: Record<string, unknown>;
  nodeOutputs: NodeOutputs[];
  parameterEntries: ParameterEntry[];
  onChange: (data: Partial<WorkflowNodeData>) => void;
}

export function AgentEditor({ parameters, nodeOutputs, parameterEntries, onChange }: AgentEditorProps) {
  const status = useAppSelector((s) => s.agents.status);
  const agents = useAppSelector((s) => s.agents.ids.map((id) => s.agents.byId[id]!));
  const agentsById = useAppSelector((s) => s.agents.byId);

  const agentId = (parameters[PARAM.AGENT_CONFIGURATION_ID] as string) ?? "";
  const selectedAgent = agentId ? agentsById[agentId] : undefined;
  const input = (parameters[PARAM.INPUT] as Record<string, unknown>) ?? {};
  const output = (parameters[PARAM.OUTPUT] as string) ?? "";
  const fields = agentInputFields(selectedAgent?.inputSchema);

  function setParam(key: string, value: unknown) {
    onChange({ parameters: { ...parameters, [key]: value } });
  }
  function setInputField(name: string, value: string) {
    setParam(PARAM.INPUT, { ...input, [name]: value });
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Agent</span>
        {status === "loading" ? (
          <p className="text-sm text-slate-400">Loading agents…</p>
        ) : status === "error" ? (
          <p className="text-sm text-rose-500">Failed to load agents.</p>
        ) : (
          <select
            value={agentId}
            onChange={(e) => setParam(PARAM.AGENT_CONFIGURATION_ID, e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">Select an agent…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            {agentId && !selectedAgent && (
              <option value={agentId}>Unknown agent ({agentId})</option>
            )}
          </select>
        )}
      </label>

      {selectedAgent && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Input mapping
          </span>
          {fields.length === 0 && (
            <p className="text-xs italic text-slate-400">This agent has no input fields.</p>
          )}
          {fields.map((f) => (
            <label key={f.name} className="flex flex-col gap-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {f.name}
                {f.required && <span className="text-rose-500"> *</span>}
                {f.type && <span className="text-slate-400"> — {f.type}</span>}
              </span>
              <ExpressionInput
                value={(input[f.name] as string) ?? ""}
                nodeOutputs={nodeOutputs}
                parameters={parameterEntries}
                placeholder="$parameters.…"
                onChange={(v) => setInputField(f.name, v)}
              />
              {f.description && <span className="text-[11px] text-slate-400">{f.description}</span>}
            </label>
          ))}
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Output path
        </span>
        <input
          type="text"
          value={output}
          placeholder="state.answer"
          onChange={(e) => setParam(PARAM.OUTPUT, e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Wire `Inspector` — imports**

In `src/features/workflow/Inspector.tsx`, add to the React import on line 1 the `useMemo` hook, and add these imports near the other feature imports:

```tsx
import { AgentEditor } from "./agent/AgentEditor";
import { upstreamNodeIds } from "./expression/graph";
import { buildNodeOutputs, type NodeDescriptor } from "./expression/nodeOutputs";
import { AgentNodeField } from "./constants"; // extend the existing NodeType import line instead if preferred
```

(If `NodeType` is already imported from `./constants`, just add `AgentNodeField` to that existing import and drop the extra line.)

- [ ] **Step 3: Wire `Inspector` — selectors and nodeOutputs**

In the `Inspector` component body, after the existing `useAppSelector` calls, add:

```tsx
  const edges = useAppSelector((s) => s.workflow.edges);
  const agentsById = useAppSelector((s) => s.agents.byId);
```

Replace the line `const nodeNames = nodes.map((n) => n.id);` with:

```tsx
  const nodeOutputs = useMemo(() => {
    if (!selected) return [];
    const upstream = upstreamNodeIds(selected.id, edges);
    const descriptors: NodeDescriptor[] = nodes
      .filter((n) => upstream.has(n.id))
      .map((n) => ({
        name: n.id,
        type: n.type ?? "",
        agentConfigurationId: (n.data as WorkflowNodeData).parameters?.[
          AgentNodeField.AGENT_PARAM.AGENT_CONFIGURATION_ID
        ] as string | undefined,
      }));
    return buildNodeOutputs(descriptors, agentsById);
  }, [selected, edges, nodes, agentsById]);
```

- [ ] **Step 4: Wire `Inspector` — pass `nodeOutputs` and render `AgentEditor`**

In the `ConditionEditor` JSX, change the prop `nodeNames={nodeNames}` to `nodeOutputs={nodeOutputs}`.

Immediately after the `ConditionEditor` block (the `selected.type === NodeType.IF` branch), add:

```tsx
            {selected.type === NodeType.AGENT && (
              <AgentEditor
                key={selected.id}
                parameters={data.parameters}
                nodeOutputs={nodeOutputs}
                parameterEntries={parameters}
                onChange={(d) => dispatch(updateNodeData({ id: selected.id, data: d }))}
              />
            )}
```

(Here `parameters` is the existing `parameterEntries(parameterSchema)` value already computed in `Inspector`.)

- [ ] **Step 5: Load agents on page mount**

In `src/features/workflow/WorkflowBuilderPage.tsx`:
- Add the import: `import { loadAgents } from "./agents/agentsSlice";`
- Add a `useEffect` (after the existing `loadWorkflow` effect):

```tsx
  useEffect(() => {
    dispatch(loadAgents());
  }, [dispatch]);
```

- [ ] **Step 6: Full type-check + test sweep**

Run: `bunx tsc --noEmit`
Expected: no errors (the Task 7 residual is now resolved).

Run: `bun test`
Expected: all suites PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/workflow/agent/AgentEditor.tsx src/features/workflow/Inspector.tsx src/features/workflow/WorkflowBuilderPage.tsx
git commit -m "feat(workflow): edit agent nodes with upstream-aware input mapping" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Docs + final verification sweep

**Files:**
- Modify: `src/features/workflow/CLAUDE.md`

- [ ] **Step 1: Update the feature docs**

In `src/features/workflow/CLAUDE.md`, under "Files", add bullets for the new modules:

```
- `agent/AgentEditor.tsx` — inspector editor for `agent` nodes: agent picker, per-input-field expression mapping (`agent/inputFields.ts`), and the output-path input.
- `agent/inputFields.ts` — pure `agentInputFields(inputSchema)` → mappable field list.
- `agents/agentsSlice.ts` — Redux slice + `loadAgents` thunk caching agent configurations (fetched via `@/services/agents`, proxied through `/api/agents`).
- `expression/graph.ts` — `upstreamNodeIds(target, edges)`: a node's ancestor set, so expressions only reference earlier nodes.
- `expression/nodeOutputs.ts` — `NodeOutputs` model + `buildNodeOutputs`/`agentOutputFields`: what each node exposes under `$nodes.<name>.` (agent nodes expose `response`/`structuredResponse`(+output-schema fields)/`messages`).
- `schema/json.ts` — shared `isPlainObject` guard.
- `nodes/AgentNode.tsx` — the `agent` xyflow node (one target + one source handle; shows the selected agent name).
```

Under "Conventions", add:

```
- The agent node (`type: "agent"`) stores camelCase params `agentConfigurationId` / `input` / `output` in `data.parameters`. ⚠️ The chat service is being migrated from snake_case to these camelCase keys (params and node-context output keys); until that lands, saved agent workflows won't round-trip against the live backend. See `AgentNodeField` in `constants.ts`.
- Expression autocomplete consumes `NodeOutputs[]` (not bare names): the Inspector computes the selected node's upstream set (`upstreamNodeIds`) and builds agent-aware outputs (`buildNodeOutputs`) before passing them to `ConditionEditor`/`AgentEditor` → `ExpressionInput` → `getSuggestions`. A node can only reference nodes upstream of it.
```

- [ ] **Step 2: Run the full test suite**

Run: `bun test`
Expected: all suites PASS.

- [ ] **Step 3: Run the type-checker**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/workflow/CLAUDE.md
git commit -m "docs(workflow): document the agent node and node-output autocomplete" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage:** branch (done pre-plan) · agent node (T8) · agent select from API (T2 proxy, T3 slice, T9 select) · input-field mapping (T4 + T9) · output-field autocomplete schema (T6 + T7) · node ordering / upstream-only (T5 + T9 globally via T7). ✅
- **camelCase decision:** params + returned fields camelCase (T1 constants, T6 outputs, T8 seed/serialize). Backend dependency flagged in T1 comment and T10 docs. ✅
- **Type consistency:** `NodeOutputs`/`NodeOutputField`/`NodeDescriptor` defined in T6 and consumed unchanged in T7/T9; `agentOutputFields`/`buildNodeOutputs`/`upstreamNodeIds`/`agentInputFields`/`toAgentConfig`/`listAgents`/`loadAgents` names match across tasks. ✅
- **Known intermediate state:** `tsc` is briefly red between T7 and T9 (Inspector still references `nodeNames`); each affected commit notes this and T9 restores green. Per-task `bun test` stays green throughout.
