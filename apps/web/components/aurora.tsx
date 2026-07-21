/*
  Aurora — a soft, warm "golden hour" wash that sits behind a section to give the
  light canvas gentle depth and sunlight. Pure CSS (blurred radial glows), no JS.
  Deliberately low-opacity and warm (sun/amber/clay), never the old purple glow.
  Drop it as the first child of a `relative` section.

  `subtle` renders a SINGLE, quieter warm blob — for the working screens
  (optimizer, points), where three overlapping glows would muddy the data. The
  cinematic three-blob wash stays on marketing/landing surfaces.
*/

import { cn } from "@/lib/cn";

export function Aurora({ className, subtle = false }: { className?: string; subtle?: boolean }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {/* the sun, warming the top-right — always present */}
      <div className="glow-blob right-[-8%] top-[-18%] h-[460px] w-[460px] bg-sun/50" />
      {!subtle && (
        <>
          <div className="glow-blob left-[-10%] top-[6%] h-[360px] w-[360px] bg-flame/25" />
          <div className="glow-blob bottom-[-16%] left-[28%] h-[380px] w-[380px] bg-clay/20" />
        </>
      )}
    </div>
  );
}
