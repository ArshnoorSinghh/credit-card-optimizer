"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/*
  CursorGlow — a soft, warm sunlight spotlight that trails the cursor. Pointer
  position feeds two springs so the glow eases toward the cursor rather than
  snapping. Fixed, behind content, and hidden from touch devices / reduced-motion
  users. Kept faint so it warms the light canvas without distracting.
*/

export function CursorGlow() {
  const x = useMotionValue(-400);
  const y = useMotionValue(-400);
  const sx = useSpring(x, { stiffness: 120, damping: 30, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 120, damping: 30, mass: 0.6 });

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduce.matches) return;

    const onMove = (e: PointerEvent) => {
      x.set(e.clientX - 300);
      y.set(e.clientY - 300);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [x, y]);

  return (
    <motion.div
      aria-hidden
      style={{ x: sx, y: sy }}
      className="pointer-events-none fixed left-0 top-0 z-0 h-[600px] w-[600px] rounded-full opacity-30
                 bg-[radial-gradient(circle,rgba(244,166,58,0.22),transparent_60%)]"
    />
  );
}
