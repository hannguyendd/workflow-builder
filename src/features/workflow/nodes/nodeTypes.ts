import type { NodeTypes } from "@xyflow/react";
import { EndNode } from "./EndNode";
import { StartNode } from "./StartNode";

export const nodeTypes: NodeTypes = {
  start: StartNode,
  end: EndNode,
};
