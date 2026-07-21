"use client";

import { useRef, useState, type ComponentType } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  useReducedMotion,
  type TargetAndTransition,
  type Transition,
} from "framer-motion";
import { Badge } from "@/components/ui/badge";

/*
  StickySteps — the "how it works" pinned scroll sequence. The left rail advances
  through the three steps; the right "stage" plays a deck-of-cards story:

    step 1 → the deck RIFFLE-SHUFFLES sideways.
    step 2 → the deck stands upright and SHAKES, with comic exaggeration lines.
    step 3 → the other cards are BLOWN AWAY; the survivor FLIPS in place (still
             vertical) to reveal a credit card (a regular landscape card, rotated).

  Each card is built as separate layers — POSITION (smoothly transitioned between
  states) and a local SHAKE jitter — so scrubbing the scroll backwards replays
  cleanly instead of teleporting (the shake never drives the card's position).
  Reduced-motion renders the resolved vertical credit card statically.
*/

const EASE = [0.16, 1, 0.3, 1] as const;

type Step = { icon: ComponentType<{ className?: string }>; title: string; body: string };

const PW = 140; // portrait card footprint (deck card + the vertical credit card)
const PH = 196;

const N = 8; // cards in the deck
const HERO = 3; // the card that survives and is revealed

// The squared-up deck (step 2): a neat fanned stack. This is also the riffle's
// rest pose, so steps 1 and 2 share one anchor.
const stackOffset = (i: number) => (i - (N - 1) / 2) * 1.8;
const REST_SCALE = 0.98;
const REST_OPACITY = 0.95;

const squared = (i: number): TargetAndTransition => {
  const o = stackOffset(i);
  return { x: o, y: o, rotate: 0, scale: REST_SCALE, opacity: REST_OPACITY };
};

// why: `hold` keeps a constant value as a 4-entry keyframe list so every animated
// value matches the 4-entry `times` below — a scalar would get the keyframe
// timeline applied to a 2-point tween.
const hold = (v: number) => [v, v, v, v];

// STEP 1 — one deck card's looping SIDEWAYS riffle.
// why: every keyframe is offset from the card's RESTING position, and scale/opacity
// are held at the step-2 values. Framer restarts a repeating keyframe array at
// index 0, so if the loop started at a bare x:0/scale:1 the deck would teleport
// the moment you scrubbed BACK into step 1. Anchored this way, keyframe[0] ===
// keyframe[last] === the step-2 pose, so entering and leaving the loop is
// continuous in either scroll direction.
function riffle(i: number): TargetAndTransition {
  const half = i < N / 2 ? -1 : 1;
  const o = stackOffset(i);
  return {
    x: [o, o + half * 66, o + half * 18, o],
    y: [o, o - 3, o + 2, o],
    rotate: [0, half * 4, half * 1, 0],
    scale: hold(REST_SCALE),
    opacity: hold(REST_OPACITY),
  };
}
const riffleTransition = (i: number): Transition => ({
  duration: 1.6,
  times: [0, 0.35, 0.7, 1],
  repeat: Infinity,
  ease: "easeInOut",
  delay: (i % (N / 2)) * 0.08,
});

// STEP 3 — the also-rans get blown off-screen.
function blownAway(i: number): TargetAndTransition {
  const dir = i < HERO ? -1 : 1;
  const dist = 320 + Math.abs(i - HERO) * 46;
  return { x: dir * dist, y: ((i * 53) % 150) - 95, rotate: dir * (55 + (i % 3) * 30), scale: 0.8, opacity: 0 };
}
const blowTransition = (i: number): Transition => ({ duration: 0.55, ease: "easeIn", delay: Math.abs(i - HERO) * 0.05 });

// Local shake jitter — tiny, and independent of a card's position layer.
const shakeAnim: TargetAndTransition = { x: [-3, 3], rotate: [-2, 2] };
const shakeTransition: Transition = { duration: 0.1, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" };
const restAnim: TargetAndTransition = { x: 0, rotate: 0 };

export function StickySteps({ steps }: { steps: Step[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActive(Math.min(steps.length - 1, Math.floor(v * steps.length)));
  });

  const railScale = useTransform(scrollYProgress, [0, 1], [0.03, 1]);
  const nodeTop = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section ref={ref} className="relative" style={{ height: `${steps.length * 100}vh` }}>
      <div className="sticky top-0 flex min-h-screen items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-2">
          {/* LEFT — the steps */}
          <div>
            <Badge tone="brand">How it works</Badge>
            <h2 className="mt-5 text-3xl font-semibold md:text-4xl">
              From guesswork to your best wallet
            </h2>

            <div className="mt-10 flex gap-5">
              <div className="relative w-px shrink-0 bg-line">
                <motion.div
                  style={{ scaleY: reduce ? 1 : railScale }}
                  className="absolute inset-0 origin-top bg-brand"
                />
                {!reduce && (
                  <motion.span
                    style={{ top: nodeTop }}
                    className="absolute -left-[3.5px] h-2 w-2 -translate-y-1/2 rounded-full bg-flame shadow-glow"
                  />
                )}
              </div>

              <div className="flex flex-col gap-8">
                {steps.map((step, i) => {
                  const on = i === active;
                  return (
                    <motion.div
                      key={step.title}
                      animate={{ opacity: on ? 1 : 0.35, x: on ? 0 : -4 }}
                      transition={{ duration: 0.4, ease: EASE }}
                      className="flex gap-4"
                    >
                      <motion.span
                        animate={{ scale: on ? 1 : 0.9 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className={
                          "grid h-11 w-11 shrink-0 place-items-center rounded-[0.8rem] transition-colors " +
                          (on ? "bg-brand text-white shadow-glow" : "border border-line bg-surface-2 text-faint")
                        }
                      >
                        <step.icon className="h-5 w-5" />
                      </motion.span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-clay">
                          Step {String(i + 1).padStart(2, "0")}
                        </p>
                        <h3 className="mt-1 text-xl font-semibold">{step.title}</h3>
                        <p className="mt-2 text-muted">{step.body}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT — shuffle → shake → your card */}
          <div className="relative hidden md:block">
            <Stage active={active} reduce={!!reduce} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stage({ active, reduce }: { active: number; reduce: boolean }) {
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface shadow-card">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(244,166,58,0.12),transparent_60%)]" />

      {/* perspective root → deck tilts on the "table" while shuffling, then upright */}
      <div className="absolute inset-0" style={{ perspective: 1100 }}>
        <div className="absolute inset-0" style={{ transformStyle: "preserve-3d", transform: "translateY(-8px)" }}>
          <motion.div
            className="absolute inset-0"
            style={{ transformStyle: "preserve-3d" }}
            animate={{ rotateX: active === 0 && !reduce ? 26 : 0 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            {Array.from({ length: N }).map((_, i) =>
              i === HERO ? (
                <HeroCard key="hero" active={active} reduce={reduce} />
              ) : (
                <DeckCard key={i} i={i} active={active} reduce={reduce} />
              ),
            )}
          </motion.div>
        </div>
      </div>

      <ShakeLines show={active === 1 && !reduce} />
      <Caption show={active >= 2} />
    </div>
  );
}

// Resolve a card's POSITION layer (never driven by the shake — keeps reverse clean).
function cardPosition(i: number, active: number, reduce: boolean): { animate: TargetAndTransition; transition: Transition } {
  if (active >= 2) return { animate: blownAway(i), transition: reduce ? { duration: 0 } : blowTransition(i) };
  if (active === 0 && !reduce) return { animate: riffle(i), transition: riffleTransition(i) };
  return { animate: squared(i), transition: { duration: 0.5, ease: EASE } };
}

function DeckCard({ i, active, reduce }: { i: number; active: number; reduce: boolean }) {
  const { animate, transition } = cardPosition(i, active, reduce);
  const shaking = active === 1 && !reduce;
  return (
    <motion.div
      className="absolute left-1/2 top-1/2"
      style={{ translate: "-50% -50%", width: PW, height: PH, zIndex: i }}
      animate={animate}
      transition={transition}
    >
      <motion.div
        className="h-full w-full"
        animate={shaking ? shakeAnim : restAnim}
        transition={shaking ? shakeTransition : { duration: 0.2 }}
      >
        <CardBack />
      </motion.div>
    </motion.div>
  );
}

function HeroCard({ active, reduce }: { active: number; reduce: boolean }) {
  const pos: TargetAndTransition =
    active >= 2
      ? { x: 0, y: 0, rotate: 0, scale: 1.12, opacity: 1 }
      : active === 0 && !reduce
        ? riffle(HERO)
        : squared(HERO);
  const posT: Transition =
    active >= 2
      ? reduce
        ? { duration: 0 }
        : { duration: 0.55, ease: EASE }
      : active === 0 && !reduce
        ? riffleTransition(HERO)
        : { duration: 0.5, ease: EASE };

  const shaking = active === 1 && !reduce;
  const flipped = active >= 2;

  return (
    <motion.div
      className="absolute left-1/2 top-1/2"
      style={{ translate: "-50% -50%", width: PW, height: PH, zIndex: 30, transformStyle: "preserve-3d" }}
      animate={pos}
      transition={posT}
    >
      {/* shake layer (local jitter only) */}
      <motion.div
        className="h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={shaking ? shakeAnim : restAnim}
        transition={shaking ? shakeTransition : { duration: 0.2 }}
      >
        {/* flip layer */}
        <motion.div
          className="relative h-full w-full"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={
            reduce
              ? { duration: 0 }
              : flipped
                // forward: let the others blow away first, then flip.
                ? { duration: 0.8, ease: EASE, delay: 0.28 }
                // reverse: flip back FAST and with no delay, so the card is
                // showing its back again before it rejoins the squared deck.
                : { duration: 0.4, ease: EASE }
          }
        >
          <div className="absolute inset-0 [backface-visibility:hidden]">
            <CardBack />
          </div>
          {/* The SAME regular landscape credit card — untouched, only ROTATED 90°
              so it stands vertical inside the portrait footprint. Its box is
              PH×PW (the landscape footprint); rotating about its own centre lands
              it exactly on the PW×PH portrait footprint. +90° (not −90°) keeps the
              "Fils" mark at the TOP of the standing card. */}
          <div
            className="absolute inset-0 [backface-visibility:hidden]"
            style={{ transform: "rotateY(180deg)" }}
          >
            <div
              className="absolute left-1/2 top-1/2"
              style={{ width: PH, height: PW, transform: "translate(-50%, -50%) rotate(90deg)" }}
            >
              <CreditFace />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// Comic "shake" marks flanking the deck — short bars that jitter + flicker.
const SHAKE_LINES = [
  { side: -1, y: -36, w: 24 },
  { side: -1, y: 0, w: 32 },
  { side: -1, y: 36, w: 24 },
  { side: 1, y: -36, w: 24 },
  { side: 1, y: 0, w: 32 },
  { side: 1, y: 36, w: 24 },
];
function ShakeLines({ show }: { show: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {SHAKE_LINES.map((l, i) => (
        <motion.span
          key={i}
          className="absolute left-1/2 top-1/2 h-[3px] rounded-full bg-fg/45"
          style={{ translate: "-50% -50%", width: l.w }}
          animate={show ? { x: [l.side * 92, l.side * 104], y: l.y, opacity: [0.1, 0.8] } : { x: l.side * 100, y: l.y, opacity: 0 }}
          transition={show ? { duration: 0.1, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" } : { duration: 0.2 }}
        />
      ))}
    </div>
  );
}

function Caption({ show }: { show: boolean }) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: show ? 1 : 0, y: show ? 0 : 10 }}
      transition={{ duration: 0.45, delay: show ? 0.5 : 0, ease: EASE }}
      className="pointer-events-none absolute inset-x-0 bottom-5 flex flex-col items-center"
    >
      <p className="text-xs text-faint">Your best card, net of fees</p>
      <p className="font-display text-2xl font-semibold text-gradient">+AED 3,100 / year</p>
    </motion.div>
  );
}

// The warm, branded playing-card back — a diamond lattice + emblem on terracotta.
function CardBack() {
  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-[11px] border border-white/25 shadow-card"
      style={{ background: "linear-gradient(150deg, #8a3517, #b0512a)" }}
    >
      <div className="absolute inset-1.5 rounded-[8px] border border-white/30" />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.18) 0 2px, transparent 2px 9px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.18) 0 2px, transparent 2px 9px)",
        }}
      />
      <div className="absolute inset-0 grid place-items-center">
        <span className="grid h-9 w-9 place-items-center rounded-full border border-white/40 font-display text-lg font-semibold text-white/90">
          F
        </span>
      </div>
    </div>
  );
}

// A clean, Fils-branded credit card — the standard landscape layout (it gets
// rotated 90° at the call site to stand vertical, per "only rotation of card").
function CreditFace() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[12px] bg-brand p-4 text-white shadow-lift">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(255,255,255,0.25),transparent_46%)]" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="font-display text-base font-semibold">Fils</span>
          <span className="text-[10px] uppercase tracking-widest text-white/80">Signature</span>
        </div>
        <div className="h-6 w-9 rounded-md bg-gradient-to-br from-[#f7e39b] to-[#c8a03a]" />
        <div className="flex items-end justify-between">
          <span className="font-mono text-xs tracking-[0.18em] text-white/85">•••• 8842</span>
          <span className="font-display text-base font-bold italic tracking-tight">VISA</span>
        </div>
      </div>
    </div>
  );
}
