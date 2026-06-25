import { NodeType } from "../constants";

/** Mime type carrying a node type through an HTML drag-and-drop. */
export const NODE_DRAG_MIME = "application/workflow-node-type";

/** A node type offered in the sidebar palette. */
export interface PaletteItem {
  type: string;
  label: string;
}

export const PALETTE_ITEMS: PaletteItem[] = [
  { type: NodeType.START, label: "Start" },
  { type: NodeType.IF, label: "If / Condition" },
  { type: NodeType.END, label: "End" },
];
