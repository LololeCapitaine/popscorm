export default function DashboardLoading() {
  return (
    <main className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <div className="h-[57px] border-b border-black/10 dark:border-white/15" />
      <section className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="h-7 w-40 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        <div className="mt-6 h-32 animate-pulse rounded-xl bg-black/5 dark:bg-white/5" />
        <div className="mt-8 flex flex-col gap-3">
          <div className="h-16 animate-pulse rounded-xl bg-black/5 dark:bg-white/5" />
          <div className="h-16 animate-pulse rounded-xl bg-black/5 dark:bg-white/5" />
        </div>
      </section>
    </main>
  );
}
