import { useAppSelector } from "@/store/hooks";
import type { WorkflowNodeData } from "@/types/workflow";
import { ExpressionInput } from "../components/ExpressionInput";
import { AgentNodeField } from "../constants";
import type { NodeOutputs } from "../expression/nodeOutputs";
import type { ParameterEntry } from "../schema/parameterSchema";
import { agentInputFields } from "./inputFields";

const PARAM = AgentNodeField.AGENT_PARAM;

interface AgentEditorProps {
  parameters: Record<string, unknown>;
  nodeOutputs: NodeOutputs[];
  parameterEntries: ParameterEntry[];
  onChange: (data: Partial<WorkflowNodeData>) => void;
}

export function AgentEditor({ parameters, nodeOutputs, parameterEntries, onChange }: AgentEditorProps) {
  const status = useAppSelector((s) => s.agents.status);
  const agents = useAppSelector((s) => s.agents.ids.map((id) => s.agents.byId[id]!));
  const agentsById = useAppSelector((s) => s.agents.byId);

  const agentId = (parameters[PARAM.AGENT_CONFIGURATION_ID] as string) ?? "";
  const selectedAgent = agentId ? agentsById[agentId] : undefined;
  const input = (parameters[PARAM.INPUT] as Record<string, unknown>) ?? {};
  const output = (parameters[PARAM.OUTPUT] as string) ?? "";
  const fields = agentInputFields(selectedAgent?.inputSchema);

  function setParam(key: string, value: unknown) {
    onChange({ parameters: { ...parameters, [key]: value } });
  }
  function setInputField(name: string, value: string) {
    setParam(PARAM.INPUT, { ...input, [name]: value });
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Agent</span>
        {status === "loading" ? (
          <p className="text-sm text-slate-400">Loading agents…</p>
        ) : status === "error" ? (
          <p className="text-sm text-rose-500">Failed to load agents.</p>
        ) : (
          <select
            value={agentId}
            onChange={(e) => setParam(PARAM.AGENT_CONFIGURATION_ID, e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">Select an agent…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            {agentId && !selectedAgent && (
              <option value={agentId}>Unknown agent ({agentId})</option>
            )}
          </select>
        )}
      </label>

      {selectedAgent && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Input mapping
          </span>
          {fields.length === 0 && (
            <p className="text-xs italic text-slate-400">This agent has no input fields.</p>
          )}
          {fields.map((f) => (
            <label key={f.name} className="flex flex-col gap-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {f.name}
                {f.required && <span className="text-rose-500"> *</span>}
                {f.type && <span className="text-slate-400"> — {f.type}</span>}
              </span>
              <ExpressionInput
                value={(input[f.name] as string) ?? ""}
                nodeOutputs={nodeOutputs}
                parameters={parameterEntries}
                placeholder="$parameters.…"
                onChange={(v) => setInputField(f.name, v)}
              />
              {f.description && <span className="text-[11px] text-slate-400">{f.description}</span>}
            </label>
          ))}
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Output path
        </span>
        <input
          type="text"
          value={output}
          placeholder="state.answer"
          onChange={(e) => setParam(PARAM.OUTPUT, e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </label>
    </div>
  );
}
