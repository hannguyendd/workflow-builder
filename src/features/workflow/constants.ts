/**
 * Frontend mirror of the chat service's `core/constants/workflow.py`.
 * Keep these in sync with that file — `constants.test.ts` guards the contract.
 */

/** Node type identifiers used in workflow definitions (NodeType). */
export const NodeType = {
  START: "start",
  END: "end",
  IF: "if",
} as const;
export type NodeTypeValue = (typeof NodeType)[keyof typeof NodeType];

/** Common edge label shared across node types (EdgeLabel). */
export const EdgeLabel = {
  MAIN: "main",
} as const;

/** Branch labels specific to the condition node (ConditionEdge). */
export const ConditionEdge = {
  TRUE: "true",
  FALSE: "false",
} as const;

/** Variable source prefixes used in path resolution (ContextSource). */
export const CONTEXT_SOURCES = [
  "$state",
  "$config",
  "$variables",
  "$parameters",
  "$nodes",
  "$trigger",
] as const;
