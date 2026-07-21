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
  outline: "border border-line-strong text-fg hover:bg-black/[0.04]",
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
