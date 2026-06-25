import type { JsonLogicValue } from "../expression/operand";
import { jsonLogicToTree } from "./jsonLogic";
import type { ConditionTree } from "./types";

function isEmptyObject(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  );
}

/** One-line, human-readable summary of a condition for the node card. */
export function summarizeCondition(condition: unknown): string {
  if (condition == null || isEmptyObject(condition)) return "No condition";
  const tree = jsonLogicToTree(condition as JsonLogicValue);
  if (!tree) return "Custom (JSON)";
  return summarizeTree(tree);
}

function summarizeTree(tree: ConditionTree): string {
  if (tree.kind === "comparison") {
    return `${tree.left || "?"} ${tree.op} ${tree.right || "?"}`;
  }
  if (tree.children.length === 0) return "Always (empty)";
  const sep = ` ${tree.combinator.toUpperCase()} `;
  return tree.children
    .map((c) => (c.kind === "group" ? `(${summarizeTree(c)})` : summarizeTree(c)))
    .join(sep);
}
