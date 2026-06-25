/** Comparison operators offered by the builder (subset of JSON Logic). */
export const COMPARE_OPS = ["==", "!=", ">", ">=", "<", "<=", "in"] as const;
export type CompareOp = (typeof COMPARE_OPS)[number];

/** Group combinators. */
export const COMBINE_OPS = ["and", "or"] as const;
export type CombineOp = (typeof COMBINE_OPS)[number];

/** Human labels for the comparison operators (used as `<option>` titles). */
export const COMPARE_OP_LABELS: Record<CompareOp, string> = {
  "==": "equals",
  "!=": "not equals",
  ">": "greater than",
  ">=": "greater or equal",
  "<": "less than",
  "<=": "less or equal",
  in: "in",
};

/** A single comparison row: `left <op> right`, operands as expression text. */
export interface Comparison {
  kind: "comparison";
  id: string;
  left: string;
  op: CompareOp;
  right: string;
}

/** A group of children combined with AND/OR; children may be nested groups. */
export interface Group {
  kind: "group";
  id: string;
  combinator: CombineOp;
  children: ConditionTree[];
}

export type ConditionTree = Group | Comparison;

let counter = 0;
/** Stable-ish unique id for React keys / focus retention while editing. */
export function newId(prefix = "n"): string {
  counter += 1;
  return `${prefix}_${counter}_${Math.random().toString(36).slice(2, 7)}`;
}
