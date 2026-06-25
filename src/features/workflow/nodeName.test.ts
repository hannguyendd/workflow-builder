import { expect, test } from "bun:test";
import { validateNodeName } from "./nodeName";

test("accepts names matching the chat-service pattern", () => {
  expect(validateNodeName("kyc_check", [])).toBeNull();
  expect(validateNodeName("Branch 2", [])).toBeNull();
  expect(validateNodeName("age-gate", [])).toBeNull();
});

test("rejects names that are too short", () => {
  expect(validateNodeName("if", [])).not.toBeNull();
  expect(validateNodeName("", [])).not.toBeNull();
});

test("rejects illegal leading characters and symbols", () => {
  expect(validateNodeName("$foo", [])).not.toBeNull(); // leading $
  expect(validateNodeName("_foo", [])).not.toBeNull(); // leading underscore
  expect(validateNodeName("a/b", [])).not.toBeNull(); // illegal char
});

test("rejects names longer than the max", () => {
  expect(validateNodeName("a".repeat(41), [])).not.toBeNull();
});

test("rejects a name already taken by another node", () => {
  expect(validateNodeName("kyc_check", ["kyc_check", "end"])).not.toBeNull();
  expect(validateNodeName("kyc_check", ["other", "end"])).toBeNull();
});
