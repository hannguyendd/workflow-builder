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
