export default function DashboardLoading() {
  return (
    <div className="flex h-dvh w-full bg-cream font-sans">
      <aside className="w-64 shrink-0 border-r border-cream-200 bg-white/60 p-4">
        <div className="h-6 w-28 animate-pulse rounded bg-cream-200" />
        <div className="mt-6 h-10 animate-pulse rounded-xl bg-cream-200" />
        <div className="mt-6 flex flex-col gap-2">
          <div className="h-9 animate-pulse rounded-lg bg-cream-100" />
          <div className="h-9 animate-pulse rounded-lg bg-cream-100" />
          <div className="h-9 animate-pulse rounded-lg bg-cream-100" />
        </div>
      </aside>
      <main className="flex-1 p-8">
        <div className="mx-auto max-w-5xl">
          <div className="h-8 w-40 animate-pulse rounded bg-cream-200" />
          <div className="mt-6 h-11 animate-pulse rounded-xl bg-cream-100" />
          <div className="mt-6 h-64 animate-pulse rounded-2xl bg-cream-100" />
        </div>
      </main>
    </div>
  );
}
