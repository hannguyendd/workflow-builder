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
