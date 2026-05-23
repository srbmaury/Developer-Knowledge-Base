"use client";

import { useEffect } from "react";

export function useHotkeys(combo: string, callback: () => void) {
  useEffect(() => {
    const [modifier, key] = combo.toLowerCase().split("+");
    const handler = (event: KeyboardEvent) => {
      const modifierPressed = modifier === "ctrl" ? event.ctrlKey : event.metaKey;
      if (modifierPressed && event.key.toLowerCase() === key) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [callback, combo]);
}
