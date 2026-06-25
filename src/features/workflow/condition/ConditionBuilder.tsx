import { ExpressionInput } from "../components/ExpressionInput";
import type { NodeOutputs } from "../expression/nodeOutputs";
import type { ParameterEntry } from "../schema/parameterSchema";
import { emptyComparison, emptyGroup } from "./jsonLogic";
import {
  COMBINE_OPS,
  COMPARE_OPS,
  COMPARE_OP_LABELS,
  type CombineOp,
  type Comparison,
  type CompareOp,
  type ConditionTree,
  type Group,
} from "./types";

interface BuilderProps {
  group: Group;
  nodeOutputs: NodeOutputs[];
  parameters: ParameterEntry[];
  onChange: (group: Group) => void;
  onRemove?: () => void;
  depth?: number;
}

export function ConditionBuilder({
  group,
  nodeOutputs,
  parameters,
  onChange,
  onRemove,
  depth = 0,
}: BuilderProps) {
  function updateChild(index: number, child: ConditionTree) {
    const children = group.children.slice();
    children[index] = child;
    onChange({ ...group, children });
  }
  function removeChild(index: number) {
    const children = group.children.slice();
    children.splice(index, 1);
    onChange({ ...group, children });
  }

  return (
    <div
      className={`rounded-lg border border-slate-200 p-2 dark:border-slate-700 ${
        depth > 0 ? "bg-slate-50 dark:bg-slate-900/40" : ""
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Match</span>
        <div className="flex overflow-hidden rounded-md border border-slate-300 dark:border-slate-600">
          {COMBINE_OPS.map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => onChange({ ...group, combinator: op as CombineOp })}
              className={`px-2 py-0.5 text-xs font-semibold uppercase ${
                group.combinator === op
                  ? "bg-primary text-white"
                  : "bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {op}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove group"
            className="text-xs text-slate-400 hover:text-rose-500"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {group.children.map((child, i) =>
          child.kind === "group" ? (
            <ConditionBuilder
              key={child.id}
              group={child}
              nodeOutputs={nodeOutputs}
              parameters={parameters}
              depth={depth + 1}
              onChange={(g) => updateChild(i, g)}
              onRemove={() => removeChild(i)}
            />
          ) : (
            <ComparisonRow
              key={child.id}
              comparison={child}
              nodeOutputs={nodeOutputs}
              parameters={parameters}
              onChange={(c) => updateChild(i, c)}
              onRemove={() => removeChild(i)}
            />
          ),
        )}
        {group.children.length === 0 && (
          <p className="px-1 text-xs italic text-slate-400">No conditions yet.</p>
        )}
      </div>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => onChange({ ...group, children: [...group.children, emptyComparison()] })}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          + Condition
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...group, children: [...group.children, emptyGroup()] })}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          + Group
        </button>
      </div>
    </div>
  );
}

interface RowProps {
  comparison: Comparison;
  nodeOutputs: NodeOutputs[];
  parameters: ParameterEntry[];
  onChange: (c: Comparison) => void;
  onRemove: () => void;
}

function ComparisonRow({ comparison, nodeOutputs, parameters, onChange, onRemove }: RowProps) {
  return (
    <div className="flex items-start gap-1">
      <div className="flex-1">
        <ExpressionInput
          value={comparison.left}
          nodeOutputs={nodeOutputs}
          parameters={parameters}
          placeholder="$state.age"
          onChange={(left) => onChange({ ...comparison, left })}
        />
      </div>
      <select
        value={comparison.op}
        onChange={(e) => onChange({ ...comparison, op: e.target.value as CompareOp })}
        className="rounded-md border border-slate-300 bg-white px-1 py-1 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        {COMPARE_OPS.map((op) => (
          <option key={op} value={op} title={COMPARE_OP_LABELS[op]}>
            {op}
          </option>
        ))}
      </select>
      <div className="flex-1">
        <ExpressionInput
          value={comparison.right}
          nodeOutputs={nodeOutputs}
          parameters={parameters}
          placeholder="18"
          onChange={(right) => onChange({ ...comparison, right })}
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove condition"
        className="px-1 py-1 text-xs text-slate-400 hover:text-rose-500"
      >
        ✕
      </button>
    </div>
  );
}
