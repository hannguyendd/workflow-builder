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
