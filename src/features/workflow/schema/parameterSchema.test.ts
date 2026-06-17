import { expect, test } from "bun:test";
import {
  PARAM_TYPES,
  fieldsToSchema,
  parameterEntries,
  schemaToFields,
  type ParameterField,
} from "./parameterSchema";

const SAMPLE = {
  type: "object",
  properties: {
    patient_name: { type: "string", description: "Patient's display name" },
    systolic: { type: "number", description: "Systolic BP" },
  },
  required: ["patient_name"],
};

test("PARAM_TYPES lists the four supported scalar types", () => {
  expect([...PARAM_TYPES]).toEqual(["string", "number", "integer", "boolean"]);
});

test("schemaToFields parses properties, descriptions, and required flags", () => {
  expect(schemaToFields(SAMPLE)).toEqual([
    {
      name: "patient_name",
      type: "string",
      description: "Patient's display name",
      required: true,
    },
    {
      name: "systolic",
      type: "number",
      description: "Systolic BP",
      required: false,
    },
  ]);
});

test("schemaToFields treats the default empty schema as no fields", () => {
  expect(
    schemaToFields({ type: "object", properties: {}, required: [] }),
  ).toEqual([]);
});

test("schemaToFields returns null for non-object roots", () => {
  expect(schemaToFields({ type: "string" })).toBeNull();
  expect(schemaToFields(null)).toBeNull();
  expect(schemaToFields("nope")).toBeNull();
});

test("schemaToFields returns null when a property is not a supported scalar", () => {
  expect(
    schemaToFields({ type: "object", properties: { tags: { type: "array" } } }),
  ).toBeNull();
  expect(
    schemaToFields({
      type: "object",
      properties: { user: { type: "object" } },
    }),
  ).toBeNull();
  expect(
    schemaToFields({
      type: "object",
      properties: { x: { type: "string", enum: ["a"] } },
    }),
  ).toBeNull();
});

test("fieldsToSchema emits properties in order and a required array", () => {
  const fields: ParameterField[] = [
    {
      name: "patient_name",
      type: "string",
      description: "Patient's display name",
      required: true,
    },
    {
      name: "systolic",
      type: "number",
      description: "Systolic BP",
      required: false,
    },
  ];
  expect(fieldsToSchema(fields)).toEqual(SAMPLE);
});

test("fieldsToSchema omits description when empty and required when none", () => {
  expect(
    fieldsToSchema([
      { name: "x", type: "string", description: "", required: false },
    ]),
  ).toEqual({
    type: "object",
    properties: { x: { type: "string" } },
    required: [],
  });
});

test("schemaToFields <-> fieldsToSchema round-trips", () => {
  const fields = schemaToFields(SAMPLE)!;
  expect(fieldsToSchema(fields)).toEqual(SAMPLE);
});

test("parameterEntries returns top-level name/type pairs with descriptions", () => {
  expect(parameterEntries(SAMPLE)).toEqual([
    {
      name: "patient_name",
      type: "string",
      description: "Patient's display name",
    },
    { name: "systolic", type: "number", description: "Systolic BP" },
  ]);
});

test("parameterEntries tolerates schemas the form can't represent", () => {
  expect(
    parameterEntries({
      type: "object",
      properties: { tags: { type: "array" } },
    }),
  ).toEqual([{ name: "tags", type: "array" }]);
  expect(parameterEntries({ type: "string" })).toEqual([]);
  expect(parameterEntries(null)).toEqual([]);
});
