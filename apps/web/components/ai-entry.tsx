"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Send, X } from "lucide-react";
import { loadProfile } from "@/lib/profile-store";
import { sendRafiqMessage } from "@/lib/rafiq/client";
import type { RafiqTurn } from "@/lib/rafiq/contract";

/*
  Rafiq — the AI assistant entry point.

  This wires the reserved placeholder slot to POST /api/rafiq: it sends the user's
  message plus whatever context we already have (spend + eligibility profile from
  sessionStorage), and renders Rafiq's reply. Styling here is intentionally minimal
  and reuses existing tokens — the frontend pass owns the polished chat UI. The
  contract (sendRafiqMessage) and behavior (history, degraded handling) are done.
*/

interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export function AiEntry() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const nextMessages: ChatMessage[] = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setBusy(true);

    // Pull known context so Rafiq can answer portfolio/comparison questions.
    const stored = loadProfile();
    const history: RafiqTurn[] = messages.map((m) => ({ role: m.role, text: m.text }));

    const res = await sendRafiqMessage({
      message: text,
      context: { spending: stored.spending, profile: stored.profile },
      history,
    });
    setMessages([...nextMessages, { role: "model", text: res.reply }]);
    setBusy(false);
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="glass mb-3 flex h-[26rem] w-80 flex-col rounded-[var(--radius-lg)] p-4 shadow-2xl"
          >
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-flame text-white">
                <Bot className="h-4 w-4" />
              </span>
              <p className="font-semibold text-fg">Ask Rafiq</p>
            </div>

            <div ref={scrollRef} className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1 text-sm">
              {messages.length === 0 && (
                <p className="text-muted">
                  Ask me things like &ldquo;which card for Carrefour?&rdquo;, &ldquo;which cards should I get?&rdquo;,
                  or &ldquo;what are my points worth?&rdquo;
                </p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                  <span
                    className={
                      m.role === "user"
                        ? "inline-block rounded-lg bg-flame px-3 py-2 text-white"
                        : "inline-block rounded-lg bg-black/5 px-3 py-2 text-fg dark:bg-white/10"
                    }
                  >
                    {m.text}
                  </span>
                </div>
              ))}
              {busy && <p className="text-muted">Rafiq is thinking…</p>}
            </div>

            <form
              className="mt-3 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about cards or points…"
                aria-label="Message Rafiq"
                className="min-w-0 flex-1 rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm text-fg outline-none dark:border-white/15"
              />
              <button
                type="submit"
                disabled={busy || input.trim() === ""}
                aria-label="Send message"
                className="grid h-9 w-9 place-items-center rounded-lg bg-flame text-white disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((v) => !v)}
        aria-label="Open Rafiq, the Fils AI assistant"
        className="grid h-14 w-14 place-items-center rounded-full bg-flame text-white shadow-glow-lg"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </motion.button>
    </div>
  );
}
