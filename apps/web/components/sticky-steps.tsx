"use client";

import { useRef, useState, type ComponentType } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
} from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { CreditCardArt } from "@/components/credit-card-art";

/*
  StickySteps — Fils' take on Revolut's pinned scroll-sequence. The section is
  tall; an inner panel pins to the viewport while you scroll through it, and the
  scroll progress (a) advances the active step on the left and (b) rotates /
  reveals the product visual on the right. It's a real 3-step sequence, so the
  01/02/03 numbering encodes actual order.
*/

type Step = { icon: ComponentType<{ className?: string }>; title: string; body: string };

export function StickySteps({ steps }: { steps: Step[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const idx = Math.min(steps.length - 1, Math.floor(v * steps.length));
    setActive(idx);
  });

  // Right-hand visual reacts to scroll progress.
  const rotateY = useTransform(scrollYProgress, [0, 1], [-16, 16]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.92, 1, 0.95]);
  const railScale = useTransform(scrollYProgress, [0, 1], [0.02, 1]);

  return (
    <section ref={ref} className="relative" style={{ height: `${steps.length * 100}vh` }}>
      <div className="sticky top-0 flex min-h-screen items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-2">
          {/* Left: the steps, active one lit */}
          <div>
            <Badge tone="brand">How it works</Badge>
            <h2 className="mt-5 text-3xl font-semibold md:text-4xl">
              From guesswork to your best wallet
            </h2>

            <div className="mt-10 flex gap-5">
              {/* progress rail */}
              <div className="relative w-px shrink-0 bg-line">
                <motion.div
                  style={{ scaleY: railScale }}
                  className="absolute inset-0 origin-top bg-brand"
                />
              </div>

              <div className="flex flex-col gap-8">
                {steps.map((step, i) => {
                  const on = i === active;
                  return (
                    <motion.div
                      key={step.title}
                      animate={{ opacity: on ? 1 : 0.4, x: on ? 0 : -4 }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className="flex gap-4"
                    >
                      <span
                        className={
                          "grid h-11 w-11 shrink-0 place-items-center rounded-[0.8rem] transition-colors " +
                          (on ? "bg-brand text-white" : "border border-line bg-surface-2 text-faint")
                        }
                      >
                        <step.icon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-clay">
                          Step {String(i + 1).padStart(2, "0")}
                        </p>
                        <h3 className="mt-1 text-xl font-semibold">{step.title}</h3>
                        <p className="mt-2 text-muted">{step.body}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: the product visual, rotating with scroll */}
          <div className="relative hidden md:block" style={{ perspective: 1200 }}>
            <motion.div
              style={{ rotateY, scale, transformStyle: "preserve-3d" }}
              className="relative mx-auto max-w-sm"
            >
              <CreditCardArt
                bank="Emirates NBD"
                name="Emirates NBD Skywards Infinite"
                tier="Infinite"
                network="Visa"
                currency="Skywards Miles"
                highlight="1.5 miles / AED"
              />
              {/* floating "net value" chip that pops in on the last step */}
              <motion.div
                animate={{
                  opacity: active === steps.length - 1 ? 1 : 0,
                  y: active === steps.length - 1 ? 0 : 12,
                }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="absolute -bottom-6 -right-4 rounded-2xl border border-line bg-surface px-5 py-4 shadow-lift"
              >
                <p className="text-xs text-faint">Net value / year</p>
                <p className="font-display text-2xl font-semibold text-gradient">+AED 3,100</p>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
