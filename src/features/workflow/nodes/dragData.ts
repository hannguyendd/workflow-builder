/** Mime type carrying a node type through an HTML drag-and-drop. */
export const NODE_DRAG_MIME = "application/workflow-node-type";

/** A node type offered in the sidebar palette. */
export interface PaletteItem {
  type: string;
  label: string;
}

export const PALETTE_ITEMS: PaletteItem[] = [
  { type: "start", label: "Start" },
  { type: "end", label: "End" },
];
