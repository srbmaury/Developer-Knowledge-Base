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
    <nav className="relative z-40 flex min-h-12 shrink-0 items-center gap-1 border-b bg-background/95 px-2 backdrop-blur-xl sm:px-4">
      <span className="min-w-0 truncate pr-1 text-sm font-semibold sm:pr-3">
        <span className="sm:hidden">DKB</span>
        <span className="hidden sm:inline">Developer Knowledge Base</span>
      </span>
      <div className="hidden h-4 w-px shrink-0 bg-border sm:block" />
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
          className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:h-8 sm:w-8"
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
          <div className="absolute left-0 top-full z-[60] mt-1 min-w-52 rounded-lg border bg-card p-1 shadow-lg">
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
            <div className="mt-1 border-t pt-1 sm:hidden">
              <button
                type="button"
                onClick={() => { importZipInputRef.current?.click(); setMobileNavOpen(false); }}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Upload className="h-4 w-4" /> Import workspace
              </button>
              <button
                type="button"
                onClick={() => { void exportWorkspaceToZip(categories); setMobileNavOpen(false); }}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Download className="h-4 w-4" /> Export workspace
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
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
          className="hidden sm:inline-flex"
          onClick={() => importZipInputRef.current?.click()}
          title="Import from .zip"
        >
          <Upload className="h-4 w-4" />
          <span>Import</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="hidden sm:inline-flex"
          onClick={() => void exportWorkspaceToZip(categories)}
          title="Export all as .zip"
        >
          <Download className="h-4 w-4" />
          <span>Export all</span>
        </Button>
        <button
          type="button"
          onClick={() => setShortcutsOpen(true)}
          title="Keyboard shortcuts (?)"
          className="hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
          aria-label="Keyboard shortcuts"
        >
          <Keyboard className="h-4 w-4" />
        </button>
        <UserMenu email={userEmail} isAdmin={isAdmin} />
      </div>
    </nav>
  );
}
