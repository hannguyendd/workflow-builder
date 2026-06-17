/**
 * Codec between a flat JSON Schema `parameterSchema` object and an editable
 * field list. `schemaToFields` returns null when the schema uses features the
 * form builder can't represent (nested objects, arrays, enums, unknown types,
 * non-object root) — that triggers raw-JSON editing in the panel.
 */

export type ParamType = "string" | "number" | "integer" | "boolean";

export const PARAM_TYPES: readonly ParamType[] = ["string", "number", "integer", "boolean"];

export interface ParameterField {
  name: string;
  type: ParamType;
  description: string;
  required: boolean;
}

/** A top-level parameter, for autocomplete labels. */
export interface ParameterEntry {
  name: string;
  type: string;
}

const ROOT_TYPE = "object";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isParamType(value: unknown): value is ParamType {
  return typeof value === "string" && (PARAM_TYPES as readonly string[]).includes(value);
}

/** True when a property object is a bare scalar the form can represent. */
function isSimpleProperty(prop: unknown): prop is { type: ParamType; description?: string } {
  if (!isPlainObject(prop)) return false;
  if (!isParamType(prop.type)) return false;
  // Only `type` and `description` are representable; anything else (enum,
  // items, format, properties, ...) must be edited as JSON.
  return Object.keys(prop).every((k) => k === "type" || k === "description");
}

/** JSON Schema object -> editable fields, or null if not form-representable. */
export function schemaToFields(schema: unknown): ParameterField[] | null {
  if (!isPlainObject(schema)) return null;
  if (schema.type !== ROOT_TYPE) return null;
  const props = schema.properties ?? {};
  if (!isPlainObject(props)) return null;
  const required = Array.isArray(schema.required) ? schema.required : [];

  const fields: ParameterField[] = [];
  for (const [name, prop] of Object.entries(props)) {
    if (!isSimpleProperty(prop)) return null;
    fields.push({
      name,
      type: prop.type,
      description: typeof prop.description === "string" ? prop.description : "",
      required: required.includes(name),
    });
  }
  return fields;
}

/** Editable fields -> JSON Schema object. */
export function fieldsToSchema(fields: ParameterField[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const f of fields) {
    const prop: Record<string, unknown> = { type: f.type };
    if (f.description) prop.description = f.description;
    properties[f.name] = prop;
    if (f.required) required.push(f.name);
  }
  return { type: ROOT_TYPE, properties, required };
}

/** Top-level { name, type } entries for autocomplete (best-effort). */
export function parameterEntries(schema: unknown): ParameterEntry[] {
  if (!isPlainObject(schema)) return [];
  const props = schema.properties;
  if (!isPlainObject(props)) return [];
  return Object.entries(props).map(([name, prop]) => ({
    name,
    type: isPlainObject(prop) && typeof prop.type === "string" ? prop.type : "",
  }));
}
