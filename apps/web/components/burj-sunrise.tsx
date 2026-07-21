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
  behind the Dubai skyline, the Burj Khalifa at its centre. Warm sky wash → a
  blooming sun disc → soft god-rays → a backlit skyline → drifting heat motes.
  The ONE cinematic surface — landing hero + auth pages only, never the working
  screens where it would fight the money math.

  The skyline is built as THREE depth layers — far / mid / near — with
  atmospheric perspective (far = lighter, hazier, higher; near = darker, sharper,
  lower) and mouse parallax (near layers shift more than far), so it reads as a
  real skyline in 3D rather than one flat cut-out. Buildings have varied
  silhouettes — setbacks, antennas, domes, the twin Emirates Towers, the Burj Al
  Arab sail — with the Burj Khalifa as the tallest centrepiece.

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
  { x: 30, w: 56, top: 404 }, { x: 96, w: 40, top: 384, cap: "antenna" },
  { x: 150, w: 74, top: 410 }, { x: 236, w: 46, top: 390 },
  { x: 300, w: 58, top: 372 }, { x: 372, w: 46, top: 400 },
  { x: 436, w: 70, top: 410 }, { x: 520, w: 42, top: 388 },
  { x: 576, w: 60, top: 398 }, { x: 700, w: 50, top: 378, cap: "antenna" },
  { x: 792, w: 86, top: 410 }, { x: 892, w: 44, top: 392 },
  { x: 1060, w: 54, top: 388 }, { x: 1128, w: 76, top: 410 },
  { x: 1220, w: 46, top: 378 }, { x: 1286, w: 66, top: 400 },
  { x: 1364, w: 60, top: 410 },
];

// MID row — medium height, more character: the twin Emirates Towers (pitched),
// a dome, a couple of setbacks.
const MID: B[] = [
  { x: 20, w: 50, top: 360 }, { x: 84, w: 64, top: 392 },
  { x: 158, w: 70, top: 376 }, { x: 240, w: 48, top: 352 },
  { x: 300, w: 34, top: 328, cap: "pitch" }, { x: 342, w: 34, top: 336, cap: "pitch" }, // Emirates Towers
  { x: 414, w: 58, top: 384 }, { x: 486, w: 72, top: 392, cap: "step" },
  { x: 600, w: 54, top: 356, cap: "dome" }, { x: 678, w: 60, top: 384 },
  { x: 770, w: 82, top: 392 }, { x: 1082, w: 60, top: 358 },
  { x: 1160, w: 70, top: 388, cap: "antenna" }, { x: 1250, w: 56, top: 372 },
  { x: 1330, w: 84, top: 392 },
];

// NEAR row — foreground, tallest and darkest. Burj Khalifa + Burj Al Arab sail
// are rendered separately (below); these are the chunky supporting towers.
const NEAR: B[] = [
  { x: 40, w: 78, top: 372, cap: "antenna" }, { x: 138, w: 96, top: 392 },
  { x: 250, w: 70, top: 350, cap: "step" }, { x: 470, w: 88, top: 384, cap: "step" },
  { x: 582, w: 76, top: 362 }, { x: 682, w: 96, top: 392, cap: "antenna" },
  { x: 1240, w: 84, top: 368 }, { x: 1338, w: 96, top: 392 },
];

// Burj Khalifa — centred at x=980. The LEFT and RIGHT edges step in at DIFFERENT
// heights and widths (below), so the setbacks are staggered/asymmetric — the real
// tower's spiralling wings, not a mirrored cutout. A thin antenna rectangle stands
// on top (rendered in JSX) for the tower's signature point.
const BURJ_CX = 980;

// Global width scalar for the tower — the halfwidth tables below stay readable as
// ratios and this one number sets the overall girth. At 1.26 the base spans
// x≈930–1030, still clear of the NEAR tower ending at 778 and the sail at 1160.
const BURJ_W = 1.26;

// The spire. It starts at y=BURJ_SPIRE_TOP and runs down past the body's top
// setback (y≈62) so it seats inside the mass with no seam — so the VISIBLE spire
// is ~36 units against a ~458-unit body, roughly 7% of total height.
const BURJ_SPIRE_TOP = 26;
const BURJ_SPIRE_BOTTOM = 64;
const BURJ_SPIRE_W = 3.2;

// [halfWidth, yTop], bottom → top. Slender, finely tiered (concave taper), with
// the two edges deliberately out of step so the setbacks stagger like the real
// tower's spiralling wings.
// why: the body stops at the last WIDE setback (~y=62) rather than tapering all the
// way to a point — the final ~60px is the spire, drawn as one thin rectangle below,
// which is what actually reads as "the Burj" at a glance.
const BURJ_R: [number, number][] = [
  [40, 520], [37, 470], [34, 430], [30, 388], [27, 352], [23, 314],
  [20, 280], [17, 246], [14, 214], [11.5, 184], [9.5, 156], [7.5, 130],
  [6, 106], [4.5, 84], [3.3, 62],
];
const BURJ_L: [number, number][] = [
  [39, 520], [36, 452], [33, 412], [29, 372], [26, 336], [22.5, 300],
  [19.5, 266], [16.5, 232], [13.5, 202], [11, 172], [9, 146], [7, 120],
  [5.6, 98], [4.2, 76], [3.1, 56],
];

// Points up one edge (bottom → top) with a stepped setback at each level.
function edgePoints(levels: [number, number][], sign: 1 | -1): [number, number][] {
  const cx = BURJ_CX;
  const pts: [number, number][] = [];
  const [hw0, y0] = levels[0]!;
  pts.push([cx + sign * hw0 * BURJ_W, y0]);
  for (let i = 1; i < levels.length; i++) {
    const [hw, y] = levels[i]!;
    const [hwPrev] = levels[i - 1]!;
    pts.push([cx + sign * hwPrev * BURJ_W, y]); // rise at previous width
    pts.push([cx + sign * hw * BURJ_W, y]); // step inward — the setback
  }
  return pts;
}

function buildBurjPath(): string {
  const right = edgePoints(BURJ_R, 1); // bottom → top
  const left = edgePoints(BURJ_L, -1); // bottom → top
  const seg = (p: [number, number][]) => p.map(([x, y]) => `${x} ${y}`).join(" L ");
  // up the right edge, across the flat top, down the left edge, close
  return `M ${seg(right)} L ${seg([...left].reverse())} Z`;
}

const BURJ_PATH = buildBurjPath();

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
  // The Burj's own fill — same construction as nearFill (one warm vertical ramp,
  // darkest at the top) so it stays in the skyline's visual language, with two
  // deliberate differences:
  //
  // 1. gradientUnits="userSpaceOnUse" over the full 0→520 viewBox. The others use
  //    the default objectBoundingBox, which fits the whole ramp to each element's
  //    OWN box — that made the spire render its base in the ramp's lightest colour
  //    right where it meets the tower's darkest, so the tip read as a detached
  //    lighter stick. Anchoring to user space makes body + spire one continuous
  //    shadow, which is the whole point of a silhouette.
  // 2. A few steps deeper and more opaque throughout. why: the tower sits directly
  //    in front of the sun (both at 68% width), so it's the most backlit object in
  //    the frame and should read as the deepest shadow in it.
  burjFill: (
    <linearGradient id="burjFill" x1="0" y1="0" x2="0" y2="520" gradientUnits="userSpaceOnUse">
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
                preserveAspectRatio="xMidYMax meet"
              >
                {/* Only this layer's gradient — keeps ids unique across the three
                    SVGs. The near layer also carries the Burj's shadow fill. */}
                <defs>
                  {GRAD_DEFS[layer.grad]}
                  {layer.key === "near" && GRAD_DEFS.burjFill}
                </defs>

                {layer.buildings.map((b, i) => (
                  <Building key={i} b={b} fill={`url(#${layer.grad})`} />
                ))}

                {/* Near layer also carries the two icons + the Burj centrepiece. */}
                {layer.key === "near" && (
                  <>
                    {/* Burj Al Arab — the sail, to the Burj Khalifa's right. */}
                    <path
                      d="M1206 520 L1206 300 Q1158 356 1160 520 Z"
                      fill="url(#nearFill)"
                    />
                    {/* Burj Khalifa — asymmetric setbacks + a standing antenna
                        mast, read as one unbroken backlit shadow. */}
                    <path d={BURJ_PATH} fill="url(#burjFill)" />
                    {/* the tip — one thin rectangle seated on the last setback */}
                    <rect
                      x={BURJ_CX - BURJ_SPIRE_W / 2}
                      y={BURJ_SPIRE_TOP}
                      width={BURJ_SPIRE_W}
                      height={BURJ_SPIRE_BOTTOM - BURJ_SPIRE_TOP}
                      fill="url(#burjFill)"
                    />
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
