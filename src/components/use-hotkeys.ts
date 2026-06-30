"use client";

import { useEffect, useRef } from "react";

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

function isInputFocused() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = (el as HTMLElement).tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
}

/** g → h/m/s/p style sequential shortcuts. Ignored when an input is focused. */
export function useSequenceHotkey(first: string, second: string, callback: () => void) {
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isInputFocused() || event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key.toLowerCase() === first && !pendingRef.current) {
        pendingRef.current = true;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => { pendingRef.current = false; }, 1000);
        return;
      }

      if (pendingRef.current && event.key.toLowerCase() === second) {
        event.preventDefault();
        pendingRef.current = false;
        if (timerRef.current) clearTimeout(timerRef.current);
        callback();
        return;
      }

      pendingRef.current = false;
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [first, second, callback]);
}
