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
