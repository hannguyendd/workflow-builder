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
  expect(summarizeCondition(jl)).toBe("$state.age > 18 AND $state.country == US");
});

test("wraps nested groups in parentheses", () => {
  const jl = {
    and: [
      { ">": [{ var: "$state.age" }, 18] },
      { or: [{ "==": [{ var: "$state.c" }, "US"] }, { "==": [{ var: "$state.c" }, "CA"] }] },
    ],
  };
  expect(summarizeCondition(jl)).toBe("$state.age > 18 AND ($state.c == US OR $state.c == CA)");
});

test("falls back to a generic label for non-builder JSON", () => {
  expect(summarizeCondition({ "!": [{ var: "x" }] })).toBe("Custom (JSON)");
});
