/** A Taggle agent configuration, as the builder needs it (camelCase, trimmed). */
export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  /** JSON Schema of the agent's input (drives the input-mapping form). */
  inputSchema: Record<string, unknown> | null;
  /** JSON Schema of the structured output, or null for free-text responses. */
  outputSchema: Record<string, unknown> | null;
  status: string;
}
