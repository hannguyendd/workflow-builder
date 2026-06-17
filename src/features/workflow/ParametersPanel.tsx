import { useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateParameterSchema } from "./workflowSlice";
import {
  PARAM_TYPES,
  fieldsToSchema,
  schemaToFields,
  type ParameterField,
  type ParamType,
} from "./schema/parameterSchema";

/** Resizable-panel width bounds (px). */
export const PARAMETERS_MIN_WIDTH = 280;
export const PARAMETERS_MAX_WIDTH = 640;
export const PARAMETERS_DEFAULT_WIDTH = 340;

const clamp = (n: number) => Math.min(PARAMETERS_MAX_WIDTH, Math.max(PARAMETERS_MIN_WIDTH, n));

type Mode = "builder" | "json";

const UNSUPPORTED_MSG =
  "This schema can't be edited in the builder (nested objects, arrays, enums, …). Keep editing as JSON.";

const emptyField = (): ParameterField => ({
  name: "",
  type: "string",
  description: "",
  required: false,
});

function safeParse(text: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(text);
    return typeof v === "object" && v !== null && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

interface ParametersPanelProps {
  width: number;
  onWidthChange: (width: number) => void;
  onClose: () => void;
}

export function ParametersPanel({ width, onWidthChange, onClose }: ParametersPanelProps) {
  const dispatch = useAppDispatch();
  const schema = useAppSelector((s) => s.workflow.meta.parameterSchema);

  // Parse once for initial mode; edits drive the store thereafter.
  const initialFields = useMemo(() => schemaToFields(schema), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [mode, setMode] = useState<Mode>(initialFields ? "builder" : "json");
  const [fields, setFields] = useState<ParameterField[]>(initialFields ?? []);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(schema, null, 2));
  const [jsonError, setJsonError] = useState("");

  function commitFields(next: ParameterField[]) {
    setFields(next);
    dispatch(updateParameterSchema(fieldsToSchema(next)));
  }

  function updateField(index: number, patch: Partial<ParameterField>) {
    commitFields(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function removeField(index: number) {
    commitFields(fields.filter((_, i) => i !== index));
  }

  function updateJson(text: string) {
    setJsonText(text);
    const parsed = safeParse(text);
    if (parsed === null) {
      setJsonError("Invalid JSON object");
      return;
    }
    setJsonError("");
    dispatch(updateParameterSchema(parsed));
  }

  function switchToJson() {
    setJsonText(JSON.stringify(fieldsToSchema(fields), null, 2));
    setJsonError("");
    setMode("json");
  }

  function switchToBuilder() {
    const parsed = schemaToFields(safeParse(jsonText));
    if (parsed) {
      setFields(parsed);
      setJsonError("");
      setMode("builder");
    } else {
      setJsonError(UNSUPPORTED_MSG);
    }
  }

  // Panel is anchored to the right edge, so its width grows as the pointer
  // moves left: width = viewport width - pointer x.
  function startResize(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const onMove = (ev: PointerEvent) => onWidthChange(clamp(window.innerWidth - ev.clientX));
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <aside
      style={{ width }}
      className="relative flex shrink-0 flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div
        onPointerDown={startResize}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize parameters panel"
        className="absolute inset-y-0 left-0 z-10 w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-primary/40"
      />

      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Parameters
        </span>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-slate-300 dark:border-slate-600">
            <button
              type="button"
              onClick={switchToBuilder}
              className={`px-2 py-0.5 text-xs ${
                mode === "builder"
                  ? "bg-primary text-white"
                  : "bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              Builder
            </button>
            <button
              type="button"
              onClick={switchToJson}
              className={`px-2 py-0.5 text-xs ${
                mode === "json"
                  ? "bg-primary text-white"
                  : "bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              JSON
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close parameters panel"
            className="rounded-md px-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            ×
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {mode === "builder" ? (
          <>
            {fields.length === 0 && <p className="text-sm text-slate-400">No parameters yet.</p>}
            {fields.map((field, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 p-2 dark:border-slate-700"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={field.name}
                    placeholder="name"
                    onChange={(e) => updateField(i, { name: e.target.value })}
                    aria-label="Parameter name"
                    className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <select
                    value={field.type}
                    onChange={(e) => updateField(i, { type: e.target.value as ParamType })}
                    aria-label="Parameter type"
                    className="rounded-md border border-slate-300 bg-white px-1 py-1 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {PARAM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeField(i)}
                    aria-label="Remove parameter"
                    className="px-1 py-1 text-xs text-slate-400 hover:text-rose-500"
                  >
                    ✕
                  </button>
                </div>
                <input
                  type="text"
                  value={field.description}
                  placeholder="description"
                  onChange={(e) => updateField(i, { description: e.target.value })}
                  aria-label="Parameter description"
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateField(i, { required: e.target.checked })}
                  />
                  required
                </label>
              </div>
            ))}
            <button
              type="button"
              onClick={() => commitFields([...fields, emptyField()])}
              className="self-start rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              + Add parameter
            </button>
          </>
        ) : (
          <textarea
            value={jsonText}
            onChange={(e) => updateJson(e.target.value)}
            spellCheck={false}
            rows={16}
            className="w-full rounded-md border border-slate-300 bg-white p-2 font-mono text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        )}
        {jsonError && <p className="text-xs text-rose-500">{jsonError}</p>}
      </div>
    </aside>
  );
}
