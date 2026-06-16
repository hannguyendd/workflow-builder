# Theme + Node Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent dark/light theme toggle (including the xyflow canvas) and a collapsible left sidebar that creates nodes by drag-and-drop, replacing the toolbar's Add buttons.

**Architecture:** A new `theme` Redux slice is the shared source of truth; a `useApplyTheme` hook syncs it to the `<html>.dark` class + `localStorage`, and the canvas reads it for `colorMode`. The sidebar is a controlled palette whose items carry a node type via HTML drag-and-drop; the canvas converts the drop point with xyflow's `screenToFlowPosition` (requires `<ReactFlowProvider>`) and dispatches `addNode`.

**Tech Stack:** Bun, React 19, `@xyflow/react` v12, Redux Toolkit + react-redux v9, Tailwind v4. Tests via `bun:test`. Type check via `bunx tsc --noEmit`.

**Spec:** `docs/superpowers/specs/2026-06-16-theme-and-node-sidebar-design.md`

**Conventions:**
- Import via the `@/*` alias (→ `./src/*`).
- Conventional Commits, scope `theme` or `workflow`.
- End each commit message with the trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: Theme slice — TDD

**Files:**
- Create: `src/features/theme/themeSlice.ts`
- Test: `src/features/theme/themeSlice.test.ts`

- [ ] **Step 1: Write the failing reducer tests**

`src/features/theme/themeSlice.test.ts`:

```ts
import { test, expect } from "bun:test";
import reducer, { setTheme, toggleTheme } from "./themeSlice";

test("toggleTheme flips light to dark and back", () => {
  const dark = reducer({ theme: "light" }, toggleTheme());
  expect(dark.theme).toBe("dark");
  expect(reducer(dark, toggleTheme()).theme).toBe("light");
});

test("setTheme sets the given theme", () => {
  expect(reducer({ theme: "light" }, setTheme("dark")).theme).toBe("dark");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/features/theme/themeSlice.test.ts`
Expected: FAIL — `Cannot find module './themeSlice'`.

- [ ] **Step 3: Implement the slice**

`src/features/theme/themeSlice.ts`:

```ts
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "workflow-builder-theme";

/** Saved theme, else OS preference, else light. Safe in non-browser/test envs. */
export function resolveInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export interface ThemeState {
  theme: Theme;
}

const initialState: ThemeState = { theme: resolveInitialTheme() };

const slice = createSlice({
  name: "theme",
  initialState,
  reducers: {
    toggleTheme(state) {
      state.theme = state.theme === "light" ? "dark" : "light";
    },
    setTheme(state, action: PayloadAction<Theme>) {
      state.theme = action.payload;
    },
  },
});

export const { toggleTheme, setTheme } = slice.actions;
export default slice.reducer;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/features/theme/themeSlice.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Type check**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/theme/themeSlice.ts src/features/theme/themeSlice.test.ts
git commit -m "feat(theme): add theme redux slice with toggle and persistence resolver

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Register theme reducer, apply-theme hook, toggle button

**Files:**
- Modify: `src/store/index.ts` (replace whole file)
- Create: `src/features/theme/useApplyTheme.ts`
- Create: `src/features/theme/ThemeToggle.tsx`

- [ ] **Step 1: Register the theme reducer in the store**

Replace the entire contents of `src/store/index.ts` with:

```ts
import { configureStore } from "@reduxjs/toolkit";
import workflowReducer from "@/features/workflow/workflowSlice";
import themeReducer from "@/features/theme/themeSlice";

export const store = configureStore({
  reducer: {
    workflow: workflowReducer,
    theme: themeReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

- [ ] **Step 2: Create the apply-theme hook**

`src/features/theme/useApplyTheme.ts`:

```ts
import { useEffect } from "react";
import { useAppSelector } from "@/store/hooks";
import { THEME_STORAGE_KEY } from "./themeSlice";

/** Sync the Redux theme to the <html> `dark` class and localStorage. Call once in App. */
export function useApplyTheme(): void {
  const theme = useAppSelector((s) => s.theme.theme);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore storage failures */
    }
  }, [theme]);
}
```

- [ ] **Step 3: Create the toggle button**

`src/features/theme/ThemeToggle.tsx`:

```tsx
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { toggleTheme } from "./themeSlice";

const btn =
  "rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

export function ThemeToggle() {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.theme.theme);
  return (
    <button className={btn} onClick={() => dispatch(toggleTheme())} aria-label="Toggle theme">
      {theme === "dark" ? "☀ Light" : "☾ Dark"}
    </button>
  );
}
```

- [ ] **Step 4: Type check**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/index.ts src/features/theme/useApplyTheme.ts src/features/theme/ThemeToggle.tsx
git commit -m "feat(theme): register theme reducer, add apply-theme hook and toggle

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Wire theme into App and Toolbar

**Files:**
- Modify: `src/App.tsx` (replace whole file)
- Modify: `src/features/workflow/Toolbar.tsx` (replace whole file — removes Add buttons, adds ThemeToggle)

- [ ] **Step 1: Call useApplyTheme inside the Provider**

Replace the entire contents of `src/App.tsx` with (note: `useApplyTheme` uses a selector, so it must run inside a component rendered under `<Provider>`):

```tsx
import { Provider } from "react-redux";
import { store } from "@/store";
import { useApplyTheme } from "@/features/theme/useApplyTheme";
import { WorkflowBuilderPage } from "@/features/workflow";
import "./index.css";

function AppShell() {
  useApplyTheme();
  return <WorkflowBuilderPage />;
}

export function App() {
  return (
    <Provider store={store}>
      <AppShell />
    </Provider>
  );
}

export default App;
```

- [ ] **Step 2: Replace the toolbar (drop Add buttons, add ThemeToggle)**

Replace the entire contents of `src/features/workflow/Toolbar.tsx` with:

```tsx
import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { loadWorkflow, saveWorkflow } from "@/services/workflow";
import { setWorkflow } from "./workflowSlice";
import { toWorkflowDto } from "./serialize";
import { ThemeToggle } from "@/features/theme/ThemeToggle";

const btn =
  "rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

export function Toolbar() {
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
```

- [ ] **Step 3: Type check**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Smoke test the theme**

Run `bun dev`, open the printed URL, click the theme toggle. Expected: the toolbar/page switch between light and dark; reload preserves the choice. Stop the server (Ctrl-C). (The canvas chrome is themed in Task 6.)

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/features/workflow/Toolbar.tsx
git commit -m "feat(theme): apply theme on mount and add toggle to toolbar

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `addNode` accepts an optional position — TDD

**Files:**
- Modify: `src/features/workflow/workflowSlice.ts` (the `addNode` reducer)
- Test: `src/features/workflow/workflowSlice.test.ts` (append two tests)

- [ ] **Step 1: Append the failing position tests**

Append to `src/features/workflow/workflowSlice.test.ts`:

```ts
test("addNode places the node at the given position when provided", () => {
  const next = reducer(empty, addNode({ type: "start", position: { x: 42, y: 99 } }));
  expect(next.nodes[0]!.position).toEqual({ x: 42, y: 99 });
});

test("addNode falls back to the default position when omitted", () => {
  const next = reducer(empty, addNode({ type: "start" }));
  expect(next.nodes[0]!.position).toEqual({ x: 200, y: 200 });
});
```

- [ ] **Step 2: Run the tests to verify the new one fails**

Run: `bun test src/features/workflow/workflowSlice.test.ts`
Expected: FAIL on "addNode places the node at the given position" — the position arg is ignored (node lands at `{200,200}`). (The "default position" test already passes.)

- [ ] **Step 3: Update the `addNode` reducer to honour `position`**

In `src/features/workflow/workflowSlice.ts`, replace the existing `addNode` reducer:

```ts
    addNode(state, action: PayloadAction<{ type: string }>) {
      const { type } = action.payload;
      state.nodes.push({
        id: uniqueId(type, state.nodes),
        type,
        position: { x: 200, y: 200 },
        data: nodeData(type),
      });
    },
```

with:

```ts
    addNode(state, action: PayloadAction<{ type: string; position?: { x: number; y: number } }>) {
      const { type, position } = action.payload;
      state.nodes.push({
        id: uniqueId(type, state.nodes),
        type,
        position: position ?? { x: 200, y: 200 },
        data: nodeData(type),
      });
    },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/features/workflow/workflowSlice.test.ts`
Expected: PASS (6 tests — the original 4 plus the 2 new).

- [ ] **Step 5: Type check**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/workflow/workflowSlice.ts src/features/workflow/workflowSlice.test.ts
git commit -m "feat(workflow): let addNode accept an optional drop position

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Drag metadata + sidebar palette

**Files:**
- Create: `src/features/workflow/nodes/dragData.ts`
- Create: `src/features/workflow/Sidebar.tsx`

- [ ] **Step 1: Create the drag-and-drop metadata**

`src/features/workflow/nodes/dragData.ts`:

```ts
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
```

- [ ] **Step 2: Create the controlled sidebar**

`src/features/workflow/Sidebar.tsx` (collapsed = a `☰` rail; expanded = the draggable palette with a `×`):

```tsx
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
```

- [ ] **Step 3: Type check**

Run: `bunx tsc --noEmit`
Expected: PASS. (`Sidebar` is unused until Task 6 — that is fine; `tsconfig` has `noUnusedLocals: false`.)

- [ ] **Step 4: Commit**

```bash
git add src/features/workflow/nodes/dragData.ts src/features/workflow/Sidebar.tsx
git commit -m "feat(workflow): add draggable node palette sidebar

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Canvas drop target + theming, page layout with sidebar

**Files:**
- Modify: `src/features/workflow/WorkflowCanvas.tsx` (replace whole file)
- Modify: `src/features/workflow/WorkflowBuilderPage.tsx` (replace whole file)

- [ ] **Step 1: Add drop handling + colorMode to the canvas**

Replace the entire contents of `src/features/workflow/WorkflowCanvas.tsx` with:

```tsx
import { useCallback, type DragEvent } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addNode, connected, edgesChanged, nodesChanged } from "./workflowSlice";
import { nodeTypes } from "./nodes/nodeTypes";
import { NODE_DRAG_MIME } from "./nodes/dragData";

export function WorkflowCanvas() {
  const dispatch = useAppDispatch();
  const nodes = useAppSelector((s) => s.workflow.nodes);
  const edges = useAppSelector((s) => s.workflow.edges);
  const theme = useAppSelector((s) => s.theme.theme);
  const { screenToFlowPosition } = useReactFlow();

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const type = e.dataTransfer.getData(NODE_DRAG_MIME);
      if (!type) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      dispatch(addNode({ type, position }));
    },
    [dispatch, screenToFlowPosition],
  );

  return (
    <div className="h-full w-full" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode={theme}
        onNodesChange={(changes: NodeChange[]) => dispatch(nodesChanged(changes))}
        onEdgesChange={(changes: EdgeChange[]) => dispatch(edgesChanged(changes))}
        onConnect={(connection: Connection) => dispatch(connected(connection))}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 2: Wrap the canvas region in ReactFlowProvider and add the sidebar**

Replace the entire contents of `src/features/workflow/WorkflowBuilderPage.tsx` with:

```tsx
import { useEffect, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { useAppDispatch } from "@/store/hooks";
import { loadWorkflow } from "@/services/workflow";
import { setWorkflow } from "./workflowSlice";
import { Toolbar } from "./Toolbar";
import { WorkflowCanvas } from "./WorkflowCanvas";
import { Sidebar } from "./Sidebar";

export function WorkflowBuilderPage() {
  const dispatch = useAppDispatch();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
      <ReactFlowProvider>
        <div className="flex min-h-0 flex-1">
          <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((c) => !c)} />
          <div className="min-w-0 flex-1">
            <WorkflowCanvas />
          </div>
        </div>
      </ReactFlowProvider>
    </div>
  );
}
```

- [ ] **Step 3: Type check**

Run: `bunx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/workflow/WorkflowCanvas.tsx src/features/workflow/WorkflowBuilderPage.tsx
git commit -m "feat(workflow): add sidebar drag-and-drop and theme the canvas

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `bun test`
Expected: PASS (10 tests — serialize ×2, workflow slice ×6, theme slice ×2).

- [ ] **Step 2: Type check + production build**

Run: `bunx tsc --noEmit && bun run build`
Expected: both succeed; `dist/` is emitted with a CSS chunk.

- [ ] **Step 3: Manual smoke test**

Run `bun dev` and open the printed URL. Verify:
1. **Theme:** toggle flips the whole UI including the canvas (Background/Controls/MiniMap); reload keeps the choice; with no saved choice it follows the OS setting.
2. **Sidebar collapse:** click `×` to fully hide the palette (only a `☰` rail remains); click `☰` to reopen.
3. **Drag-and-drop:** drag the **Start** item onto the canvas — a Start node appears where you dropped it. Repeat with **End**.
4. **Connect:** drag from a Start handle to an End handle — an edge appears.
5. **Save/Load:** Save, move a node, Load — it snaps back; status shows "Saved"/"Loaded".

Stop the server (Ctrl-C). If a fix was needed, commit it with a `fix(...)` message.
