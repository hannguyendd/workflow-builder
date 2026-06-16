import type { WorkflowDto } from "@/types/workflow";

/** GET the persisted workflow; null when none has been saved yet. */
export async function loadWorkflow(): Promise<WorkflowDto | null> {
  const res = await fetch("/api/workflow");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Load failed: ${res.status}`);
  return (await res.json()) as WorkflowDto;
}

/** PUT the workflow to disk. */
export async function saveWorkflow(dto: WorkflowDto): Promise<void> {
  const res = await fetch("/api/workflow", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });
  if (!res.ok) throw new Error(`Save failed: ${res.status}`);
}
