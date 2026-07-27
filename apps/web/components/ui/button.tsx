"use client";

import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/cn";

/*
  Button — the primary interactive primitive. Variants:
    - brand:   solid flame fill, the main CTA (glows on hover)
    - solid:   soft raised surface
    - outline: hairline border, ghost fill
    - ghost:   text-only, for low-emphasis actions
  Motion: subtle scale on hover/press (Framer Motion) — the "buttons feel alive"
  rule from the design brief.
*/

type Variant = "brand" | "solid" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-full whitespace-nowrap " +
  "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-flame/60 disabled:opacity-50 disabled:pointer-events-none select-none";

const variants: Record<Variant, string> = {
  brand: "bg-flame text-white shadow-glow hover:shadow-glow-lg",
  solid: "bg-surface-2 text-fg border border-line hover:border-line-strong",
  // why a terracotta hairline over a warm tint, and not a stronger neutral:
  // this variant carried `border-line-strong` — a 20%-opacity brown hairline —
  // which all but disappeared on the eggshell canvas, worst of all in the hero
  // where BurjSunrise washes warm light behind it. It read as text, not as a
  // button.
  //
  // `clay` measures 4.23:1 on the canvas, clearing the 3:1 WCAG floor for a
  // non-text boundary (`flame` is only 2.77:1 there, so it is the wrong pick for
  // the border even though it is the fill accent). The label stays `text-fg`
  // rather than going clay: at 16px, clay's 4.23:1 is under the 4.5:1 AA floor
  // for body text — it clears the bar only at heading sizes.
  //
  // The 7% flame wash gives it a surface so it reads as a target, while staying
  // far enough from the saturated `brand` fill + glow that the primary CTA next
  // to it is still unmistakably primary.
  outline:
    "border border-clay bg-flame/[0.07] text-fg hover:bg-flame/[0.14]",
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
