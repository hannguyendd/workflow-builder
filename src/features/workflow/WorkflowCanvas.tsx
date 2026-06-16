import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { connected, edgesChanged, nodesChanged } from "./workflowSlice";
import { nodeTypes } from "./nodes/nodeTypes";

export function WorkflowCanvas() {
  const dispatch = useAppDispatch();
  const nodes = useAppSelector((s) => s.workflow.nodes);
  const edges = useAppSelector((s) => s.workflow.edges);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={(changes: NodeChange[]) => dispatch(nodesChanged(changes))}
        onEdgesChange={(changes: EdgeChange[]) => dispatch(edgesChanged(changes))}
        onConnect={(connection: Connection) => dispatch(connected(connection))}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
