"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, X } from "lucide-react";

/*
  AI bot entry point — the reserved, clean placeholder from the brief. It renders
  a floating launcher; opening it shows a "coming soon" panel. When the real
  assistant is ready, replace the panel body with the chat UI — the launcher and
  positioning stay.
*/

export function AiEntry() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="glass mb-3 w-72 rounded-[var(--radius-lg)] p-5 shadow-2xl"
          >
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">
                <Bot className="h-4 w-4" />
              </span>
              <p className="font-semibold text-fg">Ask Fils AI</p>
            </div>
            <p className="mt-3 text-sm text-muted">
              Soon you&apos;ll be able to ask why a card was recommended, compare options, and plan
              redemptions in plain language. This space is reserved for it.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((v) => !v)}
        aria-label="Open Fils AI assistant"
        className="grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-glow-lg"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </motion.button>
    </div>
  );
}
