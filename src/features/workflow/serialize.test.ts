import { test, expect } from "bun:test";
import { fromWorkflowDto, toWorkflowDto } from "./serialize";
import type { WorkflowDto } from "@/types/workflow";

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
