import type { DragEvent } from "react";
import { NODE_DRAG_MIME, PALETTE_ITEMS } from "./nodes/dragData";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

function handleDragStart(e: DragEvent<HTMLDivElement>, type: string) {
  e.dataTransfer.setData(NODE_DRAG_MIME, type);
  e.dataTransfer.effectAllowed = "move";
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  if (collapsed) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center border-r border-slate-200 bg-white py-2 dark:border-slate-800 dark:bg-slate-900">
        <button
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          onClick={onToggle}
          aria-label="Expand node palette"
        >
          ☰
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Nodes
        </span>
        <button
          className="rounded-md px-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          onClick={onToggle}
          aria-label="Collapse node palette"
        >
          ×
        </button>
      </div>
      <div className="flex flex-col gap-2 p-3">
        {PALETTE_ITEMS.map((item) => (
          <div
            key={item.type}
            draggable
            onDragStart={(e) => handleDragStart(e, item.type)}
            className="cursor-grab rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
