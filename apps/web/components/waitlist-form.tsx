"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/*
  Waitlist signup form — the only write path open to the public while Fils is
  invite-only.

  States: idle -> submitting -> done | error. `done` is deliberately terminal and
  identical whether the address was new or already on the list; the API returns the
  same 200 for both on purpose (a different message would let anyone test whether a
  given email had signed up). So the copy says "you're on the list", which is true
  either way.
*/

type Status = "idle" | "submitting" | "done" | "error";

export function WaitlistForm({
  /** Which surface sent them here — recorded so the funnel shows what they wanted. */
  source,
  className,
}: {
  source?: string;
  className?: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "submitting") return; // guard the double-click
    setStatus("submitting");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: source ?? "landing" }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setStatus("done");
      setMessage(data.message ?? "You're on the list.");
    } catch {
      setStatus("error");
      setMessage("Couldn't reach the server. Check your connection and try again.");
    }
  }

  if (status === "done") {
    return (
      <div className={cn("rounded-xl border border-line bg-surface p-5 text-center", className)}>
        <p className="text-fg font-medium">You&apos;re on the list.</p>
        <p className="text-muted mt-1 text-sm">
          We&apos;ll email you when your invite is ready. We&apos;re letting people in gradually so
          we can check every number against real statements first.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={cn("w-full", className)}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="waitlist-email" className="sr-only">
          Email address
        </label>
        <input
          id="waitlist-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          placeholder="you@example.com"
          disabled={status === "submitting"}
          aria-invalid={status === "error"}
          aria-describedby={status === "error" ? "waitlist-error" : undefined}
          className="border-line bg-surface text-fg placeholder:text-muted focus:border-fg/40 min-w-0 flex-1 rounded-xl border px-4 py-3 outline-none disabled:opacity-60"
        />
        <Button type="submit" variant="brand" size="lg" disabled={status === "submitting"}>
          {status === "submitting" ? "Joining…" : "Join the waitlist"}
        </Button>
      </div>
      {status === "error" && (
        <p id="waitlist-error" role="alert" className="mt-2 text-sm text-red-500">
          {message}
        </p>
      )}
    </form>
  );
}
