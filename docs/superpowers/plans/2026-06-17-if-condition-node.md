# If / Condition Node Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "If / condition" node that branches the workflow graph into `true`/`false` paths from a JSON Logic condition, edited via a reusable autocomplete expression input in a right inspector panel.

**Architecture:** Pure, unit-tested codec modules (`expression/`, `condition/`) convert between operand text ↔ JSON Logic and a nested AND/OR builder tree ↔ JSON Logic. Presentational React components (`ExpressionInput`, `ConditionBuilder`, `ConditionEditor`, `Inspector`, `IfNode`) consume those modules. The persisted condition lives in Redux at `node.data.parameters.condition`; the builder keeps a transient local tree re-seeded per selected node.

**Tech Stack:** Bun, React 19, `@xyflow/react`, Redux Toolkit, Tailwind v4. Tests via `bun test` (pure logic only — no DOM test infra in this repo).

## Global Constraints

- **Stack is fixed:** xyflow (`@xyflow/react`) for the canvas, Tailwind v4 for styling, Redux Toolkit for state. **Do not add new dependencies** (no UI kit, no autocomplete lib, no CSS-in-JS, no DOM test libs).
- **No magic strings/numbers:** extract literals into named constants (node types, edge labels, source prefixes, the `"condition"` param key).
- **Alias imports:** use `@/*`, `@features/*`, `@store/*`, `@types/*` — not `../../` chains. Within a feature folder, relative imports (`./x`, `../x`) are the existing norm and are fine.
- **Bun tooling:** `bun test`, `bunx tsc --noEmit`, `bun dev`. Never npm/node/jest.
- **Target schema (authoritative, from chat service):** if node serializes `type: "if"`; condition is JSON Logic in `parameters.condition`; two outgoing edges labelled `true`/`false`; `{ "var": "<path>" }` references sources `$state`/`$config`/`$variables`/`$parameters`/`$nodes.<name>.<path>`/`$trigger`.
- **State source of truth:** workflow graph + condition live in Redux. Components select + dispatch; only transient editing buffers (JSON textarea text, builder tree ids) may be local `useState`.
- **Commit convention:** Conventional Commits, imperative, lowercase, no trailing period, e.g. `feat(workflow): add if node`. End commit messages with the `Co-Authored-By` trailer used in this repo.

---

### Task 1: Shared workflow constants

Mirror the chat service's `core/constants/workflow.py` enums the frontend needs, and lock the contract with a test so drift is caught.

**Files:**

- Create: `src/features/workflow/constants.ts`
- Test: `src/features/workflow/constants.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `NodeType` (`const` object): `{ START: "start", END: "end", IF: "if" }`, plus `type NodeTypeValue`.
  - `EdgeLabel`: `{ MAIN: "main" }`.
  - `ConditionEdge`: `{ TRUE: "true", FALSE: "false" }`.
  - `CONTEXT_SOURCES: readonly string[]` = the six `$`-prefixed source names.

- [ ] **Step 1: Write the failing test**

Create `src/features/workflow/constants.test.ts`:

```ts
import { expect, test } from "bun:test";
import {
  CONTEXT_SOURCES,
  ConditionEdge,
  EdgeLabel,
  NodeType,
} from "./constants";

test("node type identifiers match the chat-service schema", () => {
  expect(NodeType.START).toBe("start");
  expect(NodeType.END).toBe("end");
  expect(NodeType.IF).toBe("if");
});

test("edge labels match the chat-service schema", () => {
  expect(EdgeLabel.MAIN).toBe("main");
  expect(ConditionEdge.TRUE).toBe("true");
  expect(ConditionEdge.FALSE).toBe("false");
});

test("context sources cover every variable prefix", () => {
  expect([...CONTEXT_SOURCES]).toEqual([
    "$state",
    "$config",
    "$variables",
    "$parameters",
    "$nodes",
    "$trigger",
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/features/workflow/constants.test.ts`
Expected: FAIL — cannot resolve `./constants`.

- [ ] **Step 3: Write the implementation**

Create `src/features/workflow/constants.ts`:

```ts
/**
 * Frontend mirror of the chat service's `core/constants/workflow.py`.
 * Keep these in sync with that file — `constants.test.ts` guards the contract.
 */

/** Node type identifiers used in workflow definitions (NodeType). */
export const NodeType = {
  START: "start",
  END: "end",
  IF: "if",
} as const;
export type NodeTypeValue = (typeof NodeType)[keyof typeof NodeType];

/** Common edge label shared across node types (EdgeLabel). */
export const EdgeLabel = {
  MAIN: "main",
} as const;

/** Branch labels specific to the condition node (ConditionEdge). */
export const ConditionEdge = {
  TRUE: "true",
  FALSE: "false",
} as const;

/** Variable source prefixes used in path resolution (ContextSource). */
export const CONTEXT_SOURCES = [
  "$state",
  "$config",
  "$variables",
  "$parameters",
  "$nodes",
  "$trigger",
] as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/features/workflow/constants.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/workflow/constants.ts src/features/workflow/constants.test.ts
git commit -m "feat(workflow): add shared node/edge/source constants

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Operand codec (text ↔ JSON Logic operand)

The bridge between an `ExpressionInput`'s text and a JSON Logic operand. Mirrors `expression.py`'s `is_variable_path` + `parse_literal`: a `$…`/`a.b.c` path becomes `{ "var": path }`; `42`/`true`/`false`/`null` become literals; everything else is a string literal. Reverse conversion returns `null` when a node can't round-trip faithfully (the signal to fall back to raw JSON).

**Files:**

- Create: `src/features/workflow/expression/operand.ts`
- Test: `src/features/workflow/expression/operand.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `type JsonLogicValue = string | number | boolean | null | JsonLogicValue[] | { [k: string]: JsonLogicValue }`
  - `isVariablePath(value: string): boolean`
  - `parseLiteral(text: string): JsonLogicValue`
  - `operandToJsonLogic(text: string): JsonLogicValue`
  - `jsonLogicToOperand(node: JsonLogicValue): string | null`

- [ ] **Step 1: Write the failing test**

Create `src/features/workflow/expression/operand.test.ts`:

```ts
import { expect, test } from "bun:test";
import {
  isVariablePath,
  jsonLogicToOperand,
  operandToJsonLogic,
  parseLiteral,
} from "./operand";

test("isVariablePath recognises $-sources and dotted paths", () => {
  expect(isVariablePath("$state.age")).toBe(true);
  expect(isVariablePath("$nodes.kyc.status")).toBe(true);
  expect(isVariablePath("a.b.c")).toBe(true);
  expect(isVariablePath("entry[0].value")).toBe(true);
  expect(isVariablePath("age")).toBe(false); // bare word -> literal
  expect(isVariablePath("18")).toBe(false);
  expect(isVariablePath("")).toBe(false);
});

test("parseLiteral coerces numbers, booleans, null; keeps strings", () => {
  expect(parseLiteral("18")).toBe(18);
  expect(parseLiteral("true")).toBe(true);
  expect(parseLiteral("false")).toBe(false);
  expect(parseLiteral("null")).toBe(null);
  expect(parseLiteral("active")).toBe("active");
  expect(parseLiteral("")).toBe("");
});

test("operandToJsonLogic emits var for paths, literals otherwise", () => {
  expect(operandToJsonLogic("$state.age")).toEqual({ var: "$state.age" });
  expect(operandToJsonLogic("18")).toBe(18);
  expect(operandToJsonLogic("active")).toBe("active");
});

test("jsonLogicToOperand round-trips representable operands", () => {
  expect(jsonLogicToOperand({ var: "$state.age" })).toBe("$state.age");
  expect(jsonLogicToOperand(18)).toBe("18");
  expect(jsonLogicToOperand(true)).toBe("true");
  expect(jsonLogicToOperand(null)).toBe("null");
  expect(jsonLogicToOperand("active")).toBe("active");
});

test("jsonLogicToOperand returns null when a node can't round-trip", () => {
  expect(jsonLogicToOperand("18")).toBe(null); // string "18" would re-parse as number
  expect(jsonLogicToOperand({ var: 5 } as never)).toBe(null);
  expect(jsonLogicToOperand([1, 2] as never)).toBe(null);
  expect(jsonLogicToOperand({ ">": [1, 2] } as never)).toBe(null); // not a var node
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/features/workflow/expression/operand.test.ts`
Expected: FAIL — cannot resolve `./operand`.

- [ ] **Step 3: Write the implementation**

Create `src/features/workflow/expression/operand.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/features/workflow/expression/operand.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/workflow/expression/operand.ts src/features/workflow/expression/operand.test.ts
git commit -m "feat(workflow): add operand text<->json-logic codec

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Expression autocomplete suggestions

Pure suggestion engine for `ExpressionInput`: suggest the six `$`-sources while typing a prefix, and live node names after `$nodes.`.

**Files:**

- Create: `src/features/workflow/expression/suggestions.ts`
- Test: `src/features/workflow/expression/suggestions.test.ts`

**Interfaces:**

- Consumes: `CONTEXT_SOURCES` from `../constants` (Task 1).
- Produces:
  - `interface Suggestion { value: string; label: string }`
  - `getSuggestions(input: string, nodeNames: string[]): Suggestion[]`

- [ ] **Step 1: Write the failing test**

Create `src/features/workflow/expression/suggestions.test.ts`:

```ts
import { expect, test } from "bun:test";
import { getSuggestions } from "./suggestions";

test("empty input suggests all six sources", () => {
  expect(getSuggestions("", []).map((s) => s.label)).toEqual([
    "$state",
    "$config",
    "$variables",
    "$parameters",
    "$nodes",
    "$trigger",
  ]);
});

test("typing a prefix filters sources", () => {
  expect(getSuggestions("$st", []).map((s) => s.value)).toEqual(["$state"]);
});

test("$nodes suggestion carries a trailing dot to invite the node step", () => {
  expect(getSuggestions("$no", [])).toEqual([
    { value: "$nodes.", label: "$nodes" },
  ]);
});

test("after $nodes. it suggests live node names", () => {
  const out = getSuggestions("$nodes.", ["kyc_check", "fetch_patient"]);
  expect(out).toEqual([
    { value: "$nodes.kyc_check.", label: "kyc_check" },
    { value: "$nodes.fetch_patient.", label: "fetch_patient" },
  ]);
});

test("node names filter by the typed segment, case-insensitively", () => {
  expect(
    getSuggestions("$nodes.KY", ["kyc_check", "fetch_patient"]).map(
      (s) => s.label,
    ),
  ).toEqual(["kyc_check"]);
});

test("no suggestions once a path goes deeper than the node name", () => {
  expect(getSuggestions("$nodes.kyc_check.status", ["kyc_check"])).toEqual([]);
});

test("non-$ input yields no suggestions", () => {
  expect(getSuggestions("age", [])).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/features/workflow/expression/suggestions.test.ts`
Expected: FAIL — cannot resolve `./suggestions`.

- [ ] **Step 3: Write the implementation**

Create `src/features/workflow/expression/suggestions.ts`:

```ts
import { CONTEXT_SOURCES } from "../constants";

/** One autocomplete suggestion: `value` replaces the input, `label` is shown. */
export interface Suggestion {
  value: string;
  label: string;
}

const NODES_SOURCE = "$nodes";
const SEP = ".";

/**
 * Suggestions for the current operand `input`:
 * - empty or a `$` prefix -> matching source names
 * - after `$nodes.` (node-name segment) -> live node names
 * - anything deeper -> no suggestions (free-form)
 */
export function getSuggestions(
  input: string,
  nodeNames: string[],
): Suggestion[] {
  const text = input.trimStart();
  const nodesPrefix = NODES_SOURCE + SEP;

  if (text.startsWith(nodesPrefix)) {
    const rest = text.slice(nodesPrefix.length);
    if (rest.includes(SEP)) return []; // past the node-name segment
    const needle = rest.toLowerCase();
    return nodeNames
      .filter((name) => name.toLowerCase().startsWith(needle))
      .map((name) => ({ value: `${nodesPrefix}${name}${SEP}`, label: name }));
  }

  if (text === "" || text.startsWith("$")) {
    const needle = text.toLowerCase();
    return CONTEXT_SOURCES.filter((s) =>
      s.toLowerCase().startsWith(needle),
    ).map((s) => ({
      value: s === NODES_SOURCE ? `${s}${SEP}` : s,
      label: s,
    }));
  }

  return [];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/features/workflow/expression/suggestions.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/workflow/expression/suggestions.ts src/features/workflow/expression/suggestions.test.ts
git commit -m "feat(workflow): add expression autocomplete suggestions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Condition tree model, JSON Logic codec, and summary

The core: a nested AND/OR builder tree, its conversion to/from JSON Logic (`null` when unrepresentable), factory helpers, and a one-line summary for the node card.

**Files:**

- Create: `src/features/workflow/condition/types.ts`
- Create: `src/features/workflow/condition/jsonLogic.ts`
- Create: `src/features/workflow/condition/summarize.ts`
- Test: `src/features/workflow/condition/jsonLogic.test.ts`
- Test: `src/features/workflow/condition/summarize.test.ts`

**Interfaces:**

- Consumes: `operandToJsonLogic`, `jsonLogicToOperand`, `JsonLogicValue` from `../expression/operand` (Task 2).
- Produces:
  - `types.ts`: `COMPARE_OPS`, `type CompareOp`, `COMBINE_OPS`, `type CombineOp`, `COMPARE_OP_LABELS`, `interface Comparison`, `interface Group`, `type ConditionTree`, `newId(prefix?: string): string`.
  - `jsonLogic.ts`: `treeToJsonLogic(tree: ConditionTree): JsonLogicValue`, `jsonLogicToTree(jl: JsonLogicValue): ConditionTree | null`, `emptyGroup(combinator?: CombineOp): Group`, `emptyComparison(): Comparison`, `defaultCondition(): JsonLogicValue`.
  - `summarize.ts`: `summarizeCondition(condition: unknown): string`.

- [ ] **Step 1: Write the failing tests**

Create `src/features/workflow/condition/jsonLogic.test.ts`:

```ts
import { expect, test } from "bun:test";
import {
  defaultCondition,
  emptyComparison,
  emptyGroup,
  jsonLogicToTree,
  treeToJsonLogic,
} from "./jsonLogic";
import type { Group } from "./types";

test("treeToJsonLogic serialises a flat AND of comparisons", () => {
  const tree: Group = {
    kind: "group",
    id: "g",
    combinator: "and",
    children: [
      {
        kind: "comparison",
        id: "c1",
        left: "$state.age",
        op: ">",
        right: "18",
      },
      {
        kind: "comparison",
        id: "c2",
        left: "$state.country",
        op: "==",
        right: "US",
      },
    ],
  };
  expect(treeToJsonLogic(tree)).toEqual({
    and: [
      { ">": [{ var: "$state.age" }, 18] },
      { "==": [{ var: "$state.country" }, "US"] },
    ],
  });
});

test("treeToJsonLogic serialises nested groups", () => {
  const tree: Group = {
    kind: "group",
    id: "g",
    combinator: "and",
    children: [
      {
        kind: "comparison",
        id: "c1",
        left: "$state.age",
        op: ">",
        right: "18",
      },
      {
        kind: "group",
        id: "g2",
        combinator: "or",
        children: [
          {
            kind: "comparison",
            id: "c2",
            left: "$state.country",
            op: "==",
            right: "US",
          },
          {
            kind: "comparison",
            id: "c3",
            left: "$state.country",
            op: "==",
            right: "CA",
          },
        ],
      },
    ],
  };
  expect(treeToJsonLogic(tree)).toEqual({
    and: [
      { ">": [{ var: "$state.age" }, 18] },
      {
        or: [
          { "==": [{ var: "$state.country" }, "US"] },
          { "==": [{ var: "$state.country" }, "CA"] },
        ],
      },
    ],
  });
});

test("jsonLogicToTree round-trips through treeToJsonLogic", () => {
  const jl = {
    and: [
      { ">": [{ var: "$state.age" }, 18] },
      {
        or: [
          { "==": [{ var: "$nodes.kyc.status" }, "ok"] },
          { "<=": [{ var: "$state.score" }, 0.5] },
        ],
      },
    ],
  };
  const tree = jsonLogicToTree(jl);
  expect(tree).not.toBeNull();
  expect(treeToJsonLogic(tree!)).toEqual(jl);
});

test("jsonLogicToTree returns null for unsupported shapes", () => {
  expect(jsonLogicToTree({ "!": [{ var: "x" }] })).toBeNull(); // unsupported op
  expect(jsonLogicToTree({ ">": [{ var: "x" }, 1, 2] })).toBeNull(); // arity != 2
  expect(jsonLogicToTree({ and: [{ "==": [{ var: "x" }, "18"] }] })).toBeNull(); // "18" string can't round-trip
  expect(jsonLogicToTree({})).toBeNull();
  expect(jsonLogicToTree("x")).toBeNull();
  expect(jsonLogicToTree({ a: 1, b: 2 })).toBeNull(); // multi-key
});

test("factories produce representable defaults", () => {
  expect(treeToJsonLogic(emptyGroup("or"))).toEqual({ or: [] });
  expect(defaultCondition()).toEqual({ and: [] });
  const cmp = emptyComparison();
  expect(cmp).toMatchObject({
    kind: "comparison",
    op: "==",
    left: "",
    right: "",
  });
});
```

Create `src/features/workflow/condition/summarize.test.ts`:

```ts
import { expect, test } from "bun:test";
import { summarizeCondition } from "./summarize";

test("summarises an empty / missing condition", () => {
  expect(summarizeCondition({})).toBe("No condition");
  expect(summarizeCondition(null)).toBe("No condition");
  expect(summarizeCondition({ and: [] })).toBe("Always (empty)");
});

test("summarises a flat AND of comparisons", () => {
  const jl = {
    and: [
      { ">": [{ var: "$state.age" }, 18] },
      { "==": [{ var: "$state.country" }, "US"] },
    ],
  };
  expect(summarizeCondition(jl)).toBe(
    "$state.age > 18 AND $state.country == US",
  );
});

test("wraps nested groups in parentheses", () => {
  const jl = {
    and: [
      { ">": [{ var: "$state.age" }, 18] },
      {
        or: [
          { "==": [{ var: "$state.c" }, "US"] },
          { "==": [{ var: "$state.c" }, "CA"] },
        ],
      },
    ],
  };
  expect(summarizeCondition(jl)).toBe(
    "$state.age > 18 AND ($state.c == US OR $state.c == CA)",
  );
});

test("falls back to a generic label for non-builder JSON", () => {
  expect(summarizeCondition({ "!": [{ var: "x" }] })).toBe("Custom (JSON)");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/features/workflow/condition/`
Expected: FAIL — cannot resolve `./jsonLogic` / `./summarize`.

- [ ] **Step 3: Write `types.ts`**

Create `src/features/workflow/condition/types.ts`:

```ts
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
```

- [ ] **Step 4: Write `jsonLogic.ts`**

Create `src/features/workflow/condition/jsonLogic.ts`:

```ts
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
      [tree.op]: [
        operandToJsonLogic(tree.left),
        operandToJsonLogic(tree.right),
      ],
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
    return {
      kind: "group",
      id: newId("g"),
      combinator: op as CombineOp,
      children,
    };
  }

  if ((COMPARE_OPS as readonly string[]).includes(op)) {
    if (!Array.isArray(args) || args.length !== 2) return null;
    const left = jsonLogicToOperand(args[0]!);
    const right = jsonLogicToOperand(args[1]!);
    if (left === null || right === null) return null;
    return {
      kind: "comparison",
      id: newId("c"),
      op: op as CompareOp,
      left,
      right,
    };
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
```

- [ ] **Step 5: Write `summarize.ts`**

Create `src/features/workflow/condition/summarize.ts`:

```ts
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
    .map((c) =>
      c.kind === "group" ? `(${summarizeTree(c)})` : summarizeTree(c),
    )
    .join(sep);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun test src/features/workflow/condition/`
Expected: PASS (jsonLogic: 5 tests, summarize: 4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/features/workflow/condition/types.ts src/features/workflow/condition/jsonLogic.ts src/features/workflow/condition/summarize.ts src/features/workflow/condition/jsonLogic.test.ts src/features/workflow/condition/summarize.test.ts
git commit -m "feat(workflow): add condition tree model and json-logic codec

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Slice support for the if node

Refactor the slice to use the constants, seed the if node's condition, derive edge labels from the source handle, and add `updateNodeData` for the inspector.

**Files:**

- Modify: `src/features/workflow/workflowSlice.ts`
- Test: `src/features/workflow/workflowSlice.test.ts` (append tests; file already exists)

**Interfaces:**

- Consumes: `NodeType`, `EdgeLabel` from `./constants` (Task 1); `defaultCondition` from `./condition/jsonLogic` (Task 4).
- Produces: existing actions plus `updateNodeData({ id: string; data: Partial<WorkflowNodeData> })`. `addNode({ type: "if" })` seeds `parameters.condition = defaultCondition()`. `connected` sets `label = sourceHandle ?? EdgeLabel.MAIN` and edge id `\`${source}->${target}:${label}\``.

- [ ] **Step 1: Write the failing tests**

First inspect the current test file to match its style:

Run: `bun test src/features/workflow/workflowSlice.test.ts`
Expected: PASS (existing tests) — confirms the baseline before changes.

Append to `src/features/workflow/workflowSlice.test.ts` (add imports for `updateNodeData` to the existing import from `./workflowSlice`, and import `defaultCondition`):

```ts
import { defaultCondition } from "./condition/jsonLogic";
import type { WorkflowNodeData } from "@/types/workflow";

test("addNode('if') seeds a default condition", () => {
  const state = reducer(undefined, addNode({ type: "if" }));
  const ifNode = state.nodes.find((n) => n.type === "if");
  expect(ifNode).toBeDefined();
  expect((ifNode!.data as WorkflowNodeData).parameters).toEqual({
    condition: defaultCondition(),
  });
});

test("connected derives the edge label from the source handle", () => {
  const base = reducer(undefined, addNode({ type: "if" }));
  const next = reducer(
    base,
    connected({
      source: "if",
      target: "end",
      sourceHandle: "true",
      targetHandle: null,
    }),
  );
  const edge = next.edges.find((e) => e.source === "if" && e.target === "end");
  expect(edge?.label).toBe("true");
  expect(edge?.id).toBe("if->end:true");
});

test("connected falls back to 'main' when there is no source handle", () => {
  const base = reducer(undefined, addNode({ type: "if" }));
  const next = reducer(
    base,
    connected({
      source: "start",
      target: "end",
      sourceHandle: null,
      targetHandle: null,
    }),
  );
  expect(next.edges.find((e) => e.source === "start")?.label).toBe("main");
});

test("updateNodeData merges into the node's data", () => {
  const base = reducer(undefined, addNode({ type: "if" }));
  const next = reducer(
    base,
    updateNodeData({ id: "if", data: { description: "branch on age" } }),
  );
  const node = next.nodes.find((n) => n.id === "if");
  expect((node!.data as WorkflowNodeData).description).toBe("branch on age");
});
```

> Note: this assumes the existing test file imports `reducer` (default), `addNode`, and `connected`. If the existing imports differ, extend them — do not duplicate the import line. Add `updateNodeData` to the named imports from `./workflowSlice`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/features/workflow/workflowSlice.test.ts`
Expected: FAIL — `updateNodeData` is not exported; `addNode('if')` parameters are `{}`, not seeded; edge label/id assertions fail.

- [ ] **Step 3: Update the slice**

In `src/features/workflow/workflowSlice.ts`:

Replace the imports block and `nodeData` helper. Add at the top with the other imports:

```ts
import { NodeType, EdgeLabel } from "./constants";
import { defaultCondition } from "./condition/jsonLogic";
```

Replace the `nodeData` function with:

```ts
function nodeData(type: string): WorkflowNodeData {
  if (type === NodeType.START)
    return { description: "Workflow entry point", parameters: {} };
  if (type === NodeType.END)
    return { description: "Workflow end", parameters: {} };
  if (type === NodeType.IF)
    return { description: "", parameters: { condition: defaultCondition() } };
  return { description: "", parameters: {} };
}
```

Replace the `connected` reducer body with:

```ts
connected(state, action: PayloadAction<Connection>) {
  const c = action.payload;
  const label = c.sourceHandle ?? EdgeLabel.MAIN;
  const edge: Edge = {
    id: `${c.source}->${c.target}:${label}`,
    source: c.source,
    target: c.target,
    sourceHandle: c.sourceHandle ?? null,
    targetHandle: c.targetHandle ?? null,
    label,
    data: { label },
  };
  state.edges = addEdge(edge, state.edges);
},
```

Add a new reducer after `addNode` (and before `setWorkflow`):

```ts
updateNodeData(state, action: PayloadAction<{ id: string; data: Partial<WorkflowNodeData> }>) {
  const { id, data } = action.payload;
  const node = state.nodes.find((n) => n.id === id);
  if (node) node.data = { ...(node.data as WorkflowNodeData), ...data };
},
```

Add `updateNodeData` to the exported actions:

```ts
export const {
  nodesChanged,
  edgesChanged,
  connected,
  addNode,
  updateNodeData,
  setWorkflow,
} = slice.actions;
```

Finally, update the seeded `initialState` nodes to use the constants instead of inline strings:

```ts
nodes: [
  { id: NodeType.START, type: NodeType.START, position: { x: 300, y: 0 }, data: nodeData(NodeType.START) },
  { id: NodeType.END, type: NodeType.END, position: { x: 300, y: 300 }, data: nodeData(NodeType.END) },
],
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/features/workflow/workflowSlice.test.ts`
Expected: PASS (existing + 4 new tests).

- [ ] **Step 5: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/workflow/workflowSlice.ts src/features/workflow/workflowSlice.test.ts
git commit -m "feat(workflow): seed if-node condition and handle-based edge labels

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Serializer round-trip for the if node

The serializer needs no code change — this task locks the contract with tests proving an if node + `true`/`false` edges round-trip to the chat-service DTO shape.

**Files:**

- Test: `src/features/workflow/serialize.test.ts` (append)

**Interfaces:**

- Consumes: `toWorkflowDto`, `fromWorkflowDto` from `./serialize`; `defaultCondition` from `./condition/jsonLogic`.
- Produces: nothing (tests only).

- [ ] **Step 1: Write the failing/locking test**

Append to `src/features/workflow/serialize.test.ts` (extend existing imports; add `defaultCondition` import):

```ts
import { defaultCondition } from "./condition/jsonLogic";
import type { SerializableWorkflow } from "@/types/workflow";

test("toWorkflowDto emits an if node with condition and true/false edges", () => {
  const condition = { ">": [{ var: "$state.age" }, 18] };
  const wf: SerializableWorkflow = {
    meta: { name: "wf", description: "", parameterSchema: {} },
    nodes: [
      {
        id: "if",
        type: "if",
        position: { x: 0, y: 0 },
        data: { description: "", parameters: { condition } },
      },
      {
        id: "yes",
        type: "end",
        position: { x: 0, y: 100 },
        data: { description: "", parameters: {} },
      },
      {
        id: "no",
        type: "end",
        position: { x: 100, y: 100 },
        data: { description: "", parameters: {} },
      },
    ],
    edges: [
      {
        id: "if->yes:true",
        source: "if",
        target: "yes",
        label: "true",
        data: { label: "true" },
      },
      {
        id: "if->no:false",
        source: "if",
        target: "no",
        label: "false",
        data: { label: "false" },
      },
    ],
  };

  const dto = toWorkflowDto(wf);
  const ifDto = dto.nodes.find((n) => n.name === "if");
  expect(ifDto?.type).toBe("if");
  expect(ifDto?.parameters).toEqual({ condition });
  expect(dto.edges["if"]).toEqual([
    { to: "yes", label: "true" },
    { to: "no", label: "false" },
  ]);
});

test("fromWorkflowDto restores an if node condition and labelled edges", () => {
  const condition = defaultCondition();
  const restored = fromWorkflowDto({
    name: "wf",
    description: "",
    parameterSchema: {},
    nodes: [
      {
        name: "if",
        type: "if",
        description: "",
        parameters: { condition },
        position: { x: 0, y: 0 },
      },
    ],
    edges: {
      if: [
        { to: "yes", label: "true" },
        { to: "no", label: "false" },
      ],
    },
  });
  const node = restored.nodes.find((n) => n.id === "if");
  expect(
    (node!.data as { parameters: Record<string, unknown> }).parameters
      .condition,
  ).toEqual(condition);
  expect(restored.edges.map((e) => e.label)).toEqual(["true", "false"]);
});
```

> Note: extend the existing import from `./serialize` rather than adding a duplicate import line.

- [ ] **Step 2: Run tests**

Run: `bun test src/features/workflow/serialize.test.ts`
Expected: PASS (existing + 2 new). If a new test fails, fix the test to match the real serializer output — `serialize.ts` is not expected to change.

- [ ] **Step 3: Commit**

```bash
git add src/features/workflow/serialize.test.ts
git commit -m "test(workflow): cover if-node serialization round-trip

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `ExpressionInput` component

A controlled text input with a hand-rolled suggestion dropdown driven by `getSuggestions`. Presentational — no store access. (No DOM test infra; verified by typecheck + the integration smoke in Task 11.)

**Files:**

- Create: `src/features/workflow/components/ExpressionInput.tsx`

**Interfaces:**

- Consumes: `getSuggestions` from `../expression/suggestions` (Task 3).
- Produces: `ExpressionInput({ value, onChange, nodeNames, placeholder?, className? })`.

- [ ] **Step 1: Write the component**

Create `src/features/workflow/components/ExpressionInput.tsx`:

```tsx
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { getSuggestions } from "../expression/suggestions";

interface ExpressionInputProps {
  value: string;
  onChange: (value: string) => void;
  nodeNames: string[];
  placeholder?: string;
  className?: string;
}

const BLUR_CLOSE_MS = 120;

export function ExpressionInput({
  value,
  onChange,
  nodeNames,
  placeholder,
  className,
}: ExpressionInputProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const suggestions = useMemo(
    () => getSuggestions(value, nodeNames),
    [value, nodeNames],
  );
  const visible = open && suggestions.length > 0;

  function accept(index: number) {
    const s = suggestions[index];
    if (!s) return;
    onChange(s.value);
    setActive(0);
    setOpen(true); // keep open so the next segment can be suggested
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!visible) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      accept(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), BLUR_CLOSE_MS)}
        onKeyDown={onKeyDown}
        className={`w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 ${className ?? ""}`}
      />
      {visible && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.value}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus; fire before blur
                accept(i);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-2 py-1 text-sm ${
                i === active
                  ? "bg-primary/10 text-primary"
                  : "text-slate-700 dark:text-slate-200"
              }`}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/workflow/components/ExpressionInput.tsx
git commit -m "feat(workflow): add autocomplete expression input component

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: `ConditionBuilder` and `ConditionEditor`

The recursive visual builder and the wrapper that adds the Builder/JSON toggle.

**Files:**

- Create: `src/features/workflow/condition/ConditionBuilder.tsx`
- Create: `src/features/workflow/condition/ConditionEditor.tsx`

**Interfaces:**

- Consumes: `ExpressionInput` (Task 7); `types.ts` exports and `jsonLogic.ts` exports (Task 4); `JsonLogicValue` (Task 2).
- Produces:
  - `ConditionBuilder({ group, nodeNames, onChange, onRemove?, depth? })`
  - `ConditionEditor({ condition, nodeNames, onChange })`

- [ ] **Step 1: Write `ConditionBuilder.tsx`**

Create `src/features/workflow/condition/ConditionBuilder.tsx`:

```tsx
import { ExpressionInput } from "../components/ExpressionInput";
import { emptyComparison, emptyGroup } from "./jsonLogic";
import {
  COMBINE_OPS,
  COMPARE_OPS,
  COMPARE_OP_LABELS,
  type CombineOp,
  type Comparison,
  type CompareOp,
  type ConditionTree,
  type Group,
} from "./types";

interface BuilderProps {
  group: Group;
  nodeNames: string[];
  onChange: (group: Group) => void;
  onRemove?: () => void;
  depth?: number;
}

export function ConditionBuilder({
  group,
  nodeNames,
  onChange,
  onRemove,
  depth = 0,
}: BuilderProps) {
  function updateChild(index: number, child: ConditionTree) {
    const children = group.children.slice();
    children[index] = child;
    onChange({ ...group, children });
  }
  function removeChild(index: number) {
    const children = group.children.slice();
    children.splice(index, 1);
    onChange({ ...group, children });
  }

  return (
    <div
      className={`rounded-lg border border-slate-200 p-2 dark:border-slate-700 ${
        depth > 0 ? "bg-slate-50 dark:bg-slate-900/40" : ""
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Match
        </span>
        <div className="flex overflow-hidden rounded-md border border-slate-300 dark:border-slate-600">
          {COMBINE_OPS.map((op) => (
            <button
              key={op}
              type="button"
              onClick={() =>
                onChange({ ...group, combinator: op as CombineOp })
              }
              className={`px-2 py-0.5 text-xs font-semibold uppercase ${
                group.combinator === op
                  ? "bg-primary text-white"
                  : "bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {op}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove group"
            className="text-xs text-slate-400 hover:text-rose-500"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {group.children.map((child, i) =>
          child.kind === "group" ? (
            <ConditionBuilder
              key={child.id}
              group={child}
              nodeNames={nodeNames}
              depth={depth + 1}
              onChange={(g) => updateChild(i, g)}
              onRemove={() => removeChild(i)}
            />
          ) : (
            <ComparisonRow
              key={child.id}
              comparison={child}
              nodeNames={nodeNames}
              onChange={(c) => updateChild(i, c)}
              onRemove={() => removeChild(i)}
            />
          ),
        )}
        {group.children.length === 0 && (
          <p className="px-1 text-xs italic text-slate-400">
            No conditions yet.
          </p>
        )}
      </div>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() =>
            onChange({
              ...group,
              children: [...group.children, emptyComparison()],
            })
          }
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          + Condition
        </button>
        <button
          type="button"
          onClick={() =>
            onChange({ ...group, children: [...group.children, emptyGroup()] })
          }
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          + Group
        </button>
      </div>
    </div>
  );
}

interface RowProps {
  comparison: Comparison;
  nodeNames: string[];
  onChange: (c: Comparison) => void;
  onRemove: () => void;
}

function ComparisonRow({
  comparison,
  nodeNames,
  onChange,
  onRemove,
}: RowProps) {
  return (
    <div className="flex items-start gap-1">
      <div className="flex-1">
        <ExpressionInput
          value={comparison.left}
          nodeNames={nodeNames}
          placeholder="$state.age"
          onChange={(left) => onChange({ ...comparison, left })}
        />
      </div>
      <select
        value={comparison.op}
        onChange={(e) =>
          onChange({ ...comparison, op: e.target.value as CompareOp })
        }
        className="rounded-md border border-slate-300 bg-white px-1 py-1 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        {COMPARE_OPS.map((op) => (
          <option key={op} value={op} title={COMPARE_OP_LABELS[op]}>
            {op}
          </option>
        ))}
      </select>
      <div className="flex-1">
        <ExpressionInput
          value={comparison.right}
          nodeNames={nodeNames}
          placeholder="18"
          onChange={(right) => onChange({ ...comparison, right })}
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove condition"
        className="px-1 py-1 text-xs text-slate-400 hover:text-rose-500"
      >
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Write `ConditionEditor.tsx`**

Create `src/features/workflow/condition/ConditionEditor.tsx`:

```tsx
import { useMemo, useState } from "react";
import type { JsonLogicValue } from "../expression/operand";
import { ConditionBuilder } from "./ConditionBuilder";
import { emptyGroup, jsonLogicToTree, treeToJsonLogic } from "./jsonLogic";
import type { Group } from "./types";

interface ConditionEditorProps {
  condition: JsonLogicValue;
  nodeNames: string[];
  onChange: (condition: JsonLogicValue) => void;
}

type Mode = "builder" | "json";

function isEmpty(condition: JsonLogicValue): boolean {
  return (
    condition == null ||
    (typeof condition === "object" &&
      !Array.isArray(condition) &&
      Object.keys(condition).length === 0)
  );
}

function safeParse(text: string): JsonLogicValue {
  try {
    return JSON.parse(text) as JsonLogicValue;
  } catch {
    return null;
  }
}

const UNSUPPORTED_MSG =
  "This JSON can't be edited in the builder. Wrap conditions in an and/or group of comparisons, or keep editing as JSON.";

export function ConditionEditor({
  condition,
  nodeNames,
  onChange,
}: ConditionEditorProps) {
  // Parse once for initial state; the component is remounted via key={nodeId}
  // when the selected node changes (see Inspector).
  const initialTree = useMemo<Group | null>(() => {
    if (isEmpty(condition)) return emptyGroup("and");
    const tree = jsonLogicToTree(condition);
    return tree && tree.kind === "group" ? tree : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [mode, setMode] = useState<Mode>(initialTree ? "builder" : "json");
  const [tree, setTree] = useState<Group>(initialTree ?? emptyGroup("and"));
  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(condition ?? {}, null, 2),
  );
  const [jsonError, setJsonError] = useState("");

  function updateTree(next: Group) {
    setTree(next);
    onChange(treeToJsonLogic(next));
  }

  function updateJson(text: string) {
    setJsonText(text);
    const parsed = safeParse(text);
    if (text.trim() !== "" && parsed === null && text.trim() !== "null") {
      setJsonError("Invalid JSON");
      return;
    }
    setJsonError("");
    onChange(parsed);
  }

  function switchToJson() {
    setJsonText(JSON.stringify(treeToJsonLogic(tree), null, 2));
    setJsonError("");
    setMode("json");
  }

  function switchToBuilder() {
    const parsed = jsonLogicToTree(safeParse(jsonText));
    if (parsed && parsed.kind === "group") {
      setTree(parsed);
      setJsonError("");
      setMode("builder");
    } else {
      setJsonError(UNSUPPORTED_MSG);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Condition
        </span>
        <span className="flex-1" />
        <div className="flex overflow-hidden rounded-md border border-slate-300 dark:border-slate-600">
          <button
            type="button"
            onClick={switchToBuilder}
            className={`px-2 py-0.5 text-xs ${
              mode === "builder"
                ? "bg-primary text-white"
                : "bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            Builder
          </button>
          <button
            type="button"
            onClick={switchToJson}
            className={`px-2 py-0.5 text-xs ${
              mode === "json"
                ? "bg-primary text-white"
                : "bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            JSON
          </button>
        </div>
      </div>

      {mode === "builder" ? (
        <ConditionBuilder
          group={tree}
          nodeNames={nodeNames}
          onChange={updateTree}
        />
      ) : (
        <div className="flex flex-col gap-1">
          <textarea
            value={jsonText}
            onChange={(e) => updateJson(e.target.value)}
            spellCheck={false}
            rows={8}
            className="w-full rounded-md border border-slate-300 bg-white p-2 font-mono text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      )}
      {jsonError && <p className="text-xs text-rose-500">{jsonError}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/workflow/condition/ConditionBuilder.tsx src/features/workflow/condition/ConditionEditor.tsx
git commit -m "feat(workflow): add nested condition builder with json fallback

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: `IfNode` component, registration, and palette

The canvas node with one target handle and two labelled source handles, plus its registration and palette entry.

**Files:**

- Create: `src/features/workflow/nodes/IfNode.tsx`
- Modify: `src/features/workflow/nodes/nodeTypes.ts`
- Modify: `src/features/workflow/nodes/dragData.ts`

**Interfaces:**

- Consumes: `ConditionEdge`, `NodeType` from `../constants`; `summarizeCondition` from `../condition/summarize`; `WorkflowNodeData` type.
- Produces: `IfNode` registered under key `if`; palette item `{ type: "if", label: "If / Condition" }`.

- [ ] **Step 1: Write `IfNode.tsx`**

Create `src/features/workflow/nodes/IfNode.tsx`:

```tsx
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ConditionEdge } from "../constants";
import { summarizeCondition } from "../condition/summarize";
import type { WorkflowNodeData } from "@/types/workflow";

export function IfNode({ data, selected }: NodeProps) {
  const d = data as WorkflowNodeData;
  const summary = summarizeCondition(d.parameters?.condition);

  return (
    <div
      className={`min-w-40 rounded-xl border bg-white px-4 py-3 shadow-sm dark:bg-slate-900 ${
        selected
          ? "border-primary"
          : "border-amber-300 dark:border-amber-500/40"
      }`}
    >
      <Handle type="target" position={Position.Top} className="bg-amber-500!" />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
        If
      </p>
      <p
        className="mt-0.5 max-w-50 truncate text-xs text-slate-500 dark:text-slate-400"
        title={summary}
      >
        {summary}
      </p>
      <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase">
        <span className="text-emerald-600 dark:text-emerald-400">true</span>
        <span className="text-rose-600 dark:text-rose-400">false</span>
      </div>
      <Handle
        id={ConditionEdge.TRUE}
        type="source"
        position={Position.Bottom}
        style={{ left: "25%" }}
        className="bg-emerald-500!"
      />
      <Handle
        id={ConditionEdge.FALSE}
        type="source"
        position={Position.Bottom}
        style={{ left: "75%" }}
        className="bg-rose-500!"
      />
    </div>
  );
}
```

- [ ] **Step 2: Register the node type**

Replace `src/features/workflow/nodes/nodeTypes.ts` with:

```ts
import type { NodeTypes } from "@xyflow/react";
import { NodeType } from "../constants";
import { EndNode } from "./EndNode";
import { IfNode } from "./IfNode";
import { StartNode } from "./StartNode";

export const nodeTypes: NodeTypes = {
  [NodeType.START]: StartNode,
  [NodeType.END]: EndNode,
  [NodeType.IF]: IfNode,
};
```

- [ ] **Step 3: Add the palette item**

Replace the `PALETTE_ITEMS` array in `src/features/workflow/nodes/dragData.ts` with (keep the rest of the file unchanged, and add the `NodeType` import at the top):

```ts
import { NodeType } from "../constants";
```

```ts
export const PALETTE_ITEMS: PaletteItem[] = [
  { type: NodeType.START, label: "Start" },
  { type: NodeType.IF, label: "If / Condition" },
  { type: NodeType.END, label: "End" },
];
```

- [ ] **Step 4: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/workflow/nodes/IfNode.tsx src/features/workflow/nodes/nodeTypes.ts src/features/workflow/nodes/dragData.ts
git commit -m "feat(workflow): add if node with true/false handles and palette entry

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Inspector panel + page wiring

The right-side inspector that edits the selected node's description and (for if nodes) its condition, mounted in the page layout.

**Files:**

- Create: `src/features/workflow/Inspector.tsx`
- Modify: `src/features/workflow/WorkflowBuilderPage.tsx`

**Interfaces:**

- Consumes: `useAppDispatch`/`useAppSelector` from `@/store/hooks`; `updateNodeData` from `./workflowSlice` (Task 5); `NodeType` from `./constants`; `ConditionEditor` from `./condition/ConditionEditor` (Task 8); `JsonLogicValue`, `WorkflowNodeData` types.
- Produces: `Inspector` (no props) mounted to the right of the canvas.

- [ ] **Step 1: Write `Inspector.tsx`**

Create `src/features/workflow/Inspector.tsx`:

```tsx
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { WorkflowNodeData } from "@/types/workflow";
import { NodeType } from "./constants";
import { ConditionEditor } from "./condition/ConditionEditor";
import type { JsonLogicValue } from "./expression/operand";
import { updateNodeData } from "./workflowSlice";

const CONDITION_KEY = "condition";

const panel =
  "flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900";

export function Inspector() {
  const dispatch = useAppDispatch();
  const nodes = useAppSelector((s) => s.workflow.nodes);
  const selected = nodes.find((n) => n.selected);

  if (!selected) {
    return (
      <aside className={panel}>
        <p className="text-sm text-slate-400">Select a node to edit it.</p>
      </aside>
    );
  }

  const data = selected.data as WorkflowNodeData;
  const nodeNames = nodes.map((n) => n.id);
  const condition = (data.parameters?.[CONDITION_KEY] ?? {}) as JsonLogicValue;

  return (
    <aside className={panel}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Node
        </p>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
          {selected.id}
        </p>
        <p className="text-xs text-slate-400">{selected.type}</p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Description
        </span>
        <input
          type="text"
          value={data.description}
          onChange={(e) =>
            dispatch(
              updateNodeData({
                id: selected.id,
                data: { description: e.target.value },
              }),
            )
          }
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </label>

      {selected.type === NodeType.IF && (
        <ConditionEditor
          key={selected.id}
          condition={condition}
          nodeNames={nodeNames}
          onChange={(next) =>
            dispatch(
              updateNodeData({
                id: selected.id,
                data: {
                  parameters: { ...data.parameters, [CONDITION_KEY]: next },
                },
              }),
            )
          }
        />
      )}
    </aside>
  );
}
```

- [ ] **Step 2: Mount the inspector in the page**

In `src/features/workflow/WorkflowBuilderPage.tsx`, add the import:

```tsx
import { Inspector } from "./Inspector";
```

Then place `<Inspector />` to the right of the canvas — replace the inner flex row so it reads:

```tsx
<div className="flex min-h-0 flex-1">
  <Sidebar
    collapsed={sidebarCollapsed}
    onToggle={() => setSidebarCollapsed((c) => !c)}
  />
  <div className="min-w-0 flex-1">
    <WorkflowCanvas />
  </div>
  <Inspector />
</div>
```

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Run: `bun dev`, open the app, then verify:

1. The palette shows **If / Condition**; drag it onto the canvas — a node titled "If" with "No condition"/"Always (empty)" and green `true` / red `false` handles appears.
2. Click the if node → the right inspector shows the condition builder. Click **+ Condition**, type `$state.` in the left field → the dropdown lists the six sources / node names; pick one, choose an operator, type `18` on the right. The node card summary updates (e.g. `$state.age > 18`).
3. Click **+ Group**, give it `OR`, add two comparisons — nesting renders indented.
4. Drag from the green handle to another node, then the red handle to a third → two edges labelled `true` / `false`.
5. Toggle **JSON** → see the JSON Logic; edit it back; toggle **Builder**. Put an unsupported op (e.g. `{"!":[{"var":"x"}]}`) and toggle Builder → the unsupported-shape message appears and it stays in JSON.
6. **Save**, reload the page (**Load** runs on mount) → the if node, its condition, and the true/false edges persist.

Fix any issue found before committing.

- [ ] **Step 5: Commit**

```bash
git add src/features/workflow/Inspector.tsx src/features/workflow/WorkflowBuilderPage.tsx
git commit -m "feat(workflow): add node inspector with condition editing

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Documentation + full verification

Update the feature docs and run the complete verification suite.

**Files:**

- Modify: `src/features/workflow/CLAUDE.md`

**Interfaces:**

- Consumes: everything above.
- Produces: updated docs; green test + typecheck.

- [ ] **Step 1: Update the feature CLAUDE.md**

In `src/features/workflow/CLAUDE.md`, under "## Files", add entries (keep the existing list, insert these):

```markdown
- `constants.ts` — frontend mirror of the chat service's `core/constants/workflow.py` (`NodeType`, `EdgeLabel`, `ConditionEdge`, `CONTEXT_SOURCES`). Guarded by `constants.test.ts`.
- `Inspector.tsx` — right-side properties panel for the selected node (xyflow `selected` flag). Edits `description` and, for `if` nodes, the condition.
- `components/ExpressionInput.tsx` — reusable autocomplete text input for `$source.path` operands.
- `expression/` — pure operand codec (`operand.ts`) and autocomplete logic (`suggestions.ts`).
- `condition/` — JSON Logic condition: tree model (`types.ts`), codec (`jsonLogic.ts`), one-line summary (`summarize.ts`), and the editor UI (`ConditionBuilder.tsx`, `ConditionEditor.tsx`).
- `nodes/IfNode.tsx` — the if node: one target handle, two source handles (`true`/`false`).
```

Under "## Conventions", add:

```markdown
- The if node (`type: "if"`) stores its JSON Logic condition in `data.parameters.condition`. Edit it via the Inspector; never hand-edit elsewhere. The builder ↔ JSON Logic codec lives in `condition/jsonLogic.ts` — extend it (and its test) when adding operators.
- Edge labels come from the source handle (`connected` uses `sourceHandle ?? "main"`). The if node's handles are `true`/`false`; all other nodes use the default handle → `main`.
- Variable paths follow the chat service: `$state`/`$config`/`$variables`/`$parameters`/`$nodes.<name>.<path>`/`$trigger`. Keep `constants.ts` in sync with `core/constants/workflow.py`.
```

- [ ] **Step 2: Run the full test suite**

Run: `bun test`
Expected: PASS — all suites (theme, workflow slice, serializer, constants, operand, suggestions, jsonLogic, summarize).

- [ ] **Step 3: Typecheck the whole project**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/workflow/CLAUDE.md
git commit -m "docs(workflow): document if node, inspector, and expression input

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage:** constants (T1) ✓, ExpressionInput + suggestions (T7, T3) ✓, operand codec (T2) ✓, condition model/codec/summary (T4) ✓, ConditionBuilder/Editor with nesting + JSON fallback (T8) ✓, Inspector (T10) ✓, IfNode + handles + palette (T9) ✓, slice changes (T5) ✓, serialization round-trip (T6) ✓, docs (T11) ✓.
- **Type consistency:** `JsonLogicValue` defined in T2 and reused everywhere; `Group`/`Comparison`/`ConditionTree`, `CompareOp`/`CombineOp` defined in T4 and reused in T8; `updateNodeData` signature consistent between T5 (definition) and T10 (use); `getSuggestions`/`Suggestion` consistent T3↔T7; `treeToJsonLogic`/`jsonLogicToTree`/`emptyGroup`/`emptyComparison`/`defaultCondition` consistent T4↔T5↔T6↔T8.
- **No DOM tests:** intentional — repo has no DOM test infra; the hard logic is fully unit-tested in pure modules, UI verified via typecheck (every UI task) + the manual smoke (T10).

```

```
