import { expect, test } from "bun:test";
import type { Edge } from "@xyflow/react";
import { upstreamNodeIds } from "./graph";

/** Minimal edge factory — only source/target matter here. */
const e = (source: string, target: string): Edge => ({ id: `${source}->${target}`, source, target });

test("returns all ancestors along a chain", () => {
  const edges = [e("start", "a"), e("a", "b"), e("b", "end")];
  expect([...upstreamNodeIds("end", edges)].sort()).toEqual(["a", "b", "start"]);
  expect([...upstreamNodeIds("a", edges)]).toEqual(["start"]);
});

test("a root node has no ancestors", () => {
  expect([...upstreamNodeIds("start", [e("start", "a")])]).toEqual([]);
});

test("excludes nodes only reachable downstream (siblings of a branch)", () => {
  // start -> gate; gate -true-> yes; gate -false-> no
  const edges = [e("start", "gate"), e("gate", "yes"), e("gate", "no")];
  expect([...upstreamNodeIds("yes", edges)].sort()).toEqual(["gate", "start"]);
  expect([...upstreamNodeIds("yes", edges)]).not.toContain("no");
});

test("terminates on a cycle and excludes the target itself", () => {
  const edges = [e("a", "b"), e("b", "a")];
  expect([...upstreamNodeIds("a", edges)]).toEqual(["b"]);
});
