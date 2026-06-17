import { isPlainObject } from "../schema/json";

/** One mappable agent input field, rendered as one expression input. */
export interface AgentInputField {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

/**
 * Flatten an agent `inputSchema` into a list of top-level fields. Every field
 * maps to a workflow expression, so any property type is allowed (no scalar
 * restriction, unlike the parameter-schema form builder).
 */
export function agentInputFields(inputSchema: unknown): AgentInputField[] {
  if (!isPlainObject(inputSchema)) return [];
  const props = inputSchema.properties;
  if (!isPlainObject(props)) return [];
  const required = Array.isArray(inputSchema.required) ? inputSchema.required : [];
  return Object.entries(props).map(([name, prop]) => ({
    name,
    type: isPlainObject(prop) && typeof prop.type === "string" ? prop.type : "",
    description:
      isPlainObject(prop) && typeof prop.description === "string" ? prop.description : "",
    required: required.includes(name),
  }));
}
