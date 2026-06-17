import {
  jsonLogicToOperand,
  operandToJsonLogic,
  type JsonLogicValue,
} from "../expression/operand";
import {
  COMBINE_OPS,
  COMPARE_OPS,
  newId,
  type CombineOp,
  type Comparison,
  type CompareOp,
  type ConditionTree,
  type Group,
} from "./types";

/** Serialise a builder tree to JSON Logic. */
export function treeToJsonLogic(tree: ConditionTree): JsonLogicValue {
  if (tree.kind === "comparison") {
    return {
      [tree.op]: [operandToJsonLogic(tree.left), operandToJsonLogic(tree.right)],
    };
  }
  return { [tree.combinator]: tree.children.map(treeToJsonLogic) };
}

/** Parse JSON Logic into a builder tree, or `null` if not representable. */
export function jsonLogicToTree(jl: JsonLogicValue): ConditionTree | null {
  if (typeof jl !== "object" || jl === null || Array.isArray(jl)) return null;
  const keys = Object.keys(jl);
  if (keys.length !== 1) return null;

  const op = keys[0]!;
  const args = (jl as Record<string, JsonLogicValue>)[op];

  if ((COMBINE_OPS as readonly string[]).includes(op)) {
    if (!Array.isArray(args)) return null;
    const children: ConditionTree[] = [];
    for (const arg of args) {
      const child = jsonLogicToTree(arg);
      if (child === null) return null;
      children.push(child);
    }
    return { kind: "group", id: newId("g"), combinator: op as CombineOp, children };
  }

  if ((COMPARE_OPS as readonly string[]).includes(op)) {
    if (!Array.isArray(args) || args.length !== 2) return null;
    const left = jsonLogicToOperand(args[0]!);
    const right = jsonLogicToOperand(args[1]!);
    if (left === null || right === null) return null;
    return { kind: "comparison", id: newId("c"), op: op as CompareOp, left, right };
  }

  return null;
}

/** An empty group (no children). */
export function emptyGroup(combinator: CombineOp = "and"): Group {
  return { kind: "group", id: newId("g"), combinator, children: [] };
}

/** A blank comparison row. */
export function emptyComparison(): Comparison {
  return { kind: "comparison", id: newId("c"), op: "==", left: "", right: "" };
}

/** Default condition seeded onto a new if node: an empty AND group. */
export function defaultCondition(): JsonLogicValue {
  return treeToJsonLogic(emptyGroup("and"));
}
