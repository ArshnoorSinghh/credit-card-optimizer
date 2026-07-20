"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

/*
  BurjSunrise — the signature "$10k" hero moment: the low golden-hour sun cresting
  from behind the Dubai skyline, the Burj Khalifa at its centre. Warm sky wash →
  a blooming sun disc → soft god-rays → a backlit warm silhouette → drifting heat
  motes. This is the ONE cinematic surface — it lives on the landing hero and the
  auth pages, never on the working optimizer/results screens where it would
  distract from the money math.

  Discipline: it plays IN once on load (~2.4s) then settles to a calm, barely
  breathing state. prefers-reduced-motion renders the final resting frame with no
  motion at all. It's a backdrop — pointer-events-none, decorative, aria-hidden.

  The skyline is composed from a small array of rectangles (below) rather than
  hand-authored path data, so it stays compact and easy to tune.
*/

const EASE = [0.16, 1, 0.3, 1] as const;
const SUN_X = "68%";
const SUN_Y = "36%";

// Burj Khalifa — stacked setbacks, centred at x=980 in the 1440-wide viewBox.
// [x, width, topY]; the tower tapers as it climbs, then a thin spire.
const BURJ: [number, number, number][] = [
  [936, 88, 322],
  [946, 68, 246],
  [954, 52, 184],
  [961, 38, 132],
  [966, 28, 92],
  [971, 18, 64],
];

// Supporting skyline — [x, width, topY]. A hazy back row for depth; the Burj
// reads as the hero because everything else stays low and simple.
const SKYLINE: [number, number, number][] = [
  [40, 70, 430], [120, 46, 400], [176, 90, 452], [276, 40, 410],
  [326, 64, 440], [400, 52, 416], [462, 80, 452], [552, 44, 424],
  [606, 72, 446], [688, 50, 408], [748, 96, 452], [852, 46, 430],
  [1064, 60, 424], [1134, 84, 452], [1228, 44, 410], [1282, 70, 440],
  [1362, 58, 452],
];

export function BurjSunrise({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  // Helper: an intro transition that no-ops under reduced motion (the element
  // just renders in its final state).
  const intro = (delay: number, duration = 1.4) =>
    reduce ? { duration: 0 } : { duration, delay, ease: EASE };

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      {/* Sky wash — eggshell at the top, warm amber pooling at the horizon. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, var(--color-bg) 0%, #f8ecd6 46%, #f6dcab 72%, #f3cd8e 100%)",
        }}
      />

      {/* Sun disc — blooms up from behind the tower. */}
      <motion.div
        className="absolute h-[560px] w-[560px] rounded-full"
        style={{
          left: SUN_X,
          top: SUN_Y,
          x: "-50%",
          y: "-50%",
          background:
            "radial-gradient(circle, rgba(255,244,222,0.95) 0%, rgba(248,178,75,0.85) 24%, rgba(232,111,44,0.32) 46%, transparent 70%)",
        }}
        initial={reduce ? false : { opacity: 0, scale: 0.82, y: "-38%" }}
        animate={{ opacity: 1, scale: 1, y: "-50%" }}
        transition={intro(0.15, 1.8)}
      />

      {/* God-rays — a soft fan of light. The stops are FEATHERED (each ray ramps
          up and back down rather than a hard 2° stripe), and a small blur kills
          the conic-gradient aliasing/moiré. It fans in ONCE during the intro then
          holds perfectly still — no forever-rotation, which would fight the calm
          of a settled scene. The sun disc and motes carry the living motion. */}
      <motion.div
        className="absolute h-[1200px] w-[1200px]"
        style={{
          left: SUN_X,
          top: SUN_Y,
          x: "-50%",
          y: "-50%",
          // 16° period: transparent → soft amber peak at 4° → transparent by 8° →
          // gap to 16°. Feathered edges instead of a hard-cut stripe.
          background:
            "repeating-conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(244,166,58,0.12) 4deg, transparent 8deg, transparent 16deg)",
          filter: "blur(2px)",
          WebkitMaskImage:
            "radial-gradient(circle at 50% 50%, transparent 9%, #000 22%, transparent 62%)",
          maskImage:
            "radial-gradient(circle at 50% 50%, transparent 9%, #000 22%, transparent 62%)",
        }}
        initial={reduce ? false : { opacity: 0, rotate: -6 }}
        animate={{ opacity: 0.7, rotate: 0 }}
        transition={intro(0.5, 2.2)}
      />

      {/* Horizon haze — warm band that grounds the skyline in light. */}
      <div
        className="absolute inset-x-0 bottom-0 h-2/3"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(246,214,168,0.35) 55%, rgba(244,199,140,0.6) 100%)",
        }}
      />

      {/* Skyline silhouette — backlit warm brown, slight rise on entrance. */}
      <motion.svg
        className="absolute inset-x-0 bottom-0 h-[62%] w-full"
        viewBox="0 0 1440 520"
        preserveAspectRatio="xMidYMax slice"
        initial={reduce ? false : { opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={intro(0.35, 1.5)}
      >
        <defs>
          <linearGradient id="burjFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2e1d10" stopOpacity="0.94" />
            <stop offset="70%" stopColor="#4a3016" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#7a4a1f" stopOpacity="0.82" />
          </linearGradient>
          <linearGradient id="skyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5a3a1c" stopOpacity="0.62" />
            <stop offset="100%" stopColor="#7a4a1f" stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {/* hazy back row */}
        {SKYLINE.map(([x, w, top], i) => (
          <rect key={i} x={x} y={top} width={w} height={520 - top} fill="url(#skyFill)" />
        ))}

        {/* the Burj */}
        {BURJ.map(([x, w, top], i) => (
          <rect key={`b${i}`} x={x} y={top} width={w} height={520 - top} fill="url(#burjFill)" />
        ))}
        {/* spire */}
        <path d="M978 64 L980 18 L982 64 Z" fill="url(#burjFill)" />
        <rect x={979} y={18} width={2} height={46} fill="#2e1d10" fillOpacity="0.94" />
      </motion.svg>

      {/* Heat motes — a few slow, faint embers of light drifting up through the
          sun. Motion only; hidden entirely for reduced-motion users. */}
      {!reduce &&
        MOTES.map((m, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full bg-sun"
            style={{ left: m.left, top: m.top, height: m.size, width: m.size, filter: "blur(1px)" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: [0, 0.5, 0], y: -70 }}
            transition={{ duration: m.dur, delay: m.delay, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
    </div>
  );
}

const MOTES = [
  { left: "58%", top: "52%", size: 5, dur: 11, delay: 0.6 },
  { left: "64%", top: "60%", size: 4, dur: 13, delay: 2.4 },
  { left: "71%", top: "50%", size: 6, dur: 10, delay: 1.4 },
  { left: "76%", top: "58%", size: 4, dur: 14, delay: 3.1 },
  { left: "67%", top: "46%", size: 3, dur: 12, delay: 4.0 },
];
