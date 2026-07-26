"use client";

import { useState } from "react";
import { Check, Copy, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUGGESTIONS_EMAIL } from "@/lib/legal";

/*
  Suggestion composer.

  why this builds a mailto: instead of POSTing to an API route: there is no
  transactional mail provider wired up, so a form that posted somewhere would
  either need a provider account that does not exist yet, or would drop what you
  typed on the floor. A form that silently discards a message is worse than no
  form — the user believes they were heard.

  So the fields are real, and the submit hands the composed message to whatever
  mail client the reader already uses. Nothing is stored, nothing is lost, and
  the button says "open in your email app" rather than "send", because opening a
  draft is honestly what it does.

  The plain address sits underneath for anyone whose browser has no mailto
  handler registered — webmail users on desktop often don't. That path has to
  keep working, so it is a real copyable address, not a decorative one.

  When an inbox and a provider exist, this becomes a normal POST to an API route
  and only handleSubmit changes; the fields and layout stay as they are.
*/

const CATEGORIES = [
  "A card's rates or fees look wrong",
  "Something is broken",
  "The result confused me",
  "An idea for what to build next",
  "Something else",
] as const;

const FIELD =
  "w-full rounded-[var(--radius-md)] border border-line bg-surface-2 px-4 py-3 text-sm text-fg " +
  "outline-none transition-colors placeholder:text-faint focus:border-line-strong focus:ring-2 focus:ring-flame/40";

export function SuggestionForm() {
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [message, setMessage] = useState("");
  const [context, setContext] = useState("");
  const [copied, setCopied] = useState(false);

  const canSubmit = message.trim() !== "";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    // why the subject carries the category: with no ticketing system behind
    // this, the subject line is the only triage the inbox gets.
    const subject = `Fils feedback — ${category}`;
    const body = context.trim()
      ? `${message.trim()}\n\nWhere: ${context.trim()}`
      : message.trim();

    window.location.href = `mailto:${SUGGESTIONS_EMAIL}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(SUGGESTIONS_EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // why swallowed: clipboard access can be refused by permissions policy or
      // an insecure context. The address is already on screen as selectable
      // text, so the fallback is simply that the reader selects it by hand.
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="category" className="block text-sm text-muted">
          What's this about?
        </label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={`mt-2 ${FIELD}`}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="message" className="block text-sm text-muted">
          What happened, and what did you expect instead?
        </label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          required
          placeholder="The more specific the better. If a number looked wrong, tell us which one and what you think it should have been."
          className={`mt-2 resize-y ${FIELD}`}
        />
      </div>

      <div>
        <label htmlFor="context" className="block text-sm text-muted">
          Which page or card? <span className="text-faint">(optional)</span>
        </label>
        <input
          id="context"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="e.g. the results page, or the ADCB Traveller card"
          className={`mt-2 ${FIELD}`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-1">
        <Button type="submit" size="lg" disabled={!canSubmit}>
          <Mail className="h-4 w-4" />
          Open in your email app
        </Button>
        <p className="text-sm text-faint">
          This opens a draft. Nothing is sent until you send it.
        </p>
      </div>

      <div className="border-t border-line pt-5">
        <p className="text-sm text-muted">
          Or write to us directly:{" "}
          <span className="font-medium text-fg">{SUGGESTIONS_EMAIL}</span>
        </p>
        <button
          type="button"
          onClick={copyAddress}
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-black/[0.04]"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-oasis" aria-hidden />
          ) : (
            <Copy className="h-3.5 w-3.5 text-clay" aria-hidden />
          )}
          {copied ? "Copied" : "Copy address"}
        </button>
      </div>
    </form>
  );
}
