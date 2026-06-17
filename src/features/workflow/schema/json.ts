/** Narrow to a non-null, non-array object. Shared JSON-Schema guard. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
