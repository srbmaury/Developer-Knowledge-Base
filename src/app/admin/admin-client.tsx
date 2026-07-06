"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import {
  Search, Trash2, Users, FolderOpen, HelpCircle, BookOpen,
  UserCheck, Activity, Flag, CheckCircle2, Circle
} from "lucide-react";
import { deleteUserAction, resolveIssueAction, deleteIssueAction } from "./actions";
import { Button } from "@/components/ui/button";

type User = {
  id: string;
  email: string;
  verified: boolean;
  createdAt: string;
  lastSignIn: string | null;
  categories: number;
  questions: number;
};

type Issue = {
  id: string;
  userId: string;
  userEmail: string;
  title: string;
  description: string;
  resolved: boolean;
  resolvedAt: Date | null;
  createdAt: Date;
};

type Stats = {
  users: number;
  verified: number;
  active: number;
  categories: number;
  questions: number;
  solutions: number;
  openIssues: number;
};

function StatCard({ label, value, icon: Icon, highlight }: { label: string; value: number; icon: React.ElementType; highlight?: boolean }) {
  return (
    <div className={["rounded-lg border bg-card p-4", highlight && value > 0 ? "border-orange-400/60 bg-orange-50/40 dark:bg-orange-950/20" : ""].join(" ")}>
      <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={["text-2xl font-bold tabular-nums", highlight && value > 0 ? "text-orange-600 dark:text-orange-400" : ""].join(" ")}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function DeleteUserButton({ userId, email, disabled }: { userId: string; email: string; disabled: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirming) { setConfirming(true); return; }
    startTransition(async () => {
      try {
        await deleteUserAction(userId);
        toast.success(`Deleted ${email}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed.");
      }
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <Button size="sm" variant="destructive" onClick={handleClick} disabled={isPending} className="h-7 px-2 text-xs">
          {isPending ? "Deleting…" : "Confirm"}
        </Button>
        <button className="text-xs text-muted-foreground underline" onClick={() => setConfirming(false)}>Cancel</button>
      </span>
    );
  }

  return (
    <Button size="sm" variant="ghost" onClick={handleClick} disabled={disabled || isPending}
      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" title={`Delete ${email}`}>
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

function IssueRow({ issue }: { issue: Issue }) {
  const [resolvePending, startResolve] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={["rounded-lg border p-4 text-sm", issue.resolved ? "opacity-60" : ""].join(" ")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <button
            onClick={() => {
              if (!issue.resolved) {
                startResolve(async () => {
                  try { await resolveIssueAction(issue.id); toast.success("Marked as resolved."); }
                  catch (e) { toast.error(e instanceof Error ? e.message : "Failed."); }
                });
              }
            }}
            title={issue.resolved ? "Resolved" : "Mark as resolved"}
            disabled={issue.resolved || resolvePending}
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-green-600 disabled:cursor-default"
          >
            {issue.resolved
              ? <CheckCircle2 className="h-4 w-4 text-green-500" />
              : <Circle className="h-4 w-4" />
            }
          </button>
          <div className="min-w-0">
            <p className={["font-medium", issue.resolved ? "line-through" : ""].join(" ")}>{issue.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {issue.userEmail} · {new Date(issue.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
              {issue.resolved && issue.resolvedAt && ` · Resolved ${new Date(issue.resolvedAt).toLocaleDateString()}`}
            </p>
            {expanded && (
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{issue.description}</p>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1 text-xs text-primary underline"
            >
              {expanded ? "Hide" : "Show description"}
            </button>
          </div>
        </div>
        <Button
          size="sm" variant="ghost" onClick={() => {
            startDelete(async () => {
              try { await deleteIssueAction(issue.id); toast.success("Issue deleted."); }
              catch (e) { toast.error(e instanceof Error ? e.message : "Failed."); }
            });
          }}
          disabled={deletePending}
          className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
          title="Delete issue"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function AdminClient({
  users, stats, adminEmail, issues,
}: {
  users: User[];
  stats: Stats;
  adminEmail: string;
  issues: Issue[];
}) {
  const [tab, setTab] = useState<"users" | "issues">("users");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return q ? users.filter((u) => u.email.toLowerCase().includes(q)) : users;
  }, [users, search]);

  function fmt(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-semibold">Admin</h1>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <StatCard label="Users" value={stats.users} icon={Users} />
        <StatCard label="Verified" value={stats.verified} icon={UserCheck} />
        <StatCard label="Active" value={stats.active} icon={Activity} />
        <StatCard label="Categories" value={stats.categories} icon={FolderOpen} />
        <StatCard label="Questions" value={stats.questions} icon={HelpCircle} />
        <StatCard label="Solutions" value={stats.solutions} icon={BookOpen} />
        <StatCard label="Open Issues" value={stats.openIssues} icon={Flag} highlight />
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b">
        {(["users", "issues"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "px-4 py-2 text-sm font-medium transition-colors capitalize",
              tab === t
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {t}
            {t === "issues" && stats.openIssues > 0 && (
              <span className="ml-1.5 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {stats.openIssues}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {tab === "users" && (
        <>
          <div className="mb-4 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="Filter by email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <p className="text-sm text-muted-foreground">{filtered.length} of {users.length} users</p>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Verified</th>
                  <th className="px-4 py-3 hidden md:table-cell">Joined</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Last sign-in</th>
                  <th className="px-4 py-3 text-right">Categories</th>
                  <th className="px-4 py-3 text-right">Questions</th>
                  <th className="px-4 py-3 hidden lg:table-cell font-mono">User ID</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((user) => {
                  const isAdmin = user.email === adminEmail;
                  return (
                    <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        {user.email}
                        {isAdmin && (
                          <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">you</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={user.verified ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
                          {user.verified ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{fmt(user.createdAt)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{fmt(user.lastSignIn)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{user.categories}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{user.questions}</td>
                      <td className="px-4 py-3 hidden lg:table-cell font-mono text-xs text-muted-foreground">{user.id.slice(0, 8)}…</td>
                      <td className="px-4 py-3 text-right">
                        <DeleteUserButton userId={user.id} email={user.email} disabled={isAdmin} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {search ? "No users match that filter." : "No users yet."}
              </p>
            )}
          </div>
        </>
      )}

      {/* Issues tab */}
      {tab === "issues" && (
        <div className="flex flex-col gap-3">
          {issues.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No issues reported.</p>
          ) : (
            issues.map((issue) => <IssueRow key={issue.id} issue={issue} />)
          )}
        </div>
      )}
    </div>
  );
}
