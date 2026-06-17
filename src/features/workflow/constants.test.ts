import { expect, test } from "bun:test";
import { AgentNodeField, CONTEXT_SOURCES, ConditionEdge, EdgeLabel, NodeType } from "./constants";

test("node type identifiers match the chat-service schema", () => {
  expect(NodeType.START).toBe("start");
  expect(NodeType.END).toBe("end");
  expect(NodeType.IF).toBe("if");
});

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

test("edge labels match the chat-service schema", () => {
  expect(EdgeLabel.MAIN).toBe("main");
  expect(ConditionEdge.TRUE).toBe("true");
  expect(ConditionEdge.FALSE).toBe("false");
});

test("context sources cover every variable prefix", () => {
  expect([...CONTEXT_SOURCES]).toEqual([
    "$state",
    "$config",
    "$variables",
    "$parameters",
    "$nodes",
    "$trigger",
  ]);
});
