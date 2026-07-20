"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

/*
  CountTo — tweens a figure from its PREVIOUS value to the next whenever `value`
  changes. Unlike CountUp (which counts up from 0 once on scroll-in), this is for
  LIVE numbers that recompute as the user interacts: dragging a spend slider eases
  the headline AED value to its new figure instead of snapping. `format` maps the
  in-flight number to the string shown (pass the shared `aed` helper).

  Reduced-motion users jump straight to the final value. Server and first client
  render both use `value`, so there's no hydration mismatch — the tween only ever
  runs on a subsequent change.
*/

export function CountTo({
  value,
  format = (n) => Math.round(n).toLocaleString(),
  duration = 450,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value); // where the next tween starts from
  const rafRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (reduce || from === value) {
      // No motion (or nothing to animate): land on the value immediately.
      setDisplay(value);
      fromRef.current = value;
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic — matches CountUp
      setDisplay(from + (value - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value; // settle exactly, ready for the next change
      }
    };

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration, reduce]);

  return <span className={cn("tabular-nums", className)}>{format(display)}</span>;
}
