# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

This is currently the unmodified `bun init` **React + Tailwind v4** template (despite the `workflow-builder` directory name). `package.json` is still named `bun-react-template` and `src/App.tsx` is the default Bun+React splash screen with the `APITester` demo. The actual workflow-builder app has not been built yet — treat `src/` as a starting scaffold.

## Constitution

Binding decisions live in [`constitution/`](constitution/) — **read the relevant file before adding deps, creating folders, or committing.** In short: workflow UI with **xyflow** (`@xyflow/react`), styling with **Tailwind v4**, state with **Redux Toolkit**, and a **feature-first** `src/` layout. See [`constitution/tech-stack.md`](constitution/tech-stack.md) and [`constitution/folder-structure.md`](constitution/folder-structure.md).

## Commands

```bash
bun install        # install dependencies
bun dev            # dev server with HMR + browser-console echo (bun --hot src/index.ts)
bun start          # production server (NODE_ENV=production bun src/index.ts)
bun run build      # bundle all src/**/*.html entrypoints to dist/ (runs build.ts)
bun test           # run tests
bun test <path>    # run a single test file
bun test -t "<name>"  # run tests matching a name
```

There is no separate lint/typecheck script; run `bunx tsc --noEmit` for a type check (`tsconfig.json` is `noEmit` + `strict`).

## Architecture

This is a **Bun-native fullstack app** — one `Bun.serve()` process serves both the JSON API and the React SPA. There is no Vite/webpack/express; Bun's bundler handles everything.

- **`src/index.ts`** — the only server. Defines API routes inline in the `routes` object (e.g. `/api/hello`, `/api/hello/:name`) and a catch-all `/*` that serves `index.html` for the SPA. `development.hmr`/`console` are enabled only when `NODE_ENV !== "production"`.
- **`src/index.html`** — imported *directly* as a module into `index.ts`. Bun bundles its `<script src="./frontend.tsx">` and any CSS/asset imports automatically. This HTML import is the bridge between server and client.
- **`src/frontend.tsx`** — client entrypoint. Mounts `<App>` into `#root`. Note the HMR pattern: `import.meta.hot.data.root ??= createRoot(elem)` preserves the React root across hot reloads instead of remounting.
- **`src/App.tsx` → `src/APITester.tsx`** — UI. `APITester` is a demo form that `fetch`es the `/api/hello` routes; useful as the reference for how the client calls the server.
- **`build.ts`** — production build. Globs `src/**/*.html`, clears `dist/`, and bundles minified with linked sourcemaps for `target: "browser"`. New pages = new `.html` files under `src/`; they're picked up automatically.

**Tailwind v4** is wired in two places that must stay in sync: `bunfig.toml` (`[serve.static].plugins`) for the dev server, and `build.ts` (`plugins: [tailwind]`) for production. Styles are imported via `src/index.css` from `App.tsx`.

Path alias: `@/*` → `./src/*` (see `tsconfig.json`). Client-exposed env vars use the `BUN_PUBLIC_*` prefix.

## Bun conventions (project default — use Bun, not Node tooling)

- `bun <file>` not `node`/`ts-node`; `bun install` not npm/yarn/pnpm; `bunx` not `npx`; `bun test` not jest/vitest; `bun build` not webpack/esbuild.
- Bun auto-loads `.env` — do not add `dotenv`.
- Prefer built-in Bun APIs over npm equivalents: `Bun.serve()` (not express), `bun:sqlite` (not better-sqlite3), `Bun.redis` (not ioredis), `Bun.sql` (not pg/postgres.js), built-in `WebSocket` (not ws), `Bun.file` (not `node:fs` read/write), `` Bun.$`...` `` (not execa).
- Frontend uses HTML imports with `Bun.serve()` — not Vite. `.tsx`/`.css` import directly and Bun bundles them.

Bun API docs are available locally in `node_modules/bun-types/docs/**.mdx`.

## Commit convention

Conventional Commits — **see [`constitution/commit-convention.md`](constitution/commit-convention.md)** for the full type list and rules. Format: `<type>(<scope>): <description>`, imperative present tense, lowercase, no trailing period (e.g. `feat(workflow): add drag-to-connect for nodes`).
