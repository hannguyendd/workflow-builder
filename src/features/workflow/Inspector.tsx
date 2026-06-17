import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { WorkflowNodeData } from "@/types/workflow";
import { NodeType } from "./constants";
import { ConditionEditor } from "./condition/ConditionEditor";
import type { JsonLogicValue } from "./expression/operand";
import { updateNodeData } from "./workflowSlice";

const CONDITION_KEY = "condition";

const panel =
  "flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900";

export function Inspector() {
  const dispatch = useAppDispatch();
  const nodes = useAppSelector((s) => s.workflow.nodes);
  const selected = nodes.find((n) => n.selected);

  if (!selected) {
    return (
      <aside className={panel}>
        <p className="text-sm text-slate-400">Select a node to edit it.</p>
      </aside>
    );
  }

  const data = selected.data as WorkflowNodeData;
  const nodeNames = nodes.map((n) => n.id);
  const condition = (data.parameters?.[CONDITION_KEY] ?? {}) as JsonLogicValue;

  return (
    <aside className={panel}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Node</p>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{selected.id}</p>
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
            dispatch(updateNodeData({ id: selected.id, data: { description: e.target.value } }))
          }
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </label>

      {selected.type === NodeType.IF && (
        <ConditionEditor
          key={selected.id}
          condition={condition}
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
    </aside>
  );
}
