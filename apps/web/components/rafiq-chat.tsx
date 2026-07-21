"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Send, Sparkles, TriangleAlert } from "lucide-react";
import type { SpendingProfile, UserProfile } from "@fils/engine";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { sendRafiqMessage } from "@/lib/rafiq/client";
import type { RafiqTurn } from "@/lib/rafiq/contract";
import { RafiqReceipt } from "@/components/rafiq-receipt";

/*
  RafiqChat — the on-page AI assistant. A calm, data-first chat that talks to
  /api/rafiq: it sends the user's message plus the spend + eligibility profile we
  already have, shows Rafiq's phrased reply, and renders the structured engine
  result (the `data` field) as a readable receipt beneath it — so every number the
  user sees comes from the engine, not the model's prose. A `degraded` reply is
  shown as a gentle "temporarily unavailable" note, never an error.
*/

interface ChatMessage {
  role: "user" | "model";
  text: string;
  tool?: string | null;
  data?: unknown;
  degraded?: boolean;
}

const SUGGESTIONS = [
  "Which card should I use for Carrefour?",
  "Which cards should I get?",
  "Compare FAB Cashback and ADCB 365",
];

export function RafiqChat({
  spending,
  profile,
  className,
}: {
  spending: SpendingProfile;
  profile: UserProfile;
  className?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    const history: RafiqTurn[] = messages.map((m) => ({ role: m.role, text: m.text }));
    const next = [...messages, { role: "user" as const, text: trimmed }];
    setMessages(next);
    setBusy(true);

    const res = await sendRafiqMessage({
      message: trimmed,
      context: { spending, profile },
      history,
    });

    setMessages([
      ...next,
      { role: "model", text: res.reply, tool: res.tool, data: res.data, degraded: res.degraded },
    ]);
    setBusy(false);
  }

  const empty = messages.length === 0;

  return (
    <Card glow className={cn("flex flex-col overflow-hidden p-0", className)}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-line px-6 py-4">
        <span className="grid h-10 w-10 place-items-center rounded-[0.7rem] bg-brand text-white shadow-glow">
          <Bot className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-xl font-semibold leading-tight">Ask Rafiq</h3>
          <p className="text-sm text-muted">Plain-language answers, grounded in your real numbers.</p>
        </div>
      </div>

      {/* Conversation */}
      <div
        ref={scrollRef}
        className={cn(
          "flex-1 space-y-4 overflow-y-auto px-6 py-5",
          empty ? "min-h-0" : "max-h-[30rem]",
        )}
      >
        {empty ? (
          <div className="py-2">
            <p className="text-sm text-muted">
              I can recommend a card for a purchase, build your best portfolio, compare two cards for
              how <span className="text-fg">you</span> spend, or value your points — try:
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 py-1.5 text-sm text-muted transition-colors hover:border-line-strong hover:text-fg"
                >
                  <Sparkles className="h-3.5 w-3.5 text-clay" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => <Bubble key={i} message={m} />)
        )}

        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="flex gap-1">
              {[0, 1, 2].map((n) => (
                <motion.span
                  key={n}
                  className="h-1.5 w-1.5 rounded-full bg-flame"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: n * 0.15 }}
                />
              ))}
            </span>
            Rafiq is thinking…
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        className="flex items-center gap-2 border-t border-line px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about cards, portfolios, or points…"
          aria-label="Message Rafiq"
          className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-line bg-surface-2 px-4 py-2.5 text-sm text-fg outline-none transition-colors placeholder:text-faint focus:border-line-strong focus:ring-2 focus:ring-flame/40"
        />
        <motion.button
          type="submit"
          disabled={busy || input.trim() === ""}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Send message"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-md)] bg-flame text-white shadow-glow transition-opacity disabled:opacity-40 disabled:shadow-none"
        >
          <Send className="h-4 w-4" />
        </motion.button>
      </form>
    </Card>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="ml-auto max-w-[85%] rounded-[var(--radius-md)] rounded-br-sm bg-flame px-4 py-2.5 text-sm text-white"
      >
        {message.text}
      </motion.div>
    );
  }

  // Degraded: a gentle "temporarily unavailable" note, not an error.
  if (message.degraded) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="mr-auto flex max-w-[92%] items-start gap-2.5 rounded-[var(--radius-md)] rounded-bl-sm border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-muted"
      >
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <span>{message.text}</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="mr-auto max-w-[92%]"
    >
      <div className="rounded-[var(--radius-md)] rounded-bl-sm border border-line bg-surface px-4 py-2.5 text-sm text-fg">
        {message.text}
      </div>
      <RafiqReceipt tool={message.tool ?? null} data={message.data ?? null} />
    </motion.div>
  );
}
