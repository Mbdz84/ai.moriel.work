"use client";

import { useEffect, useState } from "react";

// Toggles the .dark class on <html> and remembers the choice.
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  // Sync from the DOM after mount (the inline script in layout sets the class
  // pre-hydration). Setting state here is intentional to avoid a hydration
  // mismatch on the icon.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
    setDark(next);
  }

  return (
    <button
      onClick={toggle}
      className="rounded-lg border border-neutral-300 w-8 h-8 flex items-center justify-center text-base hover:bg-neutral-100"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle dark mode"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
