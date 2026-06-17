# src/services

Client-side data access. Thin `fetch` wrappers around the Bun server's `/api/*` routes. No React, no Redux.

## Files

- `workflow.ts` — `loadWorkflow()` (GET `/api/workflow`, returns `null` on 404) and `saveWorkflow(dto)` (PUT `/api/workflow`). Both speak the persisted `WorkflowDto`.
- `agents.ts` — `listAgents()` (GET `/api/agents`, proxied to the Taggle agent API) and the pure `toAgentConfig` mapper. Returns `AgentConfig[]` from `@/types/agent`.

## Conventions

- Functions take/return DTOs from `@/types/workflow` — never xyflow `Node`/`Edge` or store shapes. Convert with `@/features/workflow/serialize.ts` at the call site.
- Throw on non-OK responses; let callers handle errors. The one expected non-error status is 404 (no workflow saved yet) → return `null`.
- Keep these pure transport functions: no state, no side effects beyond the request.
- Server routes are defined in `src/index.ts`; keep paths in sync.
