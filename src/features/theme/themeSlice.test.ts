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
