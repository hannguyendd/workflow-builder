import { useCallback, type DragEvent } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addNode, connected, edgesChanged, nodesChanged } from "./workflowSlice";
import { nodeTypes } from "./nodes/nodeTypes";
import { NODE_DRAG_MIME } from "./nodes/dragData";

export function WorkflowCanvas() {
  const dispatch = useAppDispatch();
  const nodes = useAppSelector((s) => s.workflow.nodes);
  const edges = useAppSelector((s) => s.workflow.edges);
  const theme = useAppSelector((s) => s.theme.theme);
  const { screenToFlowPosition } = useReactFlow();

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const type = e.dataTransfer.getData(NODE_DRAG_MIME);
      if (!type) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      dispatch(addNode({ type, position }));
    },
    [dispatch, screenToFlowPosition],
  );

  return (
    <div className="h-full w-full" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode={theme}
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
