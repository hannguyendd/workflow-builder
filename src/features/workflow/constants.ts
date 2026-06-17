/**
 * Frontend mirror of the chat service's `core/constants/workflow.py`.
 * Keep these in sync with that file — `constants.test.ts` guards the contract.
 */

/** Node type identifiers used in workflow definitions (NodeType). */
export const NodeType = {
  START: "start",
  END: "end",
  IF: "if",
  AGENT: "agent",
} as const;
export type NodeTypeValue = (typeof NodeType)[keyof typeof NodeType];

/**
 * Field keys for the agent node — mirror of `AgentNodeField` in the chat
 * service's `core/constants/workflow.py`, BUT intentionally camelCase.
 * The chat service is currently snake_case (`agent_configuration_id`,
 * `structured_response`); it will be migrated to these camelCase keys so the
 * builder's saved params load and `$nodes.<name>.structuredResponse` resolves
 * at runtime. Keep this comment until that backend change lands.
 */
export const AgentNodeField = {
  /** Persisted node parameters (read by AgentNode on the backend). */
  AGENT_PARAM: {
    AGENT_CONFIGURATION_ID: "agentConfigurationId",
    INPUT: "input",
    OUTPUT: "output",
  },
  /** Fields exposed under `$nodes.<name>.` after the node runs. */
  AGENT_OUTPUT: {
    RESPONSE: "response",
    STRUCTURED_RESPONSE: "structuredResponse",
    MESSAGES: "messages",
  },
} as const;

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
