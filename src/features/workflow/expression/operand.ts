/**
 * Operand codec: text <-> JSON Logic operand.
 *
 * Mirrors the chat service's `expression.py` (`is_variable_path`,
 * `parse_literal`). A variable path becomes `{ "var": path }`; a literal
 * becomes a number/boolean/null/string. `jsonLogicToOperand` returns `null`
 * when a JSON node can't be represented as a single text operand that would
 * round-trip back to the same JSON (the trigger for raw-JSON editing).
 */

export type JsonLogicValue =
  | string
  | number
  | boolean
  | null
  | JsonLogicValue[]
  | { [key: string]: JsonLogicValue };

const VAR_KEY = "var";

/** A path segment: identifier optionally followed by `[n]` accessors. */
const SEGMENT = /^[A-Za-z_]\w*(?:\[\d+\])*$/;

/** True when `value` is a pure variable path (no operators). */
export function isVariablePath(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v.startsWith("$")) {
    const parts = v.slice(1).split(".");
    return parts.length >= 1 && parts.every((p) => SEGMENT.test(p));
  }
  if (v.includes(".")) {
    return v.split(".").every((p) => SEGMENT.test(p));
  }
  return false;
}

/** Parse a literal: number / boolean / null, else the original string. */
export function parseLiteral(text: string): JsonLogicValue {
  const t = text.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null") return null;
  if (t !== "" && !Number.isNaN(Number(t))) return Number(t);
  return text;
}

/** Convert operand text to a JSON Logic operand. */
export function operandToJsonLogic(text: string): JsonLogicValue {
  const t = text.trim();
  if (isVariablePath(t)) return { [VAR_KEY]: t };
  return parseLiteral(text);
}

function isVarNode(node: JsonLogicValue): node is { var: JsonLogicValue } {
  return (
    typeof node === "object" &&
    node !== null &&
    !Array.isArray(node) &&
    Object.keys(node).length === 1 &&
    VAR_KEY in node
  );
}

/** Convert a JSON Logic operand back to text, or `null` if not round-trippable. */
export function jsonLogicToOperand(node: JsonLogicValue): string | null {
  if (isVarNode(node)) {
    const path = node.var;
    if (typeof path !== "string") return null;
    const back = operandToJsonLogic(path);
    return isVarNode(back) && back.var === path ? path : null;
  }
  if (node === true) return "true";
  if (node === false) return "false";
  if (node === null) return "null";
  if (typeof node === "number") return String(node);
  if (typeof node === "string") {
    // The string must not re-parse as a number/boolean/null/var.
    return operandToJsonLogic(node) === node ? node : null;
  }
  return null; // arrays / multi-key objects aren't single operands
}
