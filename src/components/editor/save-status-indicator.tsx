import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export function SaveStatusIndicator({ status }: { status: "idle" | "pending" | "saving" | "saved" | "error" }) {
  if (status === "idle") return null;

  const content = {
    pending: { label: "Unsaved changes", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
    saving: { label: "Saving", icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
    saved: { label: "Saved", icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> },
    error: { label: "Save failed", icon: <AlertCircle className="h-3.5 w-3.5 text-destructive" /> }
  }[status];

  return (
    <span className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs text-muted-foreground shadow-sm">
      {content.icon}
      {content.label}
    </span>
  );
}
