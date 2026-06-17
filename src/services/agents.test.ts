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
