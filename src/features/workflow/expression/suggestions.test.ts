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
  expect(getSuggestions("$no", [])).toEqual([{ value: "$nodes.", label: "$nodes" }]);
});

test("after $nodes. it suggests live node names", () => {
  const out = getSuggestions("$nodes.", ["kyc_check", "fetch_patient"]);
  expect(out).toEqual([
    { value: "$nodes.kyc_check.", label: "kyc_check" },
    { value: "$nodes.fetch_patient.", label: "fetch_patient" },
  ]);
});

test("node names filter by the typed segment, case-insensitively", () => {
  expect(getSuggestions("$nodes.KY", ["kyc_check", "fetch_patient"]).map((s) => s.label)).toEqual([
    "kyc_check",
  ]);
});

test("no suggestions once a path goes deeper than the node name", () => {
  expect(getSuggestions("$nodes.kyc_check.status", ["kyc_check"])).toEqual([]);
});

test("non-$ input yields no suggestions", () => {
  expect(getSuggestions("age", [])).toEqual([]);
});
