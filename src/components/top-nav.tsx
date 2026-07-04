"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BarChart2, Brain, Download, Eye, Globe2, Home, Keyboard, Menu, Star, Upload } from "lucide-react";
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

export function TopNav({ userEmail, isAdmin = false }: { userEmail: string | null; isAdmin?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { categories, setShortcutsOpen } = useWorkspaceStore();
  const importZipInputRef = useRef<HTMLInputElement>(null);
  const [tick, setTick] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileNavRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const handler = (e: MouseEvent) => {
      if (mobileNavRef.current && !mobileNavRef.current.contains(e.target as Node)) setMobileNavOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileNavOpen]);

  useEffect(() => { setMobileNavOpen(false); }, [pathname]);

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
      <div className="hidden items-center gap-1 xl:flex">
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
      </div>
      <div ref={mobileNavRef} className="relative xl:hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen((open) => !open)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Open navigation menu"
          title="Navigation"
        >
          <Menu className="h-4 w-4" />
          {dueCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
              {dueCount}
            </span>
          ) : null}
        </button>
        {mobileNavOpen ? (
          <div className="absolute left-0 top-full z-50 mt-1 min-w-52 rounded-lg border bg-card p-1 shadow-lg">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              const badge = href === "/review" && dueCount > 0 ? dueCount : null;
              return (
                <button
                  key={href}
                  type="button"
                  onClick={() => router.push(href)}
                  className={cn(
                    "flex w-full items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted",
                    active ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                  {badge ? (
                    <span className="ml-auto flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="ml-auto flex items-center gap-1">
        <input
          ref={importZipInputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importWorkspaceFromZip(file, () => router.refresh());
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="ghost"
          onClick={() => importZipInputRef.current?.click()}
          title="Import from .zip"
          aria-label="Import from zip"
        >
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Import</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => void exportWorkspaceToZip(categories)}
          title="Export all as .zip"
          aria-label="Export all as zip"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export all</span>
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
        <UserMenu email={userEmail} isAdmin={isAdmin} />
      </div>
    </nav>
  );
}
