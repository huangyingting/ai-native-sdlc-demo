"use client";

import { MoonIcon, SunIcon } from "./icons";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
  function toggleTheme() {
    const nextTheme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("northstar-theme", nextTheme);
  }

  return (
    <button
      aria-label="Toggle color theme"
      className="icon-button theme-toggle"
      onClick={toggleTheme}
      title="Toggle color theme"
      type="button"
    >
      <span className="theme-icon theme-icon-light"><SunIcon /></span>
      <span className="theme-icon theme-icon-dark"><MoonIcon /></span>
    </button>
  );
}
