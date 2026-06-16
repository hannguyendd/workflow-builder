import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import type { SerializableWorkflow, WorkflowDto, WorkflowNodeData } from "@/types/workflow";
import { fromWorkflowDto } from "./serialize";

export type WorkflowState = SerializableWorkflow;

const DEFAULT_PARAMETER_SCHEMA = { type: "object", properties: {}, required: [] };

function nodeData(type: string): WorkflowNodeData {
  const description = type === "start" ? "Workflow entry point" : type === "end" ? "Workflow end" : "";
  return { description, parameters: {} };
}

/** Pick an unused id: the bare type, else `${type}_2`, `${type}_3`, ... */
function uniqueId(type: string, nodes: Node[]): string {
  const taken = new Set(nodes.map((n) => n.id));
  if (!taken.has(type)) return type;
  let i = 2;
  while (taken.has(`${type}_${i}`)) i++;
  return `${type}_${i}`;
}

/** Initial seed: a Start and an End node, ready to connect. */
const initialState: WorkflowState = {
  meta: { name: "Untitled workflow", description: "", parameterSchema: DEFAULT_PARAMETER_SCHEMA },
  nodes: [
    { id: "start", type: "start", position: { x: 300, y: 0 }, data: nodeData("start") },
    { id: "end", type: "end", position: { x: 300, y: 300 }, data: nodeData("end") },
  ],
  edges: [],
};

const slice = createSlice({
  name: "workflow",
  initialState,
  reducers: {
    nodesChanged(state, action: PayloadAction<NodeChange[]>) {
      state.nodes = applyNodeChanges(action.payload, state.nodes);
    },
    edgesChanged(state, action: PayloadAction<EdgeChange[]>) {
      state.edges = applyEdgeChanges(action.payload, state.edges);
    },
    connected(state, action: PayloadAction<Connection>) {
      const c = action.payload;
      const edge: Edge = {
        id: `${c.source}->${c.target}`,
        source: c.source,
        target: c.target,
        sourceHandle: c.sourceHandle ?? null,
        targetHandle: c.targetHandle ?? null,
        label: "main",
        data: { label: "main" },
      };
      state.edges = addEdge(edge, state.edges);
    },
    addNode(state, action: PayloadAction<{ type: string }>) {
      const { type } = action.payload;
      state.nodes.push({
        id: uniqueId(type, state.nodes),
        type,
        position: { x: 200, y: 200 },
        data: nodeData(type),
      });
    },
    setWorkflow(state, action: PayloadAction<WorkflowDto>) {
      const wf = fromWorkflowDto(action.payload);
      state.meta = wf.meta;
      state.nodes = wf.nodes;
      state.edges = wf.edges;
    },
  },
});

export const { nodesChanged, edgesChanged, connected, addNode, setWorkflow } = slice.actions;
export default slice.reducer;
