import { NODE_NAME_PATTERN, NODE_NAME_RULE_TEXT } from "./constants";

/**
 * Validate a proposed node name. Returns an error message, or `null` if valid.
 *
 * `takenIds` are the ids already used by OTHER nodes (exclude the node being
 * renamed). Mirrors the chat service's `NodeBuilder.build()` name check plus a
 * uniqueness rule (a node's name is its id, which must stay unique).
 */
export function validateNodeName(name: string, takenIds: string[]): string | null {
  if (!NODE_NAME_PATTERN.test(name)) return `Invalid name: ${NODE_NAME_RULE_TEXT}.`;
  if (takenIds.includes(name)) return "A node with this name already exists.";
  return null;
}
