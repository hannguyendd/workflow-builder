import type { Node, Edge } from "@xyflow/react";

/** A workflow node as persisted in JSON (matches the Taggle workflow schema). */
export interface WorkflowNodeDto {
  name: string;
  type: string;
  description: string;
  parameters: Record<string, unknown>;
  position: { x: number; y: number };
}

/** One outgoing edge in the persisted JSON. */
export interface WorkflowEdgeDto {
  to: string;
  label: string;
}

/** Persisted edges: source node name -> outgoing edges. */
export type WorkflowEdgeMap = Record<string, WorkflowEdgeDto[]>;

/** A full workflow document as persisted to disk / sent to the backend. */
export interface WorkflowDto {
  name: string;
  description: string;
  parameterSchema: Record<string, unknown>;
  nodes: WorkflowNodeDto[];
  edges: WorkflowEdgeMap;
}

/** Workflow-level fields kept in the Redux store. */
export interface WorkflowMeta {
  name: string;
  description: string;
  parameterSchema: Record<string, unknown>;
}

/**
 * Convention for the `data` carried by every xyflow node in this app.
 * Nodes are stored as plain `Node`/`Edge`; `data` always has this shape.
 */
export interface WorkflowNodeData extends Record<string, unknown> {
  description: string;
  parameters: Record<string, unknown>;
}

/** The in-memory workflow shape the store holds and the serializer maps. */
export interface SerializableWorkflow {
  meta: WorkflowMeta;
  nodes: Node[];
  edges: Edge[];
}
