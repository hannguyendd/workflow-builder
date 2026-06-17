import type { NodeTypes } from "@xyflow/react";
import { NodeType } from "../constants";
import { AgentNode } from "./AgentNode";
import { EndNode } from "./EndNode";
import { IfNode } from "./IfNode";
import { StartNode } from "./StartNode";

export const nodeTypes: NodeTypes = {
  [NodeType.START]: StartNode,
  [NodeType.END]: EndNode,
  [NodeType.IF]: IfNode,
  [NodeType.AGENT]: AgentNode,
};
