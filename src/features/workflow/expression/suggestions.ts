import { CONTEXT_SOURCES } from "../constants";
import type { ParameterEntry } from "../schema/parameterSchema";

/** One autocomplete suggestion: `value` replaces the input, `label` is shown. */
export interface Suggestion {
  value: string;
  label: string;
}

const NODES_SOURCE = "$nodes";
const PARAMETERS_SOURCE = "$parameters";
const SEP = ".";

/**
 * Suggestions for the current operand `input`:
 * - empty or a `$` prefix -> matching source names
 * - after `$nodes.` (node-name segment) -> live node names
 * - after `$parameters.` (field segment) -> schema field names + type
 * - anything deeper -> no suggestions (free-form)
 */
export function getSuggestions(
  input: string,
  nodeNames: string[],
  parameters: ParameterEntry[] = [],
): Suggestion[] {
  const text = input.trimStart();
  const nodesPrefix = NODES_SOURCE + SEP;
  const paramsPrefix = PARAMETERS_SOURCE + SEP;

  if (text.startsWith(nodesPrefix)) {
    const rest = text.slice(nodesPrefix.length);
    if (rest.includes(SEP)) return []; // past the node-name segment
    const needle = rest.toLowerCase();
    return nodeNames
      .filter((name) => name.toLowerCase().startsWith(needle))
      .map((name) => ({ value: `${nodesPrefix}${name}${SEP}`, label: name }));
  }

  if (text.startsWith(paramsPrefix)) {
    const rest = text.slice(paramsPrefix.length);
    if (rest.includes(SEP)) return []; // past the field-name segment
    const needle = rest.toLowerCase();
    return parameters
      .filter((p) => p.name.toLowerCase().startsWith(needle))
      .map((p) => ({ value: `${paramsPrefix}${p.name}`, label: `${p.name} — ${p.type}` }));
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
