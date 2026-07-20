import Link from "next/link";
import { cn } from "@/lib/cn";

/* Wordmark — gradient "F" tile + Fils wordmark. Links home. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2.5", className)}>
      <span
        className="grid h-9 w-9 place-items-center rounded-[0.7rem] bg-brand font-display text-lg font-semibold text-white
                   shadow-glow transition-transform group-hover:scale-105"
      >
        F
      </span>
      <span className="text-lg font-semibold tracking-tight text-fg">Fils</span>
    </Link>
  );
}
