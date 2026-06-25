import { expect, test } from "bun:test";
import { CONTEXT_SOURCES, ConditionEdge, EdgeLabel, NodeType } from "./constants";

test("node type identifiers match the chat-service schema", () => {
  expect(NodeType.START).toBe("start");
  expect(NodeType.END).toBe("end");
  expect(NodeType.IF).toBe("if");
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
