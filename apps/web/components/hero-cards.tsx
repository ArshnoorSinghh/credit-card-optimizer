"use client";

import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useScroll,
  useReducedMotion,
} from "framer-motion";
import { CreditCardArt } from "@/components/credit-card-art";

/*
  HeroCards — a fanned stack of real card art with two Revolut-style moves:
    1. mouse-tilt: the whole group tilts in 3D toward the cursor (springy), and
    2. scroll-parallax: the cards drift and rotate at different rates as the hero
       scrolls away, giving real depth.
  Both are disabled for reduced-motion users, who get a clean static fan.
*/

export function HeroCards() {
  const wrap = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // Scroll parallax — each card moves a different amount as the page scrolls.
  const { scrollY } = useScroll();
  const yTop = useTransform(scrollY, [0, 700], [0, -70]);
  const yMid = useTransform(scrollY, [0, 700], [0, 30]);
  const yBot = useTransform(scrollY, [0, 700], [0, 90]);
  const rotScroll = useTransform(scrollY, [0, 700], [0, -6]);

  // Mouse tilt — normalized cursor position drives rotateX/Y through springs.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { stiffness: 140, damping: 18, mass: 0.4 };
  const rotX = useSpring(useTransform(py, [-0.5, 0.5], [9, -9]), spring);
  const rotY = useSpring(useTransform(px, [-0.5, 0.5], [-12, 12]), spring);

  function onMove(e: React.MouseEvent) {
    if (reduce || !wrap.current) return;
    const r = wrap.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  }
  function onLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    <div
      ref={wrap}
      onMouseMove={onMove}
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
        {/* back card — Mashreq orange */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 50, rotate: -14 }}
          animate={{ opacity: 1, y: 0, rotate: -12 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          style={{ y: reduce ? undefined : yTop, z: 0 }}
          className="absolute left-2 top-6 w-[74%]"
        >
          <CreditCardArt
            bank="Mashreq Bank"
            name="Mashreq Cashback Card"
            tier="Platinum"
            network="Mastercard"
            highlight="Up to 5% back"
          />
        </motion.div>

        {/* front card — Emirates NBD Skywards (red) */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 70, rotate: 8 }}
          animate={{ opacity: 1, y: 0, rotate: 5 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          style={{ y: reduce ? undefined : yMid, rotate: reduce ? undefined : rotScroll, z: 60 }}
          className="absolute right-0 top-16 w-[82%]"
        >
          <CreditCardArt
            bank="Emirates NBD"
            name="Emirates NBD Skywards Infinite"
            tier="Infinite"
            network="Visa"
            currency="Skywards Miles"
            highlight="1.5 miles / AED"
          />
        </motion.div>

        {/* floating chip card — FAB blue, small accent */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 40, rotate: 18 }}
          animate={{ opacity: 1, y: 0, rotate: 14 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.45 }}
          style={{ y: reduce ? undefined : yBot, z: 120 }}
          className="absolute -right-2 bottom-0 w-[58%]"
        >
          <CreditCardArt
            bank="First Abu Dhabi Bank"
            name="FAB Rewards Indulge"
            tier="Signature"
            network="Visa"
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
