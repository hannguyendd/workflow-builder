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

/**
 * Node-name rules — mirror of `core/constants/workflow.py`. The chat service's
 * `NodeBuilder.build()` rejects names that don't match `NODE_NAME_PATTERN`, so
 * the editor enforces the same rule to avoid save-time failures.
 */
export const NODE_NAME_MIN_LENGTH = 3;
export const NODE_NAME_MAX_LENGTH = 40;
export const NODE_NAME_PATTERN = new RegExp(
  `^[A-Za-z0-9][A-Za-z0-9_ \\-]{${NODE_NAME_MIN_LENGTH - 1},${NODE_NAME_MAX_LENGTH - 1}}$`,
);
export const NODE_NAME_RULE_TEXT =
  `must start with a letter or digit and be ${NODE_NAME_MIN_LENGTH}-${NODE_NAME_MAX_LENGTH} ` +
  "characters long, using only letters, digits, underscores, hyphens, and spaces";
