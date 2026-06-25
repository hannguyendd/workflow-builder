import type {
  SerializableWorkflow,
  WorkflowDto,
  WorkflowEdgeMap,
  WorkflowNodeData,
  WorkflowNodeDto,
} from "@/types/workflow";
import type { Edge, Node } from "@xyflow/react";

/** xyflow store shape -> persisted JSON document. */
export function toWorkflowDto(wf: SerializableWorkflow): WorkflowDto {
  const nodes: WorkflowNodeDto[] = wf.nodes.map((n) => {
    const data = n.data as WorkflowNodeData;
    return {
      name: n.id,
      type: n.type ?? "",
      description: data.description,
      parameters: data.parameters,
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
    };
  });

  const edges: WorkflowEdgeMap = {};
  for (const e of wf.edges) {
    const label = typeof e.label === "string" ? e.label : "main";
    (edges[e.source] ??= []).push({ to: e.target, label });
  }

  return { ...wf.meta, nodes, edges };
}

/** Persisted JSON document -> xyflow store shape. */
export function fromWorkflowDto(dto: WorkflowDto): SerializableWorkflow {
  const nodes: Node[] = dto.nodes.map((n) => ({
    id: n.name,
    type: n.type,
    position: { x: n.position.x, y: n.position.y },
    data: { description: n.description, parameters: n.parameters } satisfies WorkflowNodeData,
  }));

  const edges: Edge[] = [];
  for (const [source, list] of Object.entries(dto.edges)) {
    for (const e of list) {
      edges.push({
        id: `${source}->${e.to}:${e.label}`,
        source,
        target: e.to,
        label: e.label,
        data: { label: e.label },
      });
    }
  }

  return {
    meta: { name: dto.name, description: dto.description, parameterSchema: dto.parameterSchema },
    nodes,
    edges,
  };
}
