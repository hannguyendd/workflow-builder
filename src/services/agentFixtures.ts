import type { AgentConfig } from "@/types/agent";

/**
 * Dummy agent configurations for offline development, derived from the chat
 * service's `https/*.http` examples. The Bun proxy (`/api/agents`) serves these
 * while the Taggle backend isn't wired up, so the agent select and input/output
 * mapping work without a running chat service. Swap the proxy back to live
 * forwarding (see git history / the agent-node plan) once the backend is
 * reachable. The ids are UUID-shaped but fake — saved workflows won't run
 * against a real tenant until a real agent is selected.
 */
export const AGENT_FIXTURES: AgentConfig[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Test Nutrition Agent",
    description: "A test agent for nutrition advice",
    status: "Published",
    inputSchema: {
      type: "object",
      properties: {
        messages: { type: "array", items: { type: "string" } },
      },
      required: ["messages"],
    },
    outputSchema: null,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Personalized Health Coach",
    description: "A health coach agent with prompt variables for personalization",
    status: "Published",
    inputSchema: {
      type: "object",
      properties: {
        messages: { type: "array", items: { type: "string" } },
        user_name: { type: "string", description: "The user's name, injected into the prompt" },
        language: { type: "string", description: "Language the agent should reply in" },
      },
      required: ["messages"],
    },
    outputSchema: null,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "ProgrammeRecommendationAgent",
    description:
      "Recommends the most suitable healthcare programme for a user and the role to join with, returning a strict JSON object",
    status: "Published",
    inputSchema: {
      type: "object",
      properties: {
        messages: { type: "array", items: { type: "string" } },
      },
      required: ["messages"],
    },
    outputSchema: {
      type: "object",
      title: "ProgrammeRecommendation",
      description: "Programme recommendation result. programmeId null means no programme is recommended.",
      properties: {
        programmeId: {
          type: ["string", "null"],
          description: "ID of the recommended programme, or null when there is none",
        },
        programmeName: { type: ["string", "null"], description: "Name of the recommended programme" },
        programmeRoleId: {
          type: ["string", "null"],
          description: "ID of the role the user joins with (never an admin role)",
        },
        programmeRole: { type: ["string", "null"], description: "Name of the role the user joins with" },
        reason: { type: "string", description: "Why the user should join the programme (or why none fits)" },
      },
      required: ["programmeId", "programmeName", "programmeRoleId", "programmeRole", "reason"],
    },
  },
];
