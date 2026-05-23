function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export default function Loading() {
  return (
    <main className="flex h-screen overflow-hidden bg-background/85 text-foreground">
      <aside className="hidden h-full w-72 shrink-0 flex-col border-r bg-card/80 md:flex">
        <div className="flex h-14 items-center gap-3 border-b px-4">
          <SkeletonBlock className="h-8 w-8" />
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBlock className="h-3 w-40" />
            <SkeletonBlock className="h-2.5 w-28" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1 border-b p-3">
          <SkeletonBlock className="h-8" />
          <SkeletonBlock className="h-8" />
        </div>
        <div className="flex-1 space-y-2 p-3">
          <SkeletonBlock className="h-3 w-24" />
          {Array.from({ length: 10 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-8" />
          ))}
        </div>
        <div className="space-y-2 border-t p-3">
          <SkeletonBlock className="h-9" />
          <SkeletonBlock className="h-9" />
        </div>
      </aside>

      <section className="hidden h-full w-80 shrink-0 border-r bg-background/70 lg:flex lg:flex-col">
        <div className="space-y-2 border-b p-4">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-3 w-44" />
        </div>
        <div className="space-y-3 p-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="space-y-3 rounded-lg border bg-card p-3">
              <SkeletonBlock className="h-4 w-48" />
              <SkeletonBlock className="h-3 w-full" />
              <SkeletonBlock className="h-5 w-16" />
            </div>
          ))}
        </div>
      </section>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b bg-background/85 px-5">
          <SkeletonBlock className="h-9 w-9" />
          <SkeletonBlock className="h-9 flex-1" />
          <SkeletonBlock className="h-9 w-28" />
        </header>
        <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-8">
          <div className="space-y-3 border-b pb-5">
            <SkeletonBlock className="h-10 w-2/3" />
            <SkeletonBlock className="h-4 w-1/2" />
          </div>
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-9 w-56" />
            <SkeletonBlock className="h-9 w-64" />
          </div>
          <div className="min-h-[min(560px,55vh)] rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <SkeletonBlock className="h-4 w-40" />
              <SkeletonBlock className="h-8 w-36" />
            </div>
            <div className="space-y-3 p-4">
              {Array.from({ length: 9 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-4 w-full" />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
