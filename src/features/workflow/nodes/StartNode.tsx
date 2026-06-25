import { Handle, Position, type NodeProps } from "@xyflow/react";

export function StartNode(_props: NodeProps) {
  return (
    <div className="rounded-xl border border-emerald-300 bg-white px-5 py-3 shadow-sm dark:border-emerald-500/40 dark:bg-slate-900">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
        Start
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-500" />
    </div>
  );
}
