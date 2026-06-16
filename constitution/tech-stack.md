# Tech stack

Binding technology decisions. Do not introduce alternatives without updating this file first.

- **Workflow UI: [xyflow](https://reactflow.dev) (React Flow).** Build all node/edge canvas, drag-and-drop, and graph interactions with `@xyflow/react`. Do not hand-roll canvas/SVG graph rendering or pull in a competing flow library.
- **Styling: Tailwind CSS v4.** Style with Tailwind utility classes (already wired via `bun-plugin-tailwind`). Avoid CSS-in-JS libraries and standalone component-style UI kits.
- **State management: Redux.** Use Redux (Redux Toolkit) as the single source of truth for workflow state. Keep workflow graph state in the Redux store; do not scatter shared state across ad-hoc `useState`/context. xyflow node/edge changes flow through Redux actions/reducers.
