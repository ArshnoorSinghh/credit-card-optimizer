import { cn } from "@/lib/cn";

/*
  Skeleton — a warm shimmer placeholder for content that is loading. Uses the sand
  surface token and a gentle pulse (killed automatically under prefers-reduced-motion
  by globals.css). Compose several to mirror the shape of the real content.
*/
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-[var(--radius-md)] bg-surface-2", className)}
      aria-hidden="true"
    />
  );
}
