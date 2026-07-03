"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BarChart2, Brain, Download, Eye, Globe2, Home, Keyboard, Star, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { exportWorkspaceToZip, importWorkspaceFromZip } from "@/lib/workspace-io";
import { getAllQuestions, useWorkspaceStore } from "@/store/workspace-store";
import { isDue } from "@/lib/spaced-repetition";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/most-viewed", label: "Most Viewed", icon: Eye },
  { href: "/starred", label: "Starred", icon: Star },
  { href: "/review", label: "Review Queue", icon: Brain },
  { href: "/stats", label: "Stats", icon: BarChart2 },
  { href: "/public", label: "Public", icon: Globe2 },
] as const;

export function TopNav({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { categories, setShortcutsOpen } = useWorkspaceStore();
  const importZipInputRef = useRef<HTMLInputElement>(null);
  const [tick, setTick] = useState(0);

  // Re-evaluate due count every minute so the badge stays accurate as time passes
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const dueCount = useMemo(
    () => getAllQuestions(categories).filter((q) => isDue(q.srDue)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, tick]
  );

  return (
    <nav className="shrink-0 flex items-center gap-1 border-b bg-background/95 px-4 backdrop-blur-xl">
      <span className="shrink-0 pr-3 text-sm font-semibold">Developer Knowledge Base</span>
      <div className="h-4 w-px shrink-0 bg-border" />
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        const badge = href === "/review" && dueCount > 0 ? dueCount : null;
        return (
          <button
            key={href}
            type="button"
            onClick={() => router.push(href)}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-2.5 text-sm transition-colors",
              active ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span>{label}</span>
            {badge ? (
              <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {badge}
              </span>
            ) : null}
            {active ? (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t-full bg-primary" />
            ) : null}
          </button>
        );
      })}
      <div className="ml-auto flex items-center gap-1">
        <input
          ref={importZipInputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importWorkspaceFromZip(file);
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => importZipInputRef.current?.click()}
          title="Import from .zip"
          aria-label="Import from zip"
        >
          <Upload className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => void exportWorkspaceToZip(categories)}
          title="Export all as .zip"
          aria-label="Export all as zip"
        >
          <Download className="h-4 w-4" />
        </Button>
        <button
          type="button"
          onClick={() => setShortcutsOpen(true)}
          title="Keyboard shortcuts (?)"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Keyboard shortcuts"
        >
          <Keyboard className="h-4 w-4" />
        </button>
        <UserMenu email={userEmail} />
      </div>
    </nav>
  );
}
