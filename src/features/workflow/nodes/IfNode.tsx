import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ConditionEdge } from "../constants";
import { summarizeCondition } from "../condition/summarize";
import type { WorkflowNodeData } from "@/types/workflow";

export function IfNode({ data, selected }: NodeProps) {
  const d = data as WorkflowNodeData;
  const summary = summarizeCondition(d.parameters?.condition);

  return (
    <div
      className={`min-w-[160px] rounded-xl border bg-white px-4 py-3 shadow-sm dark:bg-slate-900 ${
        selected ? "border-primary" : "border-amber-300 dark:border-amber-500/40"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-amber-500" />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
        If
      </p>
      <p
        className="mt-0.5 max-w-[200px] truncate text-xs text-slate-500 dark:text-slate-400"
        title={summary}
      >
        {summary}
      </p>
      <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase">
        <span className="text-emerald-600 dark:text-emerald-400">true</span>
        <span className="text-rose-600 dark:text-rose-400">false</span>
      </div>
      <Handle
        id={ConditionEdge.TRUE}
        type="source"
        position={Position.Bottom}
        style={{ left: "25%" }}
        className="!bg-emerald-500"
      />
      <Handle
        id={ConditionEdge.FALSE}
        type="source"
        position={Position.Bottom}
        style={{ left: "75%" }}
        className="!bg-rose-500"
      />
    </div>
  );
}
