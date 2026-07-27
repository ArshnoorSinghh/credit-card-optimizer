"use client";

import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/cn";

/*
  Button — the primary interactive primitive. Variants:
    - brand:          solid flame fill, the main CTA (glows on hover)
    - solid:          soft raised surface
    - outline:        hairline border, ghost fill
    - outline-strong: outline for the hero only — terracotta border over a warm
                      wash, so it survives the BurjSunrise backdrop
    - ghost:          text-only, for low-emphasis actions
  Motion: subtle scale on hover/press (Framer Motion) — the "buttons feel alive"
  rule from the design brief.
*/

type Variant = "brand" | "solid" | "outline" | "outline-strong" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-full whitespace-nowrap " +
  "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-flame/60 disabled:opacity-50 disabled:pointer-events-none select-none";

const variants: Record<Variant, string> = {
  brand: "bg-flame text-white shadow-glow hover:shadow-glow-lg",
  solid: "bg-surface-2 text-fg border border-line hover:border-line-strong",
  outline: "border border-line-strong text-fg hover:bg-black/[0.04]",
  // The hero's secondary CTA, and only the hero's. `outline` alone leans on
  // `border-line-strong` — a 20%-opacity brown hairline measuring 1.46:1 on the
  // eggshell canvas, under half the 3:1 WCAG floor for a non-text boundary. That
  // is survivable in dense chrome where surrounding structure implies the
  // control, but not against BurjSunrise, which washes warm light straight
  // behind the button and leaves it reading as text rather than a target.
  //
  // `clay` measures 4.23:1 on the canvas so the boundary clears 3:1. `flame` is
  // the intuitive pick — it is the system's border/fill accent — but only makes
  // 2.77:1 there, so it stays the wash. The label stays `text-fg` (13.26:1 on
  // the tint); clay as a 16px label would be 3.95:1, under the 4.5:1 AA floor it
  // clears only at heading sizes.
  //
  // The wash lands 1.07:1 off the canvas: enough to read as a surface, nowhere
  // near the saturated `brand` fill + glow beside it, so the primary CTA stays
  // unmistakably primary.
  "outline-strong": "border border-clay bg-flame/[0.07] text-fg hover:bg-flame/[0.14]",
  ghost: "text-muted hover:text-fg hover:bg-black/[0.04]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-[0.95rem]",
  lg: "h-14 px-8 text-base",
};

export interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "brand", size = "md", ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
});
