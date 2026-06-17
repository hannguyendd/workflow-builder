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
import { NodeType, EdgeLabel } from "./constants";
import { defaultCondition } from "./condition/jsonLogic";
import { validateNodeName } from "./nodeName";

export type WorkflowState = SerializableWorkflow;

const DEFAULT_PARAMETER_SCHEMA = { type: "object", properties: {}, required: [] };

function nodeData(type: string): WorkflowNodeData {
  if (type === NodeType.START) return { description: "Workflow entry point", parameters: {} };
  if (type === NodeType.END) return { description: "Workflow end", parameters: {} };
  if (type === NodeType.IF) return { description: "", parameters: { condition: defaultCondition() } };
  return { description: "", parameters: {} };
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
    { id: NodeType.START, type: NodeType.START, position: { x: 300, y: 0 }, data: nodeData(NodeType.START) },
    { id: NodeType.END, type: NodeType.END, position: { x: 300, y: 300 }, data: nodeData(NodeType.END) },
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
      const label = c.sourceHandle ?? EdgeLabel.MAIN;
      const edge: Edge = {
        id: `${c.source}->${c.target}:${label}`,
        source: c.source,
        target: c.target,
        sourceHandle: c.sourceHandle ?? null,
        targetHandle: c.targetHandle ?? null,
        label,
        data: { label },
      };
      state.edges = addEdge(edge, state.edges);
    },
    addNode(state, action: PayloadAction<{ type: string; position?: { x: number; y: number } }>) {
      const { type, position } = action.payload;
      state.nodes.push({
        id: uniqueId(type, state.nodes),
        type,
        position: position ?? { x: 200, y: 200 },
        data: nodeData(type),
      });
    },
    updateNodeData(state, action: PayloadAction<{ id: string; data: Partial<WorkflowNodeData> }>) {
      const { id, data } = action.payload;
      const node = state.nodes.find((n) => n.id === id);
      if (node) node.data = { ...(node.data as WorkflowNodeData), ...data };
    },
    updateParameterSchema(state, action: PayloadAction<Record<string, unknown>>) {
      state.meta.parameterSchema = action.payload;
    },
    // A node's id is its persisted name, and edges reference nodes by id, so a
    // rename rewrites every edge that touches the node (and its derived id).
    // Invalid or duplicate names are ignored — the inspector surfaces the error.
    renameNode(state, action: PayloadAction<{ id: string; name: string }>) {
      const { id, name } = action.payload;
      if (name === id) return;
      const takenIds = state.nodes.filter((n) => n.id !== id).map((n) => n.id);
      if (validateNodeName(name, takenIds) !== null) return;
      const node = state.nodes.find((n) => n.id === id);
      if (!node) return;
      node.id = name;
      for (const e of state.edges) {
        if (e.source !== id && e.target !== id) continue;
        if (e.source === id) e.source = name;
        if (e.target === id) e.target = name;
        const label = typeof e.label === "string" ? e.label : EdgeLabel.MAIN;
        e.id = `${e.source}->${e.target}:${label}`;
      }
    },
    setWorkflow(state, action: PayloadAction<WorkflowDto>) {
      const wf = fromWorkflowDto(action.payload);
      state.meta = wf.meta;
      state.nodes = wf.nodes;
      state.edges = wf.edges;
    },
  },
});

export const {
  nodesChanged,
  edgesChanged,
  connected,
  addNode,
  updateNodeData,
  updateParameterSchema,
  renameNode,
  setWorkflow,
} = slice.actions;
export default slice.reducer;
