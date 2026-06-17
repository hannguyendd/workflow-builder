import { test, expect } from "bun:test";
import reducer, {
  addNode,
  connected,
  renameNode,
  setWorkflow,
  updateNodeData,
  updateParameterSchema,
} from "./workflowSlice";
import { defaultCondition } from "./condition/jsonLogic";
import type { WorkflowDto, WorkflowNodeData } from "@/types/workflow";

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

test("addNode('if') seeds a default condition", () => {
  const state = reducer(undefined, addNode({ type: "if" }));
  const ifNode = state.nodes.find((n) => n.type === "if");
  expect(ifNode).toBeDefined();
  expect((ifNode!.data as WorkflowNodeData).parameters).toEqual({ condition: defaultCondition() });
});

test("connected derives the edge label from the source handle", () => {
  const base = reducer(undefined, addNode({ type: "if" }));
  const next = reducer(
    base,
    connected({ source: "if", target: "end", sourceHandle: "true", targetHandle: null }),
  );
  const edge = next.edges.find((e) => e.source === "if" && e.target === "end");
  expect(edge?.label).toBe("true");
  expect(edge?.id).toBe("if->end:true");
});

test("connected falls back to 'main' when there is no source handle", () => {
  const base = reducer(undefined, addNode({ type: "if" }));
  const next = reducer(
    base,
    connected({ source: "start", target: "end", sourceHandle: null, targetHandle: null }),
  );
  expect(next.edges.find((e) => e.source === "start")?.label).toBe("main");
});

test("updateNodeData merges into the node's data", () => {
  const base = reducer(undefined, addNode({ type: "if" }));
  const next = reducer(base, updateNodeData({ id: "if", data: { description: "branch on age" } }));
  const node = next.nodes.find((n) => n.id === "if");
  expect((node!.data as WorkflowNodeData).description).toBe("branch on age");
});

test("renameNode renames the node and rewrites edges that reference it", () => {
  let state = reducer(undefined, addNode({ type: "if" }));
  state = reducer(
    state,
    connected({ source: "start", target: "if", sourceHandle: null, targetHandle: null }),
  );
  state = reducer(
    state,
    connected({ source: "if", target: "end", sourceHandle: "true", targetHandle: null }),
  );

  const next = reducer(state, renameNode({ id: "if", name: "age_gate" }));

  expect(next.nodes.find((n) => n.id === "if")).toBeUndefined();
  expect(next.nodes.find((n) => n.id === "age_gate")).toBeDefined();
  const incoming = next.edges.find((e) => e.source === "start");
  const outgoing = next.edges.find((e) => e.target === "end");
  expect(incoming?.target).toBe("age_gate");
  expect(incoming?.id).toBe("start->age_gate:main");
  expect(outgoing?.source).toBe("age_gate");
  expect(outgoing?.id).toBe("age_gate->end:true");
  expect(outgoing?.label).toBe("true");
});

test("renameNode is a no-op for a duplicate name", () => {
  const state = reducer(undefined, addNode({ type: "if" }));
  const next = reducer(state, renameNode({ id: "if", name: "end" }));
  expect(next.nodes.find((n) => n.id === "if")).toBeDefined();
  expect(next.nodes.filter((n) => n.id === "end")).toHaveLength(1);
});

test("renameNode is a no-op for an invalid name", () => {
  const state = reducer(undefined, addNode({ type: "if" }));
  const next = reducer(state, renameNode({ id: "if", name: "x" })); // too short
  expect(next.nodes.find((n) => n.id === "if")).toBeDefined();
});

test("updateParameterSchema replaces meta.parameterSchema", () => {
  const schema = {
    type: "object",
    properties: { userId: { type: "string" } },
    required: ["userId"],
  };
  const state = reducer(empty, updateParameterSchema(schema));
  expect(state.meta.parameterSchema).toEqual(schema);
});
