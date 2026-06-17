import {
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { WorkflowNodeData } from "@/types/workflow";
import { NodeType } from "./constants";
import { ConditionEditor } from "./condition/ConditionEditor";
import type { JsonLogicValue } from "./expression/operand";
import { validateNodeName } from "./nodeName";
import { renameNode, updateNodeData } from "./workflowSlice";

const CONDITION_KEY = "condition";

/** Resizable-panel height bounds (px). */
export const INSPECTOR_MIN_HEIGHT = 160;
export const INSPECTOR_MAX_HEIGHT = 560;
export const INSPECTOR_DEFAULT_HEIGHT = 240;

const clamp = (n: number) => Math.min(INSPECTOR_MAX_HEIGHT, Math.max(INSPECTOR_MIN_HEIGHT, n));

interface InspectorProps {
  height: number;
  onHeightChange: (height: number) => void;
  onClose: () => void;
}

export function Inspector({ height, onHeightChange, onClose }: InspectorProps) {
  const dispatch = useAppDispatch();
  const nodes = useAppSelector((s) => s.workflow.nodes);
  const selected = nodes.find((n) => n.selected);

  // Panel is anchored to the bottom edge, so its height grows as the pointer
  // moves up: height = viewport height - pointer y.
  function startResize(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const onMove = (ev: PointerEvent) => onHeightChange(clamp(window.innerHeight - ev.clientY));
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const data = selected?.data as WorkflowNodeData | undefined;
  const nodeNames = nodes.map((n) => n.id);

  return (
    <aside
      style={{ height }}
      className="relative flex w-full shrink-0 flex-col border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div
        onPointerDown={startResize}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize inspector"
        className="absolute inset-x-0 top-0 z-10 h-1.5 -translate-y-1/2 cursor-row-resize hover:bg-primary/40"
      />

      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Inspector
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          className="rounded-md px-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          ×
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {!selected || !data ? (
          <p className="text-sm text-slate-400">Select a node to edit it.</p>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Node
              </p>
              {selected.type === NodeType.START || selected.type === NodeType.END ? (
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {selected.id}
                </p>
              ) : (
                <NodeNameField
                  key={selected.id}
                  nodeId={selected.id}
                  takenIds={nodes.filter((n) => n.id !== selected.id).map((n) => n.id)}
                  onRename={(name) => dispatch(renameNode({ id: selected.id, name }))}
                />
              )}
              <p className="text-xs text-slate-400">{selected.type}</p>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Description
              </span>
              <input
                type="text"
                value={data.description}
                onChange={(e) =>
                  dispatch(
                    updateNodeData({ id: selected.id, data: { description: e.target.value } }),
                  )
                }
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>

            {selected.type === NodeType.IF && (
              <ConditionEditor
                key={selected.id}
                condition={(data.parameters?.[CONDITION_KEY] ?? {}) as JsonLogicValue}
                nodeNames={nodeNames}
                onChange={(next) =>
                  dispatch(
                    updateNodeData({
                      id: selected.id,
                      data: { parameters: { ...data.parameters, [CONDITION_KEY]: next } },
                    }),
                  )
                }
              />
            )}
          </>
        )}
      </div>
    </aside>
  );
}

interface NodeNameFieldProps {
  nodeId: string;
  takenIds: string[];
  onRename: (name: string) => void;
}

/**
 * Editable node name. Commits on blur / Enter (not per keystroke, since a
 * rename rewrites edges); Escape reverts. Renaming a node changes its id, so
 * this field is remounted via `key={nodeId}` after a successful rename.
 */
function NodeNameField({ nodeId, takenIds, onRename }: NodeNameFieldProps) {
  const [value, setValue] = useState(nodeId);
  const error = value === nodeId ? null : validateNodeName(value, takenIds);

  function commit() {
    if (value !== nodeId && validateNodeName(value, takenIds) === null) onRename(value);
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setValue(nodeId);
    }
  }

  return (
    <>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        aria-invalid={error !== null}
        aria-label="Node name"
        className={`rounded-md border bg-white px-2 py-1 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100 ${
          error ? "border-rose-400" : "border-slate-300 dark:border-slate-700"
        }`}
      />
      {error && <span className="text-xs text-rose-500">{error}</span>}
    </>
  );
}
