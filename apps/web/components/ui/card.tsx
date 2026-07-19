"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/cn";

/*
  Card — the rounded, elevated surface the whole product is built from.
  `hover` opts into the Revolut "lift + glow on hover" behaviour. `glow` renders
  a gradient hairline ring for hero/feature emphasis.
*/

export interface CardProps extends HTMLMotionProps<"div"> {
  hover?: boolean;
  glow?: boolean;
}

export function Card({ className, hover = false, glow = false, ...props }: CardProps) {
  return (
    <motion.div
      whileHover={hover ? { y: -6 } : undefined}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={cn(
        "relative rounded-[var(--radius-lg)] bg-surface border border-line p-6",
        hover &&
          "cursor-default transition-shadow duration-300 hover:border-line-strong hover:shadow-[0_20px_60px_-20px_rgba(124,108,255,0.45)]",
        glow && "ring-gradient",
        className,
      )}
      {...props}
    />
  );
}
