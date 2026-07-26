"use client";

import { useState } from "react";
import { Check, Copy, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUGGESTIONS_EMAIL } from "@/lib/legal";

/*
  Suggestion composer.

  Posts to /api/suggestions, which sends the message from the server. An earlier
  version composed a mailto: and handed a draft to the reader's own mail client —
  that needed no infrastructure, but it only arrived if they had a mail client
  configured and then pressed send themselves.

  The plain address stays visible underneath as the fallback that always works:
  if the API is misconfigured or down, the reader can still copy it and write
  directly rather than losing what they typed.

  On identity, see the route: a signed-in sender is identified from the session
  server-side, and the optional field below is only for anonymous readers who
  want a reply. Nothing typed here is treated as proof of who anyone is.
*/

const CATEGORIES = [
  "A card's rates or fees look wrong",
  "Something is broken",
  "The result confused me",
  "An idea for what to build next",
  "General feedback",
  "Something else",
] as const;

const FIELD =
  "w-full rounded-[var(--radius-md)] border border-line bg-surface-2 px-4 py-3 text-sm text-fg " +
  "outline-none transition-colors placeholder:text-faint focus:border-line-strong focus:ring-2 focus:ring-flame/40";

type Status = "idle" | "sending" | "sent" | "error";

export function SuggestionForm() {
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [message, setMessage] = useState("");
  const [context, setContext] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — see the route
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const canSubmit = message.trim() !== "" && status !== "sending";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus("sending");
    setError("");

    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message, context, replyTo, website }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        // why the server's message is shown verbatim: it distinguishes "too long"
        // from "not configured" from "slow down", and each needs a different
        // response from the reader. A generic failure string hides all three.
        setError(data?.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }

      setStatus("sent");
      setMessage("");
      setContext("");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setStatus("error");
    }
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(SUGGESTIONS_EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // why swallowed: clipboard access can be refused by permissions policy or
      // an insecure context. The address is already on screen as selectable
      // text, so the fallback is that the reader selects it by hand.
    }
  }

  if (status === "sent") {
    return (
      <div className="py-4 text-center">
        <span className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-full border border-oasis/30 bg-oasis/10 text-oasis">
          <Check className="h-5 w-5" />
        </span>
        <h3 className="text-xl font-semibold text-fg">Sent — thank you.</h3>
        <p className="mx-auto mt-3 max-w-sm text-muted">
          It landed in a real inbox and it will be read. If you left an address we&apos;ll
          reply when there&apos;s something worth saying.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-black/[0.04]"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="category" className="block text-sm text-muted">
          What&apos;s this about?
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
          maxLength={4000}
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
          maxLength={200}
          placeholder="e.g. the results page, or the ADCB Traveller card"
          className={`mt-2 ${FIELD}`}
        />
      </div>

      <div>
        <label htmlFor="replyTo" className="block text-sm text-muted">
          Your email <span className="text-faint">(optional - only if you want a reply)</span>
        </label>
        <input
          id="replyTo"
          type="email"
          value={replyTo}
          onChange={(e) => setReplyTo(e.target.value)}
          maxLength={254}
          placeholder="you@example.com"
          className={`mt-2 ${FIELD}`}
        />
        <p className="mt-2 text-xs text-faint">
          If you&apos;re signed in we already know your address and you can leave this
          blank.
        </p>
      </div>

      {/*
        Honeypot. Hidden from people, filled in by form bots. Not `display:none`,
        which some bots skip — it's pushed off-screen instead, and excluded from
        the tab order and the accessibility tree so nobody meets it by accident.
      */}
      <div className="absolute left-[-9999px]" aria-hidden>
        <label htmlFor="website">Leave this field empty</label>
        <input
          id="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {status === "error" && (
        <p role="alert" className="rounded-[var(--radius-md)] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="pt-1">
        <Button type="submit" size="lg" disabled={!canSubmit}>
          <Send className="h-4 w-4" />
          {status === "sending" ? "Sending…" : "Send"}
        </Button>
        <p aria-live="polite" className="mt-3 text-sm text-faint">
          {status === "sending" ? "Sending your message…" : "Goes straight to our inbox."}
        </p>
      </div>

      <div className="border-t border-line pt-5">
        <p className="text-sm text-muted">
          Prefer your own email client?{" "}
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
