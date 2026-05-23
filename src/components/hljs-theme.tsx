"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

export function HighlightJsTheme() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    void (resolvedTheme === "dark"
      ? import("highlight.js/styles/github-dark.css")
      : import("highlight.js/styles/github.css"));
  }, [resolvedTheme]);

  return null;
}
