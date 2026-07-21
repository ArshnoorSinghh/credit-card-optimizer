"use client";

import { useEffect, type ReactElement } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { cn } from "@/lib/cn";

/*
  BurjSunrise — the signature hero moment: the low golden-hour sun cresting from
  behind the Dubai skyline, the Emirates Towers at its centre. Warm sky wash → a
  blooming sun disc → soft god-rays → a backlit skyline → drifting heat motes.
  The ONE cinematic surface — landing hero + auth pages only, never the working
  screens where it would fight the money math.

  The skyline is built as THREE depth layers — far / mid / near — with
  atmospheric perspective (far = lighter, hazier, higher; near = darker, sharper,
  lower) and mouse parallax (near layers shift more than far), so it reads as a
  real skyline in 3D rather than one flat cut-out. Buildings have varied
  silhouettes — setbacks, antennas, domes, the Burj Al Arab sail, and the twin
  Emirates Towers, which sit in the row at the same height as their neighbours and
  are marked out only by their raked tops.

  Discipline: plays IN once on load then settles. prefers-reduced-motion renders
  the final resting frame with no motion (and no parallax). Decorative backdrop:
  pointer-events-none, aria-hidden.
*/

const EASE = [0.16, 1, 0.3, 1] as const;
const SUN_X = "68%";
const SUN_Y = "36%";

// A building silhouette: base rect + an optional distinctive cap. Coordinates are
// in the 1440×520 viewBox; ground is y=520.
type Cap = "antenna" | "pitch" | "dome" | "step";
type B = { x: number; w: number; top: number; cap?: Cap };

// FAR row — short, hazy, high on the horizon. Reads as distant downtown.
const FAR: B[] = [
  { x: 0, w: 56, top: 404 }, { x: 77, w: 40, top: 384, cap: "antenna" },
  { x: 132, w: 74, top: 410 }, { x: 225, w: 46, top: 390 },
  { x: 289, w: 58, top: 372 }, { x: 369, w: 46, top: 400 },
  { x: 439, w: 70, top: 410 }, { x: 531, w: 42, top: 388 },
  { x: 595, w: 60, top: 398 }, { x: 673, w: 38, top: 402 },
  { x: 735, w: 50, top: 378, cap: "antenna" },
  { x: 803, w: 86, top: 410 }, { x: 901, w: 44, top: 392 },
  { x: 961, w: 44, top: 396 }, { x: 1017, w: 36, top: 384 },
  { x: 1067, w: 54, top: 388 }, { x: 1134, w: 76, top: 410 },
  { x: 1230, w: 46, top: 378 }, { x: 1298, w: 66, top: 400 },
  { x: 1380, w: 60, top: 410 },
];

// MID row — medium height, more character: a pitched pair, a dome, a couple of
// setbacks. (Generic downtown filler — the real Emirates Towers are the NEAR
// centrepiece further along.)
const MID: B[] = [
  { x: 0, w: 50, top: 360 }, { x: 76, w: 64, top: 392 },
  { x: 158, w: 70, top: 376 }, { x: 251, w: 48, top: 352 },
  { x: 321, w: 34, top: 328, cap: "pitch" }, { x: 381, w: 34, top: 336, cap: "pitch" },
  { x: 444, w: 58, top: 384 }, { x: 529, w: 72, top: 392, cap: "step" },
  { x: 628, w: 54, top: 356, cap: "dome" }, { x: 704, w: 60, top: 384 },
  { x: 795, w: 82, top: 392 }, { x: 899, w: 56, top: 374 },
  { x: 969, w: 68, top: 386 }, { x: 1057, w: 42, top: 360, cap: "dome" },
  { x: 1113, w: 60, top: 358 },
  { x: 1190, w: 70, top: 388, cap: "antenna" }, { x: 1276, w: 56, top: 372 },
  { x: 1356, w: 84, top: 392 },
];

// NEAR row — foreground, tallest and darkest. The Emirates Towers + Burj Al Arab
// sail are rendered separately (below); these are the chunky supporting towers.
const NEAR: B[] = [
  { x: 0, w: 78, top: 372, cap: "antenna" }, { x: 91, w: 96, top: 392 },
  { x: 214, w: 70, top: 350, cap: "step" }, { x: 311, w: 62, top: 386 },
  { x: 398, w: 42, top: 368, cap: "step" }, { x: 455, w: 88, top: 384, cap: "step" },
  { x: 562, w: 76, top: 362 }, { x: 663, w: 96, top: 392, cap: "antenna" },
  // 786–906 is the Emirates Towers pair (drawn separately, below)
  { x: 937, w: 58, top: 384 }, { x: 1020, w: 70, top: 396 },
  { x: 1120, w: 32, top: 376, cap: "antenna" },
  // 1168–1214 is the Burj Al Arab sail (drawn separately, below)
  { x: 1243, w: 84, top: 368 }, { x: 1344, w: 96, top: 392 },
];

// ── Emirates Towers ─────────────────────────────────────────────────────────
// The centrepiece: their own buildings, kept out of the FAR/MID/NEAR arrays
// because those are plain rectangles with a cap.
//
// The whole silhouette is four straight lines per tower, which is exactly why
// they work here — the form is genuinely angular, so there's nothing to
// approximate. Each tower is a triangular-plan shaft whose roof is one steeply
// raked plane: the shaft's two edges simply stop at DIFFERENT heights (a low
// "eave" on one side, a high "apex" on the other) and a straight line connects
// them, with a thin mast standing on the apex.
//
// The pair are mirror images, apex to the outside, so the slopes fall inward
// toward the gap between them and the two read as a gateway. Flip `dir` on both
// to rake them the other way.
//
// They carry NO surface detail — no fins, banding or lit windows. Everything here
// is a flat silhouette, and giving one pair of buildings a texture nothing else
// has would break the skyline's visual language. The raked roof does the work.
const GROUND_Y = 520;

type Tower = {
  cx: number; // centre x at the base
  halfW: number; // half-width at the base
  eaveY: number; // where the low side of the raked roof meets the shaft
  apexY: number; // the high corner of the raked roof
  mastY: number; // top of the mast standing on the apex
  dir: 1 | -1; // which side the apex sits on
};

// Heights sit in the NEAR layer's own band — those buildings top out at y=350–392
// and their antennas reach y≈325, so the masts here stop at 322 and 348. The pair
// belongs to the skyline rather than towering over it; their raked tops are what
// distinguishes them, not their scale.
//
// why: the real towers are 354.6 m and 309 m — the shorter is 0.871 of the taller.
// At 198 and 172 units to the mast tips that ratio is 0.869, so shrinking them to
// fit the row keeps their true proportion to each other.
const TOWERS: Tower[] = [
  { cx: 812, halfW: 26, eaveY: 392, apexY: 352, mastY: 322, dir: -1 }, // Emirates Office Tower (taller)
  { cx: 883, halfW: 23, eaveY: 406, apexY: 372, mastY: 348, dir: 1 }, // Jumeirah Emirates Towers Hotel
];

const SHAFT_TAPER = 0.88; // top half-width as a fraction of the base — a subtle lean

// Four points: up one edge, across the raked roof, down the other edge.
function towerPath(t: Tower): string {
  const topHalf = t.halfW * SHAFT_TAPER;
  const leftTopY = t.dir === 1 ? t.eaveY : t.apexY;
  const rightTopY = t.dir === 1 ? t.apexY : t.eaveY;
  return [
    `M ${t.cx - t.halfW} ${GROUND_Y}`,
    `L ${t.cx - topHalf} ${leftTopY}`,
    `L ${t.cx + topHalf} ${rightTopY}`,
    `L ${t.cx + t.halfW} ${GROUND_Y}`,
    "Z",
  ].join(" ");
}

// The mast — one thin rectangle standing on the apex corner, its foot set below
// the apex so it seats in the roof with no seam.
const MAST_W = 3;
function mastRect(t: Tower) {
  const topHalf = t.halfW * SHAFT_TAPER;
  const x = t.cx + t.dir * (topHalf - MAST_W * 1.6);
  return { x: x - MAST_W / 2, y: t.mastY, width: MAST_W, height: t.apexY - t.mastY + 10 };
}

// Both towers: a shaft and a mast each, nothing more. Deliberately as plain as the
// Building() rectangles around them — same flat fill, no surface detail — so what
// sets them apart is purely the raked roofline, not a different visual language.
function EmiratesTowers() {
  return (
    <g fill="url(#towersFill)">
      {TOWERS.map((t, i) => {
        const m = mastRect(t);
        return (
          <g key={i}>
            <path d={towerPath(t)} />
            <rect x={m.x} y={m.y} width={m.width} height={m.height} />
          </g>
        );
      })}
    </g>
  );
}

// Per-layer vertical gradient fills. Warm, backlit brown; far is lightest/haziest
// and near is darkest — atmospheric perspective doing the depth cue.
const GRAD_DEFS: Record<string, ReactElement> = {
  farFill: (
    <linearGradient id="farFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#71512f" stopOpacity="0.44" />
      <stop offset="100%" stopColor="#7a4a1f" stopOpacity="0.34" />
    </linearGradient>
  ),
  midFill: (
    <linearGradient id="midFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#462c15" stopOpacity="0.68" />
      <stop offset="100%" stopColor="#6a3c1a" stopOpacity="0.56" />
    </linearGradient>
  ),
  nearFill: (
    <linearGradient id="nearFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#2a1a0e" stopOpacity="0.96" />
      <stop offset="72%" stopColor="#452a15" stopOpacity="0.9" />
      <stop offset="100%" stopColor="#5a3418" stopOpacity="0.82" />
    </linearGradient>
  ),
  // The centrepiece fill — same construction as nearFill (one warm vertical ramp,
  // darkest at the top) so it stays in the skyline's visual language, with two
  // deliberate differences:
  //
  // 1. gradientUnits="userSpaceOnUse" over the full 0→520 viewBox. The others use
  //    the default objectBoundingBox, which fits the whole ramp to each element's
  //    OWN box — that would make a mast render its base in the ramp's lightest
  //    colour right where it meets the tower's darkest, so the tip would read as a
  //    detached lighter stick. Anchoring to user space makes every piece of the
  //    centrepiece share one continuous shadow, the whole point of a silhouette.
  // 2. A few steps deeper and more opaque throughout. why: the centrepiece sits
  //    directly in front of the sun (both at 68% width), so it's the most backlit
  //    object in the frame and should read as the deepest shadow in it.
  towersFill: (
    <linearGradient id="towersFill" x1="0" y1="0" x2="0" y2="520" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stopColor="#1d1208" stopOpacity="0.98" />
      <stop offset="72%" stopColor="#33200f" stopOpacity="0.95" />
      <stop offset="100%" stopColor="#452710" stopOpacity="0.9" />
    </linearGradient>
  ),
};

// One building: base + optional cap shape.
function Building({ b, fill }: { b: B; fill: string }) {
  const { x, w, top, cap } = b;
  const cx = x + w / 2;
  return (
    <g fill={fill}>
      <rect x={x} y={top} width={w} height={520 - top} />
      {cap === "antenna" && (
        <>
          <rect x={cx - 1.4} y={top - 44} width={2.8} height={44} />
          <circle cx={cx} cy={top - 46} r={2.8} />
        </>
      )}
      {cap === "pitch" && <path d={`M${x} ${top} L${cx} ${top - 30} L${x + w} ${top} Z`} />}
      {cap === "dome" && <path d={`M${x} ${top} A ${w / 2} ${w / 2} 0 0 1 ${x + w} ${top} Z`} />}
      {cap === "step" && <rect x={x + w * 0.22} y={top - 30} width={w * 0.56} height={30} />}
    </g>
  );
}

export function BurjSunrise({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  // Helper: an intro transition that no-ops under reduced motion.
  const intro = (delay: number, duration = 1.4) =>
    reduce ? { duration: 0 } : { duration, delay, ease: EASE };

  // Mouse parallax — normalized cursor (−0.5..0.5), spring-smoothed. Each skyline
  // layer reads a different amount of it, so the depth planes slide apart as the
  // pointer moves. Disabled entirely for reduced motion.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 20, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 60, damping: 20, mass: 0.6 });

  useEffect(() => {
    if (reduce) return;
    const onMove = (e: MouseEvent) => {
      mx.set(e.clientX / window.innerWidth - 0.5);
      my.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [reduce, mx, my]);

  // Per-layer parallax offsets (near moves most). Sky/sun stay put.
  // Vertical parallax is DOWNWARD-ONLY: mouse-up maps to 0 (layers at their
  // natural bottom-anchored rest), so lifting the pointer never raises the
  // buildings and never exposes empty sky beneath their bases.
  const farX = useTransform(sx, [-0.5, 0.5], [-5, 5]);
  const farY = useTransform(sy, [-0.5, 0.5], [0, 6]);
  const midX = useTransform(sx, [-0.5, 0.5], [-11, 11]);
  const midY = useTransform(sy, [-0.5, 0.5], [0, 12]);
  const nearX = useTransform(sx, [-0.5, 0.5], [-20, 20]);
  const nearY = useTransform(sy, [-0.5, 0.5], [0, 20]);

  const layers = [
    { key: "far", buildings: FAR, grad: "farFill", blur: "blur-[2px]", rise: 20, delay: 0.3, px: farX, py: farY },
    { key: "mid", buildings: MID, grad: "midFill", blur: "blur-[0.6px]", rise: 26, delay: 0.42, px: midX, py: midY },
    { key: "near", buildings: NEAR, grad: "nearFill", blur: "", rise: 34, delay: 0.54, px: nearX, py: nearY },
  ] as const;

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

      {/* God-rays — a soft, feathered fan; fans in once then holds. */}
      <motion.div
        className="absolute h-[1200px] w-[1200px]"
        style={{
          left: SUN_X,
          top: SUN_Y,
          x: "-50%",
          y: "-50%",
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

      {/* Lens glare — a white-hot core plus anamorphic streaks, the thing that
          sells "shooting into the sun". Sits BEFORE the skyline in the DOM, so
          the buildings paint over it and the Burj silhouette stays crisp; the
          hero cards are a later sibling of this whole backdrop, so they're
          untouched. Outer element does the one-time fade, inner does the slow
          breathe — keeping them on separate layers means the infinite loop never
          restarts the intro. */}
      <motion.div
        className="absolute inset-0"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={intro(0.75, 2)}
      >
        <motion.div
          className="absolute inset-0"
          animate={reduce ? undefined : { opacity: [0.8, 1, 0.8] }}
          transition={reduce ? undefined : { duration: 9, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* the hot core */}
          <div
            className="absolute h-[220px] w-[220px] rounded-full"
            style={{
              left: SUN_X,
              top: SUN_Y,
              transform: "translate(-50%, -50%)",
              background:
                "radial-gradient(circle, rgba(255,253,246,0.95) 0%, rgba(255,231,180,0.7) 34%, rgba(255,214,140,0.18) 62%, transparent 78%)",
              filter: "blur(5px)",
            }}
          />
          {/* soft wide band — the bloom smearing sideways */}
          <div
            className="absolute h-[46px] w-[1180px]"
            style={{
              left: SUN_X,
              top: SUN_Y,
              transform: "translate(-50%, -50%)",
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,226,170,0.34) 32%, rgba(255,243,214,0.5) 50%, rgba(255,226,170,0.34) 68%, transparent 100%)",
              filter: "blur(24px)",
            }}
          />
          {/* the tight anamorphic streak riding on top of that band */}
          <div
            className="absolute h-[3px] w-[860px]"
            style={{
              left: SUN_X,
              top: SUN_Y,
              transform: "translate(-50%, -50%)",
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,240,205,0.75) 50%, transparent 100%)",
              filter: "blur(4px)",
            }}
          />
          {/* fainter vertical streak — turns the streak into a soft star */}
          <div
            className="absolute h-[420px] w-[3px]"
            style={{
              left: SUN_X,
              top: SUN_Y,
              transform: "translate(-50%, -50%)",
              background:
                "linear-gradient(180deg, transparent 0%, rgba(255,240,205,0.42) 50%, transparent 100%)",
              filter: "blur(4px)",
            }}
          />
        </motion.div>
      </motion.div>

      {/* Horizon haze — warm band that grounds the skyline in light. */}
      <div
        className="absolute inset-x-0 bottom-0 h-2/3"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(246,214,168,0.35) 55%, rgba(244,199,140,0.6) 100%)",
        }}
      />

      {/* Layered skyline — three depth planes with atmospheric perspective + parallax. */}
      <div className="absolute inset-x-0 bottom-0 h-[64%]">
        {layers.map((layer) => (
          <motion.div
            key={layer.key}
            className="absolute inset-0"
            initial={reduce ? false : { opacity: 0, y: layer.rise }}
            animate={{ opacity: 1, y: 0 }}
            transition={intro(layer.delay, 1.5)}
          >
            {/* Inner element carries the mouse parallax so it doesn't fight the
                entrance y-animation on the outer element. */}
            <motion.div
              className="absolute inset-0"
              style={reduce ? undefined : { x: layer.px, y: layer.py }}
            >
              <svg
                className={cn("absolute inset-0 h-full w-full", layer.blur)}
                viewBox="0 0 1440 520"
                // why: slice, not meet. The rows now run the full 0–1440 of the
                // viewBox, but `meet` fits the whole box INSIDE the element — on a
                // wide viewport (1920×~500) that scales to 1385px and leaves ~267px
                // of blank sky at each edge no matter how the buildings are spaced.
                // `slice` covers instead, and YMax anchors the crop to the ground so
                // the overflow comes off the empty top, not the skyline.
                preserveAspectRatio="xMidYMax slice"
              >
                {/* Only this layer's gradient — keeps ids unique across the three
                    SVGs. The near layer also carries the centrepiece shadow fill. */}
                <defs>
                  {GRAD_DEFS[layer.grad]}
                  {layer.key === "near" && GRAD_DEFS.towersFill}
                </defs>

                {layer.buildings.map((b, i) => (
                  <Building key={i} b={b} fill={`url(#${layer.grad})`} />
                ))}

                {/* Near layer also carries the sail + the Emirates Towers. */}
                {layer.key === "near" && (
                  <>
                    {/* Burj Al Arab — the sail, out to the right (x 1168–1214). */}
                    <path
                      d="M1214 520 L1214 300 Q1166 356 1168 520 Z"
                      fill="url(#nearFill)"
                    />
                    {/* Emirates Towers — in the row, not above it. */}
                    <EmiratesTowers />
                  </>
                )}
              </svg>
            </motion.div>
          </motion.div>
        ))}
      </div>

      {/* Heat motes — a few slow, faint embers drifting up through the sun. */}
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
