"use client";

import { useEffect, useState } from "react";

type Theme = "day" | "night";

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("night");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("safariboyz-theme") as Theme | null;
    const resolvedTheme = savedTheme === "day" ? "day" : "night";
    setTheme(resolvedTheme);
    document.documentElement.dataset.theme = resolvedTheme;
  }, []);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "night" ? "day" : "night";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("safariboyz-theme", nextTheme);
  };

  return (
    <button
      type="button"
      className={compact ? "theme-toggle theme-toggle-compact" : "theme-toggle"}
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "night" ? "day" : "night"} mode`}
      title={`Switch to ${theme === "night" ? "day" : "night"} mode`}
    >
      <span aria-hidden="true">{theme === "night" ? "☀" : "☾"}</span>
      {!compact && <span>{theme === "night" ? "Day mode" : "Night mode"}</span>}
    </button>
  );
}
