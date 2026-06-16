import { useState } from "react";
import "./index.css";

const brand = [
  { name: "Primary", sub: "violet-600", value: "oklch(54.1% 0.281 293)", swatch: "bg-primary", on: "text-white" },
  { name: "Secondary", sub: "teal-500", value: "oklch(70.4% 0.14 183)", swatch: "bg-secondary", on: "text-slate-900" },
  { name: "Tertiary", sub: "amber-500", value: "oklch(76.9% 0.188 70)", swatch: "bg-tertiary", on: "text-slate-900" },
  { name: "Quaternary", sub: "fuchsia-500", value: "oklch(66.7% 0.295 322)", swatch: "bg-quaternary", on: "text-white" },
];

const status = [
  { name: "Success", sub: "emerald-500", swatch: "bg-success", on: "text-white" },
  { name: "Warning", sub: "amber-500", swatch: "bg-warning", on: "text-slate-900" },
  { name: "Danger", sub: "rose-600", swatch: "bg-danger", on: "text-white" },
];

const STATUS = {
  success: { label: "Success", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", dot: "bg-success" },
  running: { label: "Running", cls: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300", dot: "bg-secondary animate-pulse" },
  review: { label: "Review", cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", dot: "bg-warning" },
  idle: { label: "Idle", cls: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400", dot: "bg-slate-400 dark:bg-slate-500" },
} as const;

const nodes = [
  { category: "Trigger", title: "On webhook", bar: "bg-primary", eyebrow: "text-primary-700 dark:text-primary-500", status: "success" as const },
  { category: "Transform", title: "Map fields", bar: "bg-secondary", eyebrow: "text-teal-700 dark:text-teal-400", status: "running" as const },
  { category: "Branch", title: "If amount > 100", bar: "bg-tertiary", eyebrow: "text-amber-700 dark:text-amber-400", status: "review" as const },
  { category: "Output", title: "Send to Slack", bar: "bg-quaternary", eyebrow: "text-fuchsia-700 dark:text-fuchsia-400", status: "idle" as const },
];

function Swatch({ name, sub, value, swatch, on }: { name: string; sub: string; value?: string; swatch: string; on: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className={`flex h-24 items-end p-3 ${swatch} ${on}`}>
        <span className="text-sm font-semibold">{name}</span>
      </div>
      <div className="px-3 py-2">
        <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{sub}</p>
        {value && <p className="mt-0.5 font-mono text-[11px] text-slate-400 dark:text-slate-500">{value}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: keyof typeof STATUS }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function NodeCard({ node }: { node: (typeof nodes)[number] }) {
  return (
    <div className="relative w-56 shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className={`h-1.5 rounded-t-xl ${node.bar}`} />
      {/* handles, à la xyflow */}
      <span className="absolute top-1/2 -left-1.5 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white bg-slate-300 dark:border-slate-900 dark:bg-slate-600" />
      <span className="absolute top-1/2 -right-1.5 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white bg-slate-300 dark:border-slate-900 dark:bg-slate-600" />
      <div className="p-3">
        <p className={`text-[11px] font-semibold uppercase tracking-wider ${node.eyebrow}`}>{node.category}</p>
        <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{node.title}</p>
        <div className="mt-3">
          <StatusBadge status={node.status} />
        </div>
      </div>
    </div>
  );
}

function Connector() {
  return (
    <div className="hidden shrink-0 items-center sm:flex" aria-hidden>
      <div className="h-px w-8 bg-slate-300 dark:bg-slate-700" />
      <div className="-ml-1 h-2 w-2 rotate-45 border-t border-r border-slate-300 dark:border-slate-700" />
    </div>
  );
}

export function App() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const dark = theme === "dark";

  return (
    <div
      className={`${dark ? "dark" : ""} fixed inset-0 overflow-y-auto bg-slate-50 font-sans text-slate-800 dark:bg-slate-950 dark:text-slate-200`}
    >
      <div className="mx-auto max-w-5xl px-6 py-14">
        <header className="mb-12 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary dark:text-primary-500">
              Workflow Builder · Color System
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50">A violet-led palette</h1>
            <p className="mt-2 max-w-xl text-slate-500 dark:text-slate-400">
              Four brand accents tuned to stay distinct on a busy canvas, plus reserved status colors for node run-states.
            </p>
          </div>
          <button
            onClick={() => setTheme(dark ? "light" : "dark")}
            aria-pressed={dark}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {dark ? "☀ Light" : "☾ Dark"}
          </button>
        </header>

        <section className="mb-12">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Brand</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {brand.map((c) => (
              <Swatch key={c.name} {...c} />
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Primary states</h2>
          <div className="flex flex-wrap items-stretch gap-3">
            {[
              { label: "500 · hover / fills", cls: "bg-primary-500" },
              { label: "600 · base action", cls: "bg-primary-600" },
              { label: "700 · pressed", cls: "bg-primary-700" },
            ].map((s) => (
              <div key={s.label} className={`flex h-16 min-w-36 flex-1 items-end rounded-xl p-3 ${s.cls}`}>
                <span className="font-mono text-xs text-white/90">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Status</h2>
          <div className="grid grid-cols-3 gap-4">
            {status.map((c) => (
              <Swatch key={c.name} {...c} />
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">In context</h2>
          <div
            className="overflow-x-auto rounded-2xl border border-slate-200 p-6 dark:border-slate-800"
            style={{
              backgroundColor: dark ? "#0f172a" : "#f8fafc",
              backgroundImage: `radial-gradient(circle, ${dark ? "#1e293b" : "#cbd5e1"} 1px, transparent 1px)`,
              backgroundSize: "20px 20px",
            }}
          >
            <div className="flex items-center">
              {nodes.map((n, i) => (
                <div key={n.title} className="flex items-center">
                  <NodeCard node={n} />
                  {i < nodes.length - 1 && <Connector />}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Controls</h2>
          <div className="flex flex-wrap items-center gap-3">
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-slate-950">
              Run workflow
            </button>
            <button className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none dark:border-primary-500 dark:text-primary-500">
              Add node
            </button>
            <button className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-slate-900 transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-none">
              Preview
            </button>
            <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              Cancel
            </button>
            <button className="rounded-lg border border-danger px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10 focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-none dark:text-rose-400">
              Delete
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
