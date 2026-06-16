import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { loadWorkflow } from "@/services/workflow";
import { setWorkflow } from "./workflowSlice";
import { Toolbar } from "./Toolbar";
import { WorkflowCanvas } from "./WorkflowCanvas";

export function WorkflowBuilderPage() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    loadWorkflow()
      .then((dto) => {
        if (dto) dispatch(setWorkflow(dto));
      })
      .catch(() => {
        /* no saved workflow yet — keep the seeded Start/End */
      });
  }, [dispatch]);

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-50 dark:bg-slate-950">
      <Toolbar />
      <div className="min-h-0 flex-1">
        <WorkflowCanvas />
      </div>
    </div>
  );
}
