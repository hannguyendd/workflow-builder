# Agent node for the workflow builder

**Date:** 2026-06-17
**Branch:** `feat/workflow-agent-node` (from `feat/workflow-parameter-schema`)

## Goal

Add an `agent` node type to the visual workflow builder. The node invokes a
Taggle agent configuration. In the editor it must let the user:

1. Pick an agent from the live list of agent configurations.
2. Map each of the agent's input-schema fields to a workflow expression.
3. Reference the agent's returned fields downstream via `$nodes.<name>.…`
   autocomplete (driven by the agent's output schema).

It must also enforce node ordering: an expression in a node may only reference
nodes that come **before** it in the graph.

## Background (verified against the chat service)

Backend `AgentNode`
(`taggle-ext-chat/packages/service/service/workflows/nodes/agent.py`):

- **Parameters** (currently snake_case in the backend — consumed by
  `AgentNode.__init__` / emitted by `to_dict`): `agent_configuration_id` (UUID
  string), `input` (dict of expressions whose keys match the agent's
  `input_schema`; `messages` is special and used for `ainvoke`), `output` (a
  state path where the result is written). Per the decision below these move to
  camelCase on both sides.
- **Output context** (stored under `node_context[node_name]`, currently
  snake_case in the backend): `response` (str), `structured_response`
  (dict, shaped by the agent's optional `output_schema`, else `None`),
  `messages` (list).

Agent API (`taggle-ext-chat/https/agent-api.http`,
`packages/core/core/schemas/agent_configuration.py`):

- `GET {base}/chat2/api/v1/agents?page=&pageSize=&status=` →
  `PagingResponse<AgentConfigResponse>`. Responses are **camelCase**
  (`items`, `currentPage`, `pageSize`, `totalItems`, …) via pydantic's
  `to_camel` alias generator.
- `AgentConfigResponse` fields used here: `id`, `name`, `description`,
  `inputSchema`, `outputSchema` (nullable → free-text response), `status`.
- Requires an `Organization` header (e.g. `TAGGLE`).

Frontend today (`src/features/workflow`): nodes (`start`/`end`/`if`) are custom
xyflow components registered in `nodes/nodeTypes.ts` + `PALETTE_ITEMS`, seeded by
`nodeData(type)` in `workflowSlice.ts`, edited in `Inspector.tsx`.
`serialize.ts` passes `data.parameters` through verbatim, so a new node type
serializes once its parameters are seeded/edited. Autocomplete flows
`parameterEntries`/`nodeNames` → `Inspector` → `ConditionEditor` →
`ConditionBuilder` → `ExpressionInput` → `getSuggestions`, which today lists
**all** node names and stops past the node-name segment.

## Decisions (from brainstorming)

- **Agent data source:** proxy through the Bun server (keeps real UUIDs +
  tenant header server-side, avoids CORS).
- **Output autocomplete depth:** top-level fields **plus**
  `structuredResponse.<field>` drawn from the agent's `outputSchema`.
- **Everything camelCase, both parameters and returned fields.** Param keys:
  `agentConfigurationId`, `input`, `output`. Returned fields: `response`,
  `structuredResponse`, `messages`. ⚠️ The chat service is currently snake_case
  on both (`agent_configuration_id` in `AgentNode.__init__` / `to_dict`,
  `structured_response` in node-context); it will be updated to camelCase so the
  saved node parameters load and `$nodes.x.structuredResponse` references
  resolve at runtime. This is a **backend dependency** (both the `NodeBuilder`
  param reads and the node-context output keys), flagged in code comments.
- **Upstream-only node references apply globally** — to every expression input,
  including the existing if-node condition editor.
- The agent dropdown lists **all** agents (no `status` filter) so drafts are
  usable during development.
- `output` is a **plain path text input**, not an expression field.

## Architecture

### Constants (`features/workflow/constants.ts` + `constants.test.ts`)

- Add `AGENT: "agent"` to `NodeType`.
- Add an `AgentNodeField` mirror in two parts (all camelCase):
  - `AGENT_PARAM`: `AGENT_CONFIGURATION_ID = "agentConfigurationId"`,
    `INPUT = "input"`, `OUTPUT = "output"`.
  - `AGENT_OUTPUT`: `RESPONSE = "response"`,
    `STRUCTURED_RESPONSE = "structuredResponse"`, `MESSAGES = "messages"`.
- `constants.test.ts` asserts the new values. Code comment notes the backend
  camelCase dependency for both the param keys and the output keys.

### Agent data layer

- **Bun proxy** (`src/index.ts`): `GET /api/agents` forwards to
  `${TAGGLE_API_BASE_URL}${TAGGLE_API_PREFIX}/agents`, sets the `Organization`
  header, passes through `status`/`page`/`pageSize`. Config constants are
  env-overridable (defaults `http://localhost:8000`, `/chat2/api/v1`,
  `TAGGLE`). Upstream non-OK → respond `502`.
- **Transport** (`src/services/agents.ts`): `listAgents()` GETs `/api/agents`,
  maps the camelCase `PagingResponse.items` to `AgentConfig`
  (`{ id, name, description, inputSchema, outputSchema, status }`). Throws on
  non-OK (per the services convention).
- **Type** (`src/types/agent.ts`): `AgentConfig` plus the response DTO shape;
  type-only, side-effect free.
- **Slice** (`features/workflow/agents/agentsSlice.ts`): state
  `{ byId: Record<string, AgentConfig>, ids: string[], status: "idle" | "loading" | "ready" | "error" }`,
  populated by a `loadAgents` async thunk. Registered in `store/index.ts`,
  dispatched on `WorkflowBuilderPage` mount.

### Agent node + palette

- `nodes/AgentNode.tsx`: card with one target handle (top) and one source
  handle (bottom, default `main` label). Shows the "Agent" label, the selected
  agent's name (or "No agent selected"), and the output path. Registered in
  `nodes/nodeTypes.ts` and added to `PALETTE_ITEMS` in `nodes/dragData.ts`.
- `nodeData(AGENT)` seed in `workflowSlice.ts`:
  `{ description: "", parameters: { agentConfigurationId: "", input: {}, output: "" } }`.
  Serializer unchanged.

### Agent inspector editor (`features/workflow/agent/`)

Rendered by `Inspector.tsx` when `selected.type === NodeType.AGENT`:

- **`AgentEditor.tsx`** —
  - Agent select (filterable) from the agents store → dispatches
    `updateNodeData` setting `parameters.agentConfigurationId`. Shows
    loading / empty / error states from the slice `status`.
  - Input mapping: one `ExpressionInput` per agent input field, bound to
    `parameters.input[fieldName]`; required fields (incl. `messages`) flagged
    with type/description hints.
  - Output path: plain text input bound to `parameters.output`.
- **`agent/inputFields.ts`** — pure `agentInputFields(inputSchema)` →
  `{ name, type, required, description }[]` for each top-level property (any
  type allowed; each maps to an expression). Tested.
- **`agent/outputFields.ts`** — pure `agentOutputFields(agent)` →
  `NodeOutputField[]`: the three top-level camelCase fields, with
  `structuredResponse` carrying children built from the agent's `outputSchema`
  properties. Tested.

### Upstream-aware, agent-aware autocomplete (reqs 5 + 6)

Replace `getSuggestions`'s `nodeNames: string[]` argument with a richer,
pre-filtered `NodeOutputs[]`:

- **`expression/graph.ts`** — pure `upstreamNodeIds(selectedId, edges): Set<string>`,
  the ancestor set via reverse BFS over edges. Tested.
- **`expression/nodeOutputs.ts`** —
  - `interface NodeOutputField { name: string; type: string; description?: string; children?: NodeOutputField[] }`
  - `interface NodeOutputs { name: string; type: string; fields: NodeOutputField[] }`
  - A builder that maps a node + the agents store to `NodeOutputs`: agent nodes
    get `agentOutputFields(agent)`; other node types get `fields: []` (so
    `$nodes.<name>.` yields nothing, matching today). Tested.
- **`expression/suggestions.ts`** — extended:
  - `$nodes.` → names from the (already upstream-filtered) `NodeOutputs`.
  - `$nodes.<name>.` → that node's top-level `fields`.
  - `$nodes.<name>.structuredResponse.` → that field's `children`.
  - deeper / unknown → none. `$state`/`$parameters`/etc. unchanged.
- **`Inspector.tsx`** computes `upstreamNodeIds(selected.id, edges)` (now also
  selects `s.workflow.edges`), builds `NodeOutputs[]` for those upstream nodes
  (agent-aware via the agents store), and passes it down.
- **`ConditionEditor.tsx` / `ConditionBuilder.tsx` / `ExpressionInput.tsx`**
  swap their `nodeNames: string[]` prop for `nodeOutputs: NodeOutputs[]`.

Alternatives rejected: a parallel `nodeFields` map alongside `nodeNames` (two
params to keep in sync); passing raw nodes+edges+agents into `getSuggestions`
(couples the pure helper to store/xyflow shapes).

## Data flow

```
WorkflowBuilderPage (mount) ──dispatch──▶ loadAgents thunk ──▶ agentsSlice.byId
Inspector
  ├─ reads nodes, edges, agents.byId, parameterSchema
  ├─ upstreamNodeIds(selected.id, edges) ──▶ buildNodeOutputs(upstream, agents)
  ├─ if  node → ConditionEditor(nodeOutputs, parameters)
  └─ agent node → AgentEditor(agent, nodeOutputs, parameters)
        ├─ agent select        → updateNodeData(parameters.agentConfigurationId)
        ├─ input field inputs  → updateNodeData(parameters.input[field])  [ExpressionInput → getSuggestions(nodeOutputs)]
        └─ output path input   → updateNodeData(parameters.output)
```

## Error handling

- Proxy: upstream unreachable/non-OK → `502` with a short message; the slice
  enters `error`; the agent select shows an error + the workflow stays editable.
- `listAgents` throws on non-OK (convention); the thunk maps rejection to
  `status: "error"`.
- Selecting an agent then editing the workflow when the agent list later fails
  to refresh: the stored `agentConfigurationId` is preserved; if the id is no
  longer in `byId`, the select shows the raw id and input mapping falls back to
  "agent unavailable" (no field rows), leaving `parameters.input` untouched.

## Testing

Pure + `bun test`:
- `expression/graph.test.ts` — `upstreamNodeIds` (chains, branches, cycles guard,
  no-incoming root).
- `agent/inputFields.test.ts` — property extraction, required flags, missing
  schema.
- `agent/outputFields.test.ts` / `expression/nodeOutputs.test.ts` — camelCase
  top-level fields, `structuredResponse` children from `outputSchema`,
  non-agent nodes empty.
- `expression/suggestions.test.ts` — updated for the `NodeOutputs[]` signature
  and field/child drilling.
- `constants.test.ts` — `AGENT` + `AgentNodeField` values.
- `workflowSlice.test.ts` — `addNode("agent")` seeds the camelCase params.
- `serialize.test.ts` — an agent node round-trips.

Components (`AgentNode`, `AgentEditor`, edited `Inspector`/`ConditionEditor`/
`ConditionBuilder`/`ExpressionInput`) verified via `bunx tsc --noEmit`.

## Out of scope

- Client-side validation of mapped input values against the agent's
  `inputSchema` types (the backend validates at runtime).
- Editing / creating agent configurations from the builder.
- Pagination/infinite scroll in the agent select (single page, large
  `pageSize`).
- Auto-rewriting `$nodes.<name>.…` references inside other nodes on rename
  (pre-existing limitation, unchanged).
```
