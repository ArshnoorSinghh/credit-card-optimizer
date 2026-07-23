import { Skeleton } from "@/components/ui/skeleton";

/*
  Global route-transition fallback. Shown while a navigated segment streams in, so
  moving between pages reveals a calm branded placeholder rather than a blank frame.
  A generic header + card grid that reads as "content on the way" on any route.
*/
export default function Loading() {
  return (
    <main className="relative mx-auto min-h-[calc(100vh-4rem)] max-w-6xl px-5 py-12">
      <Skeleton className="h-6 w-32 rounded-full" />
      <Skeleton className="mt-5 h-11 w-2/3 max-w-lg" />
      <Skeleton className="mt-3 h-5 w-1/2 max-w-md" />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-52 rounded-[var(--radius-lg)]" />
        ))}
      </div>
    </main>
  );
}
