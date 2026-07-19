/*
  Aurora — static gradient "blobs" that sit behind a section to give the dark
  canvas depth and colour. Pure CSS (blurred radial glows), no JS. Drop it as the
  first child of a `relative` section.
*/

import { cn } from "@/lib/cn";

export function Aurora({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="glow-blob left-[-10%] top-[-20%] h-[420px] w-[420px] bg-violet/40" />
      <div className="glow-blob right-[-5%] top-[10%] h-[360px] w-[360px] bg-sky/30" />
      <div className="glow-blob bottom-[-15%] left-[30%] h-[380px] w-[380px] bg-indigo/30" />
    </div>
  );
}
