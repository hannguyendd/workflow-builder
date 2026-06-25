import { CONTEXT_SOURCES } from "../constants";
import type { ParameterEntry } from "../schema/parameterSchema";
import type { NodeOutputField, NodeOutputs } from "./nodeOutputs";

/** One autocomplete suggestion: `value` replaces the input, `label` is shown. */
export interface Suggestion {
  value: string;
  label: string;
  description?: string;
}

const NODES_SOURCE = "$nodes";
const PARAMETERS_SOURCE = "$parameters";
const SEP = ".";

/** Walk `fields` down the already-chosen `completed` segments to the level to suggest. */
function fieldsAtPath(fields: NodeOutputField[], completed: string[]): NodeOutputField[] {
  let current = fields;
  for (const segment of completed) {
    const match = current.find((f) => f.name === segment);
    if (!match || !match.children) return [];
    current = match.children;
  }
  return current;
}

/** Suggestions for the field path after a known node name. */
function nodeFieldSuggestions(node: NodeOutputs, fieldSegments: string[]): Suggestion[] {
  const completed = fieldSegments.slice(0, -1);
  const partial = (fieldSegments[fieldSegments.length - 1] ?? "").toLowerCase();
  const level = fieldsAtPath(node.fields, completed);
  const prefix = completed.length ? completed.join(SEP) + SEP : "";
  const base = `${NODES_SOURCE}${SEP}${node.name}${SEP}${prefix}`;

  return level
    .filter((f) => f.name.toLowerCase().startsWith(partial))
    .map((f) => {
      const hasChildren = !!(f.children && f.children.length);
      const suggestion: Suggestion = {
        value: `${base}${f.name}${hasChildren ? SEP : ""}`,
        label: `${f.name} — ${f.type}`,
      };
      if (f.description) suggestion.description = f.description;
      return suggestion;
    });
}

/**
 * Suggestions for the current operand `input`:
 * - empty or a `$` prefix -> matching source names
 * - after `$nodes.` (node-name segment) -> available (upstream) node names
 * - after `$nodes.<name>.` -> that node's output fields, drilling into children
 * - after `$parameters.` (field segment) -> schema field names + type
 * - anything else -> no suggestions (free-form)
 */
export function getSuggestions(
  input: string,
  nodes: NodeOutputs[] = [],
  parameters: ParameterEntry[] = [],
): Suggestion[] {
  const text = input.trimStart();
  const nodesPrefix = NODES_SOURCE + SEP;
  const paramsPrefix = PARAMETERS_SOURCE + SEP;

  if (text.startsWith(nodesPrefix)) {
    const rest = text.slice(nodesPrefix.length);
    const segments = rest.split(SEP);
    if (segments.length === 1) {
      const needle = segments[0]!.toLowerCase();
      return nodes
        .filter((n) => n.name.toLowerCase().startsWith(needle))
        .map((n) => ({ value: `${nodesPrefix}${n.name}${SEP}`, label: n.name }));
    }
    const node = nodes.find((n) => n.name === segments[0]);
    if (!node) return [];
    return nodeFieldSuggestions(node, segments.slice(1));
  }

  if (text.startsWith(paramsPrefix)) {
    const rest = text.slice(paramsPrefix.length);
    if (rest.includes(SEP)) return []; // past the field-name segment
    const needle = rest.toLowerCase();
    return parameters
      .filter((p) => p.name.toLowerCase().startsWith(needle))
      .map((p) => {
        const suggestion: Suggestion = {
          value: `${paramsPrefix}${p.name}`,
          label: `${p.name} — ${p.type}`,
        };
        if (p.description) suggestion.description = p.description;
        return suggestion;
      });
  }

  if (text === "" || text.startsWith("$")) {
    const needle = text.toLowerCase();
    return CONTEXT_SOURCES.filter((s) => s.toLowerCase().startsWith(needle)).map((s) => ({
      value: s === NODES_SOURCE ? `${s}${SEP}` : s,
      label: s,
    }));
  }

  return [];
}
