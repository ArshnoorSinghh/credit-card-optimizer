"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useScroll,
  useReducedMotion,
  type Transition,
} from "framer-motion";
import { CreditCardArt } from "@/components/credit-card-art";

/*
  HeroCards — a hand of real UAE cards, choreographed like playing cards, in
  actual 3D (perspective + per-card translateZ, so the cards float at different
  depths rather than sitting on one flat sheet).

  The four beats tie straight to the headline, "the right cards for the way you
  actually spend":
    1. THE DEAL       — cards are dealt in from a deck off the top-right: far away
                        and turned (negative Z + rotateY), they fly toward the
                        viewer, tumbling flat and settling with a spring overshoot.
    2. THE WINNING HAND — once dealt, the recommended card (Emirates NBD) steps
                        FORWARD in Z while the also-rans recede in Z with a touch
                        of blur — depth, not a grey-out, marks the winner.
    3. FAN ON HOVER   — hovering splays the hand open (x + rotateZ + a little
                        rotateY so cards angle outward in space) and brings every
                        card level and sharp; leaving re-forms the winning hand.
                        The whole hand also leans toward the cursor.
    4. GATHER ON SCROLL — as the hero leaves, the fan converges into a tidy,
                        near-levelled stack.

  preserve-3d must run through every layer between the perspective root and the
  cards, and opacity must stay OFF that chain (opacity flattens 3D) — so the
  scroll-fade was dropped and per-card opacity lives on the leaf-most layer.
  Reduced-motion users get a clean static fan (depth kept, all motion removed).
*/

type HeroCard = {
  key: string;
  className: string;
  zIndex: number;
  dealDelay: number;
  restRotate: number; // resting rotateZ (the fan angle)
  restZ: number; // resting depth — the parallax between cards
  fanX: number; // extra x when the hand fans open on hover
  fanRotate: number; // extra rotateZ when fanned
  fanRotateY: number; // slight 3D splay outward when fanned
  winner: boolean;
  art: {
    bank: string;
    name: string;
    tier?: string;
    highlight?: string;
    network?: string;
    currency?: string;
  };
};

const CARDS: HeroCard[] = [
  {
    key: "mashreq",
    className: "left-2 top-6 w-[74%]",
    zIndex: 1,
    dealDelay: 0.1,
    restRotate: -12,
    restZ: -34,
    fanX: -30,
    fanRotate: -9,
    fanRotateY: -12,
    winner: false,
    art: {
      bank: "Mashreq Bank",
      name: "Mashreq Cashback Card",
      tier: "Platinum",
      network: "Mastercard",
      highlight: "Up to 5% back",
    },
  },
  {
    key: "fab",
    className: "-right-2 bottom-0 w-[58%]",
    zIndex: 2,
    dealDelay: 0.24,
    restRotate: 14,
    restZ: 8,
    fanX: 44,
    fanRotate: 10,
    fanRotateY: 14,
    winner: false,
    art: {
      bank: "First Abu Dhabi Bank",
      name: "FAB Rewards Indulge",
      tier: "Signature",
      network: "Visa",
    },
  },
  {
    key: "enbd",
    className: "right-0 top-16 w-[82%]",
    zIndex: 3,
    dealDelay: 0.38, // the winner is dealt LAST, landing forward and on top
    restRotate: 5,
    restZ: 40,
    fanX: 14,
    fanRotate: 5,
    fanRotateY: 0,
    winner: true,
    art: {
      bank: "Emirates NBD",
      name: "Emirates NBD Skywards Infinite",
      tier: "Infinite",
      network: "Visa",
      currency: "Skywards Miles",
      highlight: "1.5 miles / AED",
    },
  },
];

// The deck the cards are dealt FROM — far back in Z, turned, off the top-right.
const DECK = { opacity: 0, x: 200, y: -180, z: -320, rotate: -24, rotateY: -42, scale: 1 };

// Loose, slightly under-damped spring so the deal lands with a card-like
// overshoot; the live spring (post-deal) is snappier for hover/settle changes.
const liveTransition: Transition = { type: "spring", stiffness: 240, damping: 26 };
const dealTransition = (card: HeroCard): Transition => ({
  type: "spring",
  stiffness: 120,
  damping: 13,
  mass: 0.9,
  delay: card.dealDelay,
});

export function HeroCards() {
  const wrap = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [settled, setSettled] = useState(false); // deal finished → winning hand

  useEffect(() => {
    if (reduce) {
      setSettled(true);
      return;
    }
    const t = setTimeout(() => setSettled(true), 1250);
    return () => clearTimeout(t);
  }, [reduce]);

  // Group tilt — the whole hand leans gently toward the cursor; with per-card Z
  // this now reveals real parallax between the cards.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { stiffness: 140, damping: 18, mass: 0.4 };
  const rotX = useSpring(useTransform(py, [-0.5, 0.5], [8, -8]), spring);
  const rotY = useSpring(useTransform(px, [-0.5, 0.5], [-12, 12]), spring);

  function onMove(e: React.MouseEvent) {
    if (reduce || !wrap.current) return;
    const r = wrap.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  }
  function onEnter() {
    if (!reduce) setHovered(true);
  }
  function onLeave() {
    setHovered(false);
    px.set(0);
    py.set(0);
  }

  // Scroll "gather" — each card converges toward a tidy stack as the hero leaves.
  // Gather rotation composes with each card's rest rotation, levelling the fan.
  const { scrollY } = useScroll();
  const G: [number, number] = [0, 640];
  const mX = useTransform(scrollY, G, [0, 48]);
  const mY = useTransform(scrollY, G, [0, -26]);
  const mR = useTransform(scrollY, G, [0, 8]);
  const fX = useTransform(scrollY, G, [0, -66]);
  const fY = useTransform(scrollY, G, [0, -86]);
  const fR = useTransform(scrollY, G, [0, -10]);
  const eX = useTransform(scrollY, G, [0, -10]);
  const eY = useTransform(scrollY, G, [0, -12]);
  const eR = useTransform(scrollY, G, [0, -5]);
  const gather = [
    { x: mX, y: mY, rotate: mR },
    { x: fX, y: fY, rotate: fR },
    { x: eX, y: eY, rotate: eR },
  ];

  // Resting/interactive pose for one card, given the current phase + hover.
  function pose(card: HeroCard) {
    if (reduce) {
      // Clean static fan — depth kept, no deal / winner emphasis / fan-out.
      return { opacity: 1, x: 0, y: 0, z: card.restZ, rotate: card.restRotate, rotateY: 0, filter: "blur(0px)" };
    }
    const fanning = hovered;
    const winnerRest = settled && !fanning && card.winner;
    const loserRest = settled && !fanning && !card.winner;
    return {
      opacity: loserRest ? 0.92 : 1,
      x: fanning ? card.fanX : 0,
      y: winnerRest ? -14 : 0,
      // Depth does the emphasis: winner forward, losers pushed back (+ blur).
      z: winnerRest ? card.restZ + 48 : loserRest ? card.restZ - 66 : card.restZ,
      rotate: card.restRotate + (fanning ? card.fanRotate : 0),
      rotateY: fanning ? card.fanRotateY : 0,
      filter: loserRest ? "blur(1.6px)" : "blur(0px)",
    };
  }

  return (
    <div
      ref={wrap}
      onMouseMove={onMove}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="relative mx-auto h-[440px] w-full max-w-md md:h-[500px]"
      style={{ perspective: 1200 }}
    >
      <motion.div
        className="relative h-full w-full"
        style={{
          rotateX: reduce ? 0 : rotX,
          rotateY: reduce ? 0 : rotY,
          transformStyle: "preserve-3d",
        }}
      >
        {CARDS.map((card, i) => {
          const g = gather[i]!; // parallel array, same length as CARDS — always defined
          return (
            <motion.div
              key={card.key}
              className={`absolute ${card.className}`}
              // Gather layer: scroll-driven convergence. preserve-3d so the child's
              // translateZ still reads as depth; no opacity here (it would flatten 3D).
              style={
                reduce
                  ? { zIndex: card.zIndex, transformStyle: "preserve-3d" }
                  : { x: g.x, y: g.y, rotate: g.rotate, zIndex: card.zIndex, transformStyle: "preserve-3d" }
              }
            >
              {/* Interactive layer: deal entrance → winning hand → fan on hover. */}
              <motion.div
                initial={reduce ? false : DECK}
                animate={pose(card)}
                transition={settled ? liveTransition : dealTransition(card)}
                style={{ transformStyle: "preserve-3d" }}
              >
                <CreditCardArt {...card.art} />
              </motion.div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
