import { type PointerEvent as ReactPointerEvent } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { WorkflowNodeData } from "@/types/workflow";
import { NodeType } from "./constants";
import { ConditionEditor } from "./condition/ConditionEditor";
import type { JsonLogicValue } from "./expression/operand";
import { updateNodeData } from "./workflowSlice";

const CONDITION_KEY = "condition";

/** Resizable-panel width bounds (px). */
export const INSPECTOR_MIN_WIDTH = 240;
export const INSPECTOR_MAX_WIDTH = 560;
export const INSPECTOR_DEFAULT_WIDTH = 288;

const clamp = (n: number) => Math.min(INSPECTOR_MAX_WIDTH, Math.max(INSPECTOR_MIN_WIDTH, n));

interface InspectorProps {
  width: number;
  onWidthChange: (width: number) => void;
  onClose: () => void;
}

export function Inspector({ width, onWidthChange, onClose }: InspectorProps) {
  const dispatch = useAppDispatch();
  const nodes = useAppSelector((s) => s.workflow.nodes);
  const selected = nodes.find((n) => n.selected);

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

  const data = selected?.data as WorkflowNodeData | undefined;
  const nodeNames = nodes.map((n) => n.id);

  return (
    <aside
      style={{ width }}
      className="relative flex shrink-0 flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <div
        onPointerDown={startResize}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize inspector"
        className="absolute inset-y-0 left-0 z-10 w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-primary/40"
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
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Node
              </p>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {selected.id}
              </p>
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
