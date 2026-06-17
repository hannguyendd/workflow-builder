import type { AgentConfig } from "@/types/agent";

const AGENTS_ENDPOINT = "/api/agents";
const PAGE_SIZE = 200;

/** The raw agent item as returned by the proxied Taggle API (camelCase). */
interface RawAgent {
  id: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown> | null;
  outputSchema?: Record<string, unknown> | null;
  status?: string;
}

interface RawPagingResponse {
  items: RawAgent[];
}

/** Map one raw API agent to the trimmed `AgentConfig` the builder uses. */
export function toAgentConfig(raw: RawAgent): AgentConfig {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? "",
    inputSchema: raw.inputSchema ?? null,
    outputSchema: raw.outputSchema ?? null,
    status: raw.status ?? "",
  };
}

/** GET the (proxied) agent list. Throws on a non-OK response. */
export async function listAgents(): Promise<AgentConfig[]> {
  const res = await fetch(`${AGENTS_ENDPOINT}?page=1&pageSize=${PAGE_SIZE}`);
  if (!res.ok) throw new Error(`List agents failed: ${res.status}`);
  const data = (await res.json()) as RawPagingResponse;
  return data.items.map(toAgentConfig);
}
