"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

/*
  Minimal toast system — a context provider mounted once at the root, plus a
  useToast() hook any client component can call for lightweight, self-dismissing
  confirmations ("Added Skywards Miles"). Deliberately small: no queue limits,
  no positioning API — one warm stack, bottom-right, that respects the theme.
*/

type ToastTone = "success" | "info";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = ++counter;
      setItems((xs) => [...xs, { id, message, tone }]);
      // Auto-dismiss; the user can also dismiss early via the close button.
      setTimeout(() => remove(id), 3200);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const Icon = t.tone === "success" ? CheckCircle2 : Info;
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 12, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                className="pointer-events-auto flex items-center gap-3 rounded-[var(--radius-md)] border border-line bg-surface px-4 py-3 shadow-lift"
              >
                <Icon
                  className={cn("h-4 w-4 shrink-0", t.tone === "success" ? "text-success" : "text-clay")}
                />
                <span className="flex-1 text-sm text-fg">{t.message}</span>
                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  aria-label="Dismiss"
                  className="rounded-full p-1 text-faint transition-colors hover:bg-black/[0.04] hover:text-fg"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
