import type { Edge } from "@xyflow/react";

/**
 * The ancestor set of `target`: every node with a directed path into it.
 * Used so an expression in a node can only reference nodes that run before it.
 * Walks the reverse adjacency with a visited guard (safe on cycles) and never
 * includes `target` itself.
 */
export function upstreamNodeIds(target: string, edges: Edge[]): Set<string> {
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    const list = incoming.get(edge.target);
    if (list) list.push(edge.source);
    else incoming.set(edge.target, [edge.source]);
  }

  const result = new Set<string>();
  const stack = [...(incoming.get(target) ?? [])];
  while (stack.length) {
    const node = stack.pop()!;
    if (result.has(node)) continue;
    result.add(node);
    for (const source of incoming.get(node) ?? []) stack.push(source);
  }
  result.delete(target); // guard against cycles that loop back to target
  return result;
}
