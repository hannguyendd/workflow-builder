import type { AgentConfig } from "@/types/agent";
import { AgentNodeField, NodeType } from "../constants";
import { isPlainObject } from "../schema/json";

/** One autocompletable field under `$nodes.<name>.` (may nest via `children`). */
export interface NodeOutputField {
  name: string;
  type: string;
  description?: string;
  children?: NodeOutputField[];
}

/** The outputs a node exposes to downstream expressions. */
export interface NodeOutputs {
  name: string;
  type: string;
  fields: NodeOutputField[];
}

/** Minimal node shape the builder needs (mapped from the store in Inspector). */
export interface NodeDescriptor {
  name: string;
  type: string;
  agentConfigurationId?: string;
}

/** Top-level properties of a JSON-Schema object as leaf output fields. */
function schemaProperties(schema: unknown): NodeOutputField[] {
  if (!isPlainObject(schema)) return [];
  const props = schema.properties;
  if (!isPlainObject(props)) return [];
  return Object.entries(props).map(([name, prop]) => {
    const field: NodeOutputField = {
      name,
      type: isPlainObject(prop) && typeof prop.type === "string" ? prop.type : "",
    };
    if (isPlainObject(prop) && typeof prop.description === "string" && prop.description) {
      field.description = prop.description;
    }
    return field;
  });
}

/** The fields an agent node exposes: response / structuredResponse / messages. */
export function agentOutputFields(agent: AgentConfig | undefined): NodeOutputField[] {
  const out = AgentNodeField.AGENT_OUTPUT;
  const structured: NodeOutputField = {
    name: out.STRUCTURED_RESPONSE,
    type: "object",
    description: "Structured output (shaped by the agent's output schema)",
  };
  const children = agent ? schemaProperties(agent.outputSchema) : [];
  if (children.length) structured.children = children;

  return [
    { name: out.RESPONSE, type: "string", description: "Agent text response" },
    structured,
    { name: out.MESSAGES, type: "array", description: "Full output messages" },
  ];
}

/** Map node descriptors to their downstream-visible outputs. */
export function buildNodeOutputs(
  nodes: NodeDescriptor[],
  agentsById: Record<string, AgentConfig>,
): NodeOutputs[] {
  return nodes.map((node) => {
    if (node.type === NodeType.AGENT) {
      const agent = node.agentConfigurationId ? agentsById[node.agentConfigurationId] : undefined;
      return { name: node.name, type: node.type, fields: agentOutputFields(agent) };
    }
    return { name: node.name, type: node.type, fields: [] };
  });
}
