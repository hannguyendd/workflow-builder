import { useEffect, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { useAppDispatch } from "@/store/hooks";
import { loadWorkflow } from "@/services/workflow";
import { setWorkflow } from "./workflowSlice";
import { Toolbar } from "./Toolbar";
import { WorkflowCanvas } from "./WorkflowCanvas";
import { Sidebar } from "./Sidebar";
import { Inspector, INSPECTOR_DEFAULT_WIDTH } from "./Inspector";

export function WorkflowBuilderPage() {
  const dispatch = useAppDispatch();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorWidth, setInspectorWidth] = useState(INSPECTOR_DEFAULT_WIDTH);

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
      <Toolbar
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((o) => !o)}
      />
      <ReactFlowProvider>
        <div className="flex min-h-0 flex-1">
          <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((c) => !c)} />
          <div className="min-w-0 flex-1">
            <WorkflowCanvas />
          </div>
          {inspectorOpen && (
            <Inspector
              width={inspectorWidth}
              onWidthChange={setInspectorWidth}
              onClose={() => setInspectorOpen(false)}
            />
          )}
        </div>
      </ReactFlowProvider>
    </div>
  );
}
