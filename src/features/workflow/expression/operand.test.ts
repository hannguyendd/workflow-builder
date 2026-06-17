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
