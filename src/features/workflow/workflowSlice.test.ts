import { test, expect } from "bun:test";
import reducer, { addNode, connected, setWorkflow } from "./workflowSlice";
import type { WorkflowDto } from "@/types/workflow";

const empty = { meta: { name: "x", description: "", parameterSchema: {} }, nodes: [], edges: [] };

test("addNode appends a node whose id equals its type when unused", () => {
  const next = reducer(empty, addNode({ type: "start" }));
  expect(next.nodes).toHaveLength(1);
  expect(next.nodes[0]!.id).toBe("start");
  expect(next.nodes[0]!.type).toBe("start");
});

test("addNode generates a unique id when the type id is taken", () => {
  const once = reducer(empty, addNode({ type: "end" }));
  const twice = reducer(once, addNode({ type: "end" }));
  expect(twice.nodes.map((n) => n.id)).toEqual(["end", "end_2"]);
});

test("connected adds an edge labelled main", () => {
  const next = reducer(empty, connected({ source: "start", target: "end", sourceHandle: null, targetHandle: null }));
  expect(next.edges).toHaveLength(1);
  expect(next.edges[0]!.source).toBe("start");
  expect(next.edges[0]!.target).toBe("end");
  expect(next.edges[0]!.label).toBe("main");
});

test("setWorkflow replaces state from a dto", () => {
  const dto: WorkflowDto = {
    name: "Loaded", description: "d", parameterSchema: {},
    nodes: [{ name: "start", type: "start", description: "Workflow entry point", parameters: {}, position: { x: 0, y: 0 } }],
    edges: {},
  };
  const next = reducer(empty, setWorkflow(dto));
  expect(next.meta.name).toBe("Loaded");
  expect(next.nodes).toHaveLength(1);
  expect(next.nodes[0]!.id).toBe("start");
});

test("addNode places the node at the given position when provided", () => {
  const next = reducer(empty, addNode({ type: "start", position: { x: 42, y: 99 } }));
  expect(next.nodes[0]!.position).toEqual({ x: 42, y: 99 });
});

test("addNode falls back to the default position when omitted", () => {
  const next = reducer(empty, addNode({ type: "start" }));
  expect(next.nodes[0]!.position).toEqual({ x: 200, y: 200 });
});
