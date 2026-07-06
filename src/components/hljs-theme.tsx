"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

export function HighlightJsTheme() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const href = resolvedTheme === "dark"
      ? "/hljs/github-dark.css"
      : "/hljs/github.css";
    let link = document.getElementById("hljs-theme") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = "hljs-theme";
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [resolvedTheme]);

  return null;
}
