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
