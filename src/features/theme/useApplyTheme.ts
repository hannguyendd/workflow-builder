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
