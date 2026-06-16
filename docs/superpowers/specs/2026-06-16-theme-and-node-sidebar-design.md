# Dark/Light Mode + Draggable Node Sidebar — Design

Date: 2026-06-16
Status: Approved

## Goal

Two UI features on top of the existing workflow builder:

1. **Theme** — a dark/light toggle that themes the whole app (including the
   xyflow canvas), persists across reloads, and defaults to the OS preference.
2. **Node sidebar** — a collapsible left palette from which node types are
   dragged onto the canvas to create nodes, replacing the toolbar's Add buttons.

## Constraints (project constitution)

- **Workflow UI:** `@xyflow/react`. Use its `colorMode` prop and
  `screenToFlowPosition` (no hand-rolled coordinate math).
- **Styling:** Tailwind v4 utilities; the `.dark` variant is already defined in
  `src/index.css` as `@custom-variant dark (&:where(.dark, .dark *))`.
- **State:** Redux Toolkit. Theme is shared UI state → a dedicated `theme` slice
  (not the workflow slice, and kept out of the persisted workflow JSON).
- **Structure:** feature-first; theme lives in `src/features/theme/`, the sidebar
  in `src/features/workflow/`.

## Feature 1 — Theme (dark/light)

### State
- New slice `src/features/theme/themeSlice.ts`:
  - State: `{ theme: "light" | "dark" }`.
  - `resolveInitialTheme()` pure-ish helper: returns the saved value from
    `localStorage["workflow-builder-theme"]` if present and valid, else
    `window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"`.
    Guarded for non-browser/test environments (returns `"light"` when `window`
    is undefined).
  - Reducers: `toggleTheme` (flip), `setTheme(theme)`.
  - Registered in the store as `theme`.

### Side effects
- `useApplyTheme()` hook (`src/features/theme/useApplyTheme.ts`): reads
  `state.theme.theme`; in a `useEffect`, toggles the `dark` class on
  `document.documentElement` and writes `localStorage["workflow-builder-theme"]`.
  Called once in `App`.

### Toggle UI
- `ThemeToggle` (`src/features/theme/ThemeToggle.tsx`): a button in the toolbar
  showing a sun/moon glyph; dispatches `toggleTheme`.

### Canvas theming
- `WorkflowCanvas` reads `useAppSelector((s) => s.theme.theme)` and passes
  `colorMode={theme}` to `<ReactFlow>` so Background/Controls/MiniMap/edges match.

### Rationale
Two components need the same live theme value (toolbar toggles it, canvas reads
it for `colorMode`). A Redux slice is the shared source of truth without adding a
second React context. Theme is intentionally **not** part of the workflow JSON.

## Feature 2 — Node sidebar (drag-and-drop, collapsible)

### Palette
- `Sidebar` (`src/features/workflow/Sidebar.tsx`): lists the supported node types
  (Start, End). Each row is HTML `draggable`. On `dragStart` it sets
  `dataTransfer` with the node type using a shared mime constant.
- `src/features/workflow/nodes/dragData.ts`: exports
  `NODE_DRAG_MIME = "application/workflow-node-type"` and the palette item list
  (`{ type, label }[]`) so the palette and drop handler agree.

### Drag-and-drop creation
- Palette item `onDragStart`:
  `e.dataTransfer.setData(NODE_DRAG_MIME, type); e.dataTransfer.effectAllowed = "move"`.
- Canvas wrapper `onDragOver`: `e.preventDefault(); e.dataTransfer.dropEffect = "move"`.
- Canvas wrapper `onDrop`: read the type from `dataTransfer`; if present, compute
  the flow position with `screenToFlowPosition({ x: e.clientX, y: e.clientY })`
  and dispatch `addNode({ type, position })`.
- `useReactFlow()` (for `screenToFlowPosition`) requires the canvas to be inside
  `<ReactFlowProvider>`. `WorkflowBuilderPage` wraps the sidebar + canvas region
  in `<ReactFlowProvider>`.

### Collapse / expand
- Collapse state is local `useState` in `WorkflowBuilderPage` (pure view state;
  not shared, not persisted — YAGNI).
- Expanded: the palette panel renders with a `×` collapse control.
- Collapsed: the sidebar is fully hidden; a small `☰` button (rendered in the
  collapsed rail) reopens it. Dragging requires expanding first.

### Toolbar change
- Remove the `Add Start` / `Add End` buttons. Toolbar keeps: title, Save, Load,
  status text, and the `ThemeToggle`.

### Slice change
- `addNode` reducer payload becomes `{ type: string; position?: { x: number; y: number } }`.
  When `position` is omitted it uses the current default `{ x: 200, y: 200 }`
  (keeps existing behaviour/tests); the drop handler supplies a real position.

## Layout

```
WorkflowBuilderPage
└── flex column, h-screen
    ├── Toolbar               (Save · Load · status · ThemeToggle)
    └── ReactFlowProvider
        └── flex row, flex-1 min-h-0
            ├── Sidebar       (collapsed = ☰ rail; expanded = palette panel)
            └── WorkflowCanvas (flex-1; onDragOver/onDrop; colorMode)
```

## Files

```
src/
├── App.tsx                              # call useApplyTheme()
├── store/index.ts                       # register theme reducer
└── features/
    ├── theme/
    │   ├── themeSlice.ts                # state + toggleTheme/setTheme + resolveInitialTheme
    │   ├── useApplyTheme.ts             # sync .dark class + localStorage
    │   ├── ThemeToggle.tsx              # toolbar toggle button
    │   └── themeSlice.test.ts           # reducer tests
    └── workflow/
        ├── nodes/dragData.ts            # NODE_DRAG_MIME + palette item list (NEW)
        ├── Sidebar.tsx                  # draggable palette + collapse control (NEW)
        ├── WorkflowBuilderPage.tsx      # Toolbar + ReactFlowProvider(Sidebar + Canvas)
        ├── WorkflowCanvas.tsx           # + colorMode, onDragOver/onDrop, screenToFlowPosition
        ├── Toolbar.tsx                  # remove Add buttons, add ThemeToggle
        └── workflowSlice.ts             # addNode gains optional position
```

## Error handling

- `onDrop`: if `dataTransfer` has no recognised node type, do nothing (ignore the
  drop) — no node created, no error.
- `resolveInitialTheme`/`useApplyTheme`: guard `window`/`document`/`localStorage`
  access so non-browser contexts don't throw.

## Testing

- `themeSlice.test.ts`: `toggleTheme` flips light↔dark; `setTheme` sets a value.
- `workflowSlice.test.ts`: new test — `addNode` with an explicit `position` places
  the node there; without `position` it falls back to the default.
- Drag-and-drop, collapse, and canvas theming verified via `bunx tsc --noEmit`,
  `bun run build`, and a manual `bun dev` smoke test.

## Out of scope

- Persisting sidebar collapse state.
- Dragging to reorder / a node "trash" drop target.
- Theming beyond the existing palette tokens (no new color system).
- Palette entries for node types beyond Start/End (added when those types are).
