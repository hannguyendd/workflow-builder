# src/types

Shared TypeScript contracts for the workflow domain. No runtime code — types only.

## Files

- `workflow.ts` — the workflow type system, split into two worlds:
  - **Persisted DTOs** (`WorkflowNodeDto`, `WorkflowEdgeDto`, `WorkflowEdgeMap`, `WorkflowDto`) — the JSON shape saved to disk / sent to the backend. Matches the Taggle workflow schema. Edges are stored as a map: `source node name -> outgoing edges`.
  - **In-app shapes** (`WorkflowMeta`, `WorkflowNodeData`, `SerializableWorkflow`) — what the Redux store holds. Nodes/edges are plain `@xyflow/react` `Node`/`Edge`; every node's `data` follows `WorkflowNodeData`.

## Conventions

- Keep this folder side-effect free: interfaces, types, and type-only re-exports only.
- The DTO ↔ store mapping lives in `@/features/workflow/serialize.ts`, not here. When you change a DTO field, update the serializer too.
- A persisted node's `name` is the xyflow node `id` (the serializer maps `name <-> id`).
