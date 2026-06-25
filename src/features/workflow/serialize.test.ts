import { test, expect } from "bun:test";
import { fromWorkflowDto, toWorkflowDto } from "./serialize";
import { defaultCondition } from "./condition/jsonLogic";
import type { SerializableWorkflow, WorkflowDto } from "@/types/workflow";

const sample: WorkflowDto = {
  name: "Sample",
  description: "desc",
  parameterSchema: { type: "object", properties: {}, required: [] },
  nodes: [
    { name: "start", type: "start", description: "Workflow entry point", parameters: {}, position: { x: 300, y: 0 } },
    { name: "end", type: "end", description: "Workflow end", parameters: {}, position: { x: 300, y: 300 } },
  ],
  edges: {
    start: [{ to: "end", label: "main" }],
  },
};

test("fromWorkflowDto maps names to ids and edges to a flat list", () => {
  const wf = fromWorkflowDto(sample);
  expect(wf.meta.name).toBe("Sample");
  expect(wf.nodes.map((n) => n.id)).toEqual(["start", "end"]);
  expect(wf.nodes[0]!.type).toBe("start");
  expect(wf.nodes[0]!.data).toEqual({ description: "Workflow entry point", parameters: {} });
  expect(wf.edges).toHaveLength(1);
  expect(wf.edges[0]!.source).toBe("start");
  expect(wf.edges[0]!.target).toBe("end");
});

test("toWorkflowDto(fromWorkflowDto(dto)) round-trips unchanged", () => {
  expect(toWorkflowDto(fromWorkflowDto(sample))).toEqual(sample);
});

test("toWorkflowDto emits an if node with condition and true/false edges", () => {
  const condition = { ">": [{ var: "$state.age" }, 18] };
  const wf: SerializableWorkflow = {
    meta: { name: "wf", description: "", parameterSchema: {} },
    nodes: [
      { id: "if", type: "if", position: { x: 0, y: 0 }, data: { description: "", parameters: { condition } } },
      { id: "yes", type: "end", position: { x: 0, y: 100 }, data: { description: "", parameters: {} } },
      { id: "no", type: "end", position: { x: 100, y: 100 }, data: { description: "", parameters: {} } },
    ],
    edges: [
      { id: "if->yes:true", source: "if", target: "yes", label: "true", data: { label: "true" } },
      { id: "if->no:false", source: "if", target: "no", label: "false", data: { label: "false" } },
    ],
  };

  const dto = toWorkflowDto(wf);
  const ifDto = dto.nodes.find((n) => n.name === "if");
  expect(ifDto?.type).toBe("if");
  expect(ifDto?.parameters).toEqual({ condition });
  expect(dto.edges["if"]).toEqual([
    { to: "yes", label: "true" },
    { to: "no", label: "false" },
  ]);
});

test("toWorkflowDto emits an agent node with camelCase params verbatim", () => {
  const wf: SerializableWorkflow = {
    meta: { name: "wf", description: "", parameterSchema: {} },
    nodes: [
      {
        id: "coach",
        type: "agent",
        position: { x: 0, y: 0 },
        data: {
          description: "",
          parameters: {
            agentConfigurationId: "a1",
            input: { messages: "$parameters.question" },
            output: "state.answer",
          },
        },
      },
    ],
    edges: [],
  };
  const dto = toWorkflowDto(wf);
  expect(dto.nodes[0]!.parameters).toEqual({
    agentConfigurationId: "a1",
    input: { messages: "$parameters.question" },
    output: "state.answer",
  });
});

test("fromWorkflowDto restores an if node condition and labelled edges", () => {
  const condition = defaultCondition();
  const restored = fromWorkflowDto({
    name: "wf",
    description: "",
    parameterSchema: {},
    nodes: [{ name: "if", type: "if", description: "", parameters: { condition }, position: { x: 0, y: 0 } }],
    edges: { if: [{ to: "yes", label: "true" }, { to: "no", label: "false" }] },
  });
  const node = restored.nodes.find((n) => n.id === "if");
  expect((node!.data as { parameters: Record<string, unknown> }).parameters.condition).toEqual(condition);
  expect(restored.edges.map((e) => e.label)).toEqual(["true", "false"]);
});
