"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

/*
  Scroll-reveal primitives (Framer Motion), per the guide's step 2:
  "scroll-triggered fades, staggered reveals, smooth transitions."

  - <Reveal>  fades + lifts a single block into view once.
  - <Stagger> + <StaggerItem> reveals children one after another.
  All use whileInView so they fire as the user scrolls, and once:true so they
  don't re-run and feel gimmicky.
*/

// Explicit bezier tuple type — Framer's Easing tuple rejects a readonly `as const`.
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
