# Folder structure

Organize `src/` **feature-first**: group code by domain (a workflow feature owns its components, hooks, and slice) rather than by file type. Shared, cross-feature code lives in the top-level folders below. Adapted from the [2025 React folder-structure guide](https://dev.to/pramod_boda/recommended-folder-structure-for-react-2025-48mc) for this project's Bun + Tailwind + Redux + xyflow stack.

```
src/
├── index.ts          # Bun server entry (Bun.serve: API routes + SPA) — stays at src root
├── index.html        # HTML entry, imported by index.ts
├── frontend.tsx      # React client entry (mounts <App> into #root)
├── App.tsx           # Root component
├── router.tsx        # Route definitions (when routing is added)
├── assets/           # Static assets (images, svg, fonts)
├── components/       # Reusable presentational components shared across features
├── features/         # Feature-first modules (each owns components, hooks, slice)
│   └── workflow/     # xyflow canvas, nodes, edges, and its Redux slice
├── hooks/            # Shared custom hooks (cross-feature)
├── layouts/          # Layout shells (Header, Sidebar, etc.)
├── pages/            # Page-level / route components
├── services/         # API clients and external integrations
├── store/            # Redux store config + root reducer; feature slices live in features/
├── styles/           # Global styles (index.css / Tailwind layers)
├── types/            # Shared TypeScript types and interfaces
├── utils/            # Pure helpers and constants
└── config/           # App configuration (env-derived, BUN_PUBLIC_* values)
```

Rules:
- Feature-local code (components, hooks, the Redux slice) lives inside its `features/<name>/` folder. Promote to the shared top-level folders (`components/`, `hooks/`, …) only once used by 2+ features.
- `store/` holds store wiring (`configureStore`, root reducer, typed hooks). Each feature exports its own slice and `store/` combines them.
- Import via the `@/*` alias (e.g. `@/features/workflow`) rather than long relative paths.
- The Bun server (`index.ts`), `index.html`, and `frontend.tsx` are the fixed entry points and stay at the `src/` root.
