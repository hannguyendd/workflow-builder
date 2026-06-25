import { expect, test } from "bun:test";
import { getSuggestions } from "./suggestions";
import type { NodeOutputs } from "./nodeOutputs";

const ifNode: NodeOutputs = { name: "kyc_check", type: "if", fields: [] };
const fetchNode: NodeOutputs = { name: "fetch_patient", type: "if", fields: [] };
const agentNode: NodeOutputs = {
  name: "coach",
  type: "agent",
  fields: [
    { name: "response", type: "string" },
    {
      name: "structuredResponse",
      type: "object",
      children: [
        { name: "score", type: "number", description: "0-100" },
        { name: "summary", type: "string" },
      ],
    },
    { name: "messages", type: "array" },
  ],
};

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

test("after $nodes. it suggests the available node names", () => {
  expect(getSuggestions("$nodes.", [ifNode, fetchNode])).toEqual([
    { value: "$nodes.kyc_check.", label: "kyc_check" },
    { value: "$nodes.fetch_patient.", label: "fetch_patient" },
  ]);
});

test("node names filter by the typed segment, case-insensitively", () => {
  expect(getSuggestions("$nodes.KY", [ifNode, fetchNode]).map((s) => s.label)).toEqual([
    "kyc_check",
  ]);
});

test("a node with no fields yields nothing past its name", () => {
  expect(getSuggestions("$nodes.kyc_check.status", [ifNode])).toEqual([]);
});

test("an agent node suggests its top-level output fields", () => {
  expect(getSuggestions("$nodes.coach.", [agentNode])).toEqual([
    { value: "$nodes.coach.response", label: "response — string" },
    { value: "$nodes.coach.structuredResponse.", label: "structuredResponse — object" },
    { value: "$nodes.coach.messages", label: "messages — array" },
  ]);
});

test("structuredResponse drills into the output-schema children", () => {
  expect(getSuggestions("$nodes.coach.structuredResponse.", [agentNode])).toEqual([
    { value: "$nodes.coach.structuredResponse.score", label: "score — number", description: "0-100" },
    { value: "$nodes.coach.structuredResponse.summary", label: "summary — string" },
  ]);
});

test("field suggestions filter by the typed segment", () => {
  expect(
    getSuggestions("$nodes.coach.structuredResponse.sc", [agentNode]).map((s) => s.label),
  ).toEqual(["score — number"]);
});

test("unknown node name yields no suggestions", () => {
  expect(getSuggestions("$nodes.ghost.", [agentNode])).toEqual([]);
});

test("after $parameters. it suggests schema field names with type labels", () => {
  const params = [
    { name: "userId", type: "string" },
    { name: "limit", type: "number" },
  ];
  expect(getSuggestions("$parameters.", [], params)).toEqual([
    { value: "$parameters.userId", label: "userId — string" },
    { value: "$parameters.limit", label: "limit — number" },
  ]);
});

test("parameter suggestions carry the field description when present", () => {
  const params = [{ name: "userId", type: "string", description: "The user identifier" }];
  expect(getSuggestions("$parameters.", [], params)).toEqual([
    { value: "$parameters.userId", label: "userId — string", description: "The user identifier" },
  ]);
});

test("no suggestions once a path goes deeper than the parameter name", () => {
  const params = [{ name: "user", type: "string" }];
  expect(getSuggestions("$parameters.user.id", [], params)).toEqual([]);
});

test("$parameters. with no schema yields no field suggestions", () => {
  expect(getSuggestions("$parameters.", [])).toEqual([]);
});

test("non-$ input yields no suggestions", () => {
  expect(getSuggestions("age", [])).toEqual([]);
});
