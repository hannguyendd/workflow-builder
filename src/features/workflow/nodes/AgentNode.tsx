import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useAppSelector } from "@/store/hooks";
import type { WorkflowNodeData } from "@/types/workflow";
import { AgentNodeField } from "../constants";

const PARAM = AgentNodeField.AGENT_PARAM;

export function AgentNode({ data, selected }: NodeProps) {
  const d = data as WorkflowNodeData;
  const agentId = d.parameters?.[PARAM.AGENT_CONFIGURATION_ID] as string | undefined;
  const output = d.parameters?.[PARAM.OUTPUT] as string | undefined;
  const agentName = useAppSelector((s) => (agentId ? s.agents.byId[agentId]?.name : undefined));

  return (
    <div
      className={`min-w-[180px] rounded-xl border bg-white px-4 py-3 shadow-sm dark:bg-slate-900 ${
        selected ? "border-primary" : "border-violet-300 dark:border-violet-500/40"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-violet-500" />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
        Agent
      </p>
      <p
        className="mt-0.5 max-w-[220px] truncate text-sm font-medium text-slate-800 dark:text-slate-100"
        title={agentName ?? "No agent selected"}
      >
        {agentName ?? "No agent selected"}
      </p>
      {output && (
        <p className="mt-0.5 max-w-[220px] truncate text-[11px] text-slate-400" title={output}>
          → {output}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-violet-500" />
    </div>
  );
}
