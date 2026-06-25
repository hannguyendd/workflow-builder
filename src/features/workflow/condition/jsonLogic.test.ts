import { expect, test } from "bun:test";
import {
  defaultCondition,
  emptyComparison,
  emptyGroup,
  jsonLogicToTree,
  treeToJsonLogic,
} from "./jsonLogic";
import type { JsonLogicValue } from "../expression/operand";
import type { Group } from "./types";

test("treeToJsonLogic serialises a flat AND of comparisons", () => {
  const tree: Group = {
    kind: "group",
    id: "g",
    combinator: "and",
    children: [
      { kind: "comparison", id: "c1", left: "$state.age", op: ">", right: "18" },
      { kind: "comparison", id: "c2", left: "$state.country", op: "==", right: "US" },
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
      { kind: "comparison", id: "c1", left: "$state.age", op: ">", right: "18" },
      {
        kind: "group",
        id: "g2",
        combinator: "or",
        children: [
          { kind: "comparison", id: "c2", left: "$state.country", op: "==", right: "US" },
          { kind: "comparison", id: "c3", left: "$state.country", op: "==", right: "CA" },
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
  const jl: JsonLogicValue = {
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
  expect(cmp).toMatchObject({ kind: "comparison", op: "==", left: "", right: "" });
});
