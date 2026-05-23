import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <main className="flex h-screen items-center justify-center bg-background text-foreground">
      <div className="flex items-center gap-2 rounded-md border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading
      </div>
    </main>
  );
}
