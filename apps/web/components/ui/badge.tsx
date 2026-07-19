import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
  Badge / pill — small status + label chip. `tone` maps to the semantic tokens;
  used for eyebrows, card tiers, fee tags, and confidence flags.
*/

type Tone = "brand" | "neutral" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  brand: "border-violet/30 bg-violet/10 text-violet",
  neutral: "border-line-strong bg-white/5 text-muted",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
