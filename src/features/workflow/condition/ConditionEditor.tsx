import { useMemo, useState } from "react";
import type { JsonLogicValue } from "../expression/operand";
import type { NodeOutputs } from "../expression/nodeOutputs";
import type { ParameterEntry } from "../schema/parameterSchema";
import { ConditionBuilder } from "./ConditionBuilder";
import { emptyGroup, jsonLogicToTree, treeToJsonLogic } from "./jsonLogic";
import type { Group } from "./types";

interface ConditionEditorProps {
  condition: JsonLogicValue;
  nodeOutputs: NodeOutputs[];
  parameters: ParameterEntry[];
  onChange: (condition: JsonLogicValue) => void;
}

type Mode = "builder" | "json";

function isEmpty(condition: JsonLogicValue): boolean {
  return (
    condition == null ||
    (typeof condition === "object" &&
      !Array.isArray(condition) &&
      Object.keys(condition).length === 0)
  );
}

function safeParse(text: string): JsonLogicValue {
  try {
    return JSON.parse(text) as JsonLogicValue;
  } catch {
    return null;
  }
}

const UNSUPPORTED_MSG =
  "This JSON can't be edited in the builder. Wrap conditions in an and/or group of comparisons, or keep editing as JSON.";

export function ConditionEditor({ condition, nodeOutputs, parameters, onChange }: ConditionEditorProps) {
  // Parse once for initial state; the component is remounted via key={nodeId}
  // when the selected node changes (see Inspector).
  const initialTree = useMemo<Group | null>(() => {
    if (isEmpty(condition)) return emptyGroup("and");
    const tree = jsonLogicToTree(condition);
    return tree && tree.kind === "group" ? tree : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [mode, setMode] = useState<Mode>(initialTree ? "builder" : "json");
  const [tree, setTree] = useState<Group>(initialTree ?? emptyGroup("and"));
  const [jsonText, setJsonText] = useState(() => JSON.stringify(condition ?? {}, null, 2));
  const [jsonError, setJsonError] = useState("");

  function updateTree(next: Group) {
    setTree(next);
    onChange(treeToJsonLogic(next));
  }

  function updateJson(text: string) {
    setJsonText(text);
    const parsed = safeParse(text);
    if (text.trim() !== "" && parsed === null && text.trim() !== "null") {
      setJsonError("Invalid JSON");
      return;
    }
    setJsonError("");
    onChange(parsed);
  }

  function switchToJson() {
    setJsonText(JSON.stringify(treeToJsonLogic(tree), null, 2));
    setJsonError("");
    setMode("json");
  }

  function switchToBuilder() {
    const parsed = jsonLogicToTree(safeParse(jsonText));
    if (parsed && parsed.kind === "group") {
      setTree(parsed);
      setJsonError("");
      setMode("builder");
    } else {
      setJsonError(UNSUPPORTED_MSG);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Condition
        </span>
        <span className="flex-1" />
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
      </div>

      {mode === "builder" ? (
        <ConditionBuilder
          group={tree}
          nodeOutputs={nodeOutputs}
          parameters={parameters}
          onChange={updateTree}
        />
      ) : (
        <div className="flex flex-col gap-1">
          <textarea
            value={jsonText}
            onChange={(e) => updateJson(e.target.value)}
            spellCheck={false}
            rows={8}
            className="w-full rounded-md border border-slate-300 bg-white p-2 font-mono text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      )}
      {jsonError && <p className="text-xs text-rose-500">{jsonError}</p>}
    </div>
  );
}
