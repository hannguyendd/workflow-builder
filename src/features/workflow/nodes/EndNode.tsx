import { Handle, Position, type NodeProps } from "@xyflow/react";

export function EndNode(_props: NodeProps) {
  return (
    <div className="rounded-xl border border-rose-300 bg-white px-5 py-3 shadow-sm dark:border-rose-500/40 dark:bg-slate-900">
      <Handle type="target" position={Position.Top} className="bg-rose-500!" />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
        End
      </p>
    </div>
  );
}
