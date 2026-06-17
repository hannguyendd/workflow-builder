import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { loadWorkflow, saveWorkflow } from "@/services/workflow";
import { setWorkflow } from "./workflowSlice";
import { toWorkflowDto } from "./serialize";
import { ThemeToggle } from "@/features/theme/ThemeToggle";

const btn =
  "rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

const btnActive =
  "rounded-lg border border-primary bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors";

interface ToolbarProps {
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  parametersOpen: boolean;
  onToggleParameters: () => void;
}

export function Toolbar({
  inspectorOpen,
  onToggleInspector,
  parametersOpen,
  onToggleParameters,
}: ToolbarProps) {
  const dispatch = useAppDispatch();
  const workflow = useAppSelector((s) => s.workflow);
  const [status, setStatus] = useState("");

  async function handleSave() {
    try {
      await saveWorkflow(toWorkflowDto(workflow));
      setStatus("Saved");
    } catch (err) {
      setStatus(`Save failed: ${(err as Error).message}`);
    }
  }

  async function handleLoad() {
    try {
      const dto = await loadWorkflow();
      if (!dto) {
        setStatus("No saved workflow");
        return;
      }
      dispatch(setWorkflow(dto));
      setStatus("Loaded");
    } catch (err) {
      setStatus(`Load failed: ${(err as Error).message}`);
    }
  }

  return (
    <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
      <span className="mr-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Workflow Builder</span>
      <span className="flex-1" />
      <span className="mr-2 text-xs text-slate-400 dark:text-slate-500">{status}</span>
      <button
        className={parametersOpen ? btnActive : btn}
        onClick={onToggleParameters}
        aria-pressed={parametersOpen}
        title="Toggle parameters panel"
      >
        Parameters
      </button>
      <button
        className={inspectorOpen ? btnActive : btn}
        onClick={onToggleInspector}
        aria-pressed={inspectorOpen}
        title="Toggle inspector panel"
      >
        Inspector
      </button>
      <button className={btn} onClick={handleLoad}>Load</button>
      <button
        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        onClick={handleSave}
      >
        Save
      </button>
      <ThemeToggle />
    </div>
  );
}
