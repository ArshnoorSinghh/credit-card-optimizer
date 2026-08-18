"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CircleHelp,
  Gauge,
  Plane,
  Receipt,
  TrendingDown,
} from "lucide-react";
import { Aurora } from "@/components/aurora";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/reveal";
import { aed, label as prettyLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useProfileStore } from "@/lib/profile-store";
import { DEFAULT_HOLDINGS } from "@/lib/redemptions";
import {
  groupByMonth,
  relativeDays,
  runCalendar,
  todayIso,
  shortDate,
  type DeadlineEvent,
} from "@/lib/calendar";
import type { DeadlineKind } from "@fils/engine";

/*
  Deadline calendar — wired to the real engine.

  Every date, AED figure and caveat comes from deadlineCalendar / capThresholds via
  lib/calendar.ts. Nothing is computed here; the page only arranges what the engine
  returns. The two "we don't know" lists (undated deadlines, unstated thresholds) are
  rendered as first-class content rather than hidden — an empty calendar must never
  read as "nothing is coming up" when the truth is "nobody has told us yet".

  WHERE THE DATES COME FROM: the user's own holdings and card opening dates, held in
  the profile store. "Fill in your calendar" below is how they get there - every input
  writes one date the engine named, and an unanswered one stays undated rather than
  being guessed.

  LIMIT, stated on the screen itself: the profile store keeps these in sessionStorage,
  because /api/profile has no column for either yet (the same position merchantShares
  is in). They survive navigation between screens but not a new session. Persisting
  them needs a Prisma migration - see CALENDAR_SPEC.md §6.

  A guest who has entered nothing still sees the sample inventory, marked as such. A
  signed-in user never does.
*/

const KIND_META: Record<DeadlineKind, { label: string; icon: typeof Plane; tone: string }> = {
  points_expiry: { label: "Points expiry", icon: Plane, tone: "text-clay" },
  devaluation: { label: "Devaluation", icon: TrendingDown, tone: "text-clay" },
  fee_renewal: { label: "Annual fee", icon: Receipt, tone: "text-clay" },
};

/** Urgency is read off the engine's `daysAway` — never a word the page invents. */
function urgencyTone(daysAway: number): { ring: string; dot: string } {
  if (daysAway < 0) return { ring: "border-danger/30", dot: "bg-danger" };
  if (daysAway <= 30) return { ring: "border-warning/30", dot: "bg-warning" };
  return { ring: "border-line", dot: "bg-flame" };
}

function EventRow({ event }: { event: DeadlineEvent }) {
  const meta = KIND_META[event.kind];
  const Icon = meta.icon;
  const tone = urgencyTone(event.daysAway);

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={cn(
        "flex gap-4 rounded-[var(--radius-md)] border bg-surface-2/40 p-4",
        tone.ring,
      )}
    >
      <div className="flex w-16 shrink-0 flex-col items-center justify-center border-r border-line pr-3">
        <span className="text-sm font-semibold tabular-nums text-fg">{shortDate(event.date)}</span>
        <span className="mt-0.5 text-[0.65rem] text-faint">{relativeDays(event.daysAway)}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Icon className={cn("h-4 w-4 shrink-0", meta.tone)} aria-hidden />
          <p className="text-base font-semibold text-fg">{event.title}</p>
          <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} aria-hidden />
          {/*
            The certainty tier is shown as a visible label, not a tooltip. A projected
            date is an estimate off program policy and the user has to be able to see
            that at a glance, next to the date it qualifies.
          */}
          {event.certainty === "projected" && (
            <Badge tone="warning">Estimated date</Badge>
          )}
        </div>

        <p className="mt-1.5 text-sm text-muted">{event.detail}</p>

        {event.action && (
          <p className="mt-2 text-sm font-medium text-fg">{event.action}</p>
        )}

        {event.valueAtRiskAed !== undefined && (
          <p className="mt-2 text-xs text-faint tabular-nums">
            {aed(event.valueAtRiskAed)} at stake
          </p>
        )}

        {event.flags.length > 0 && (
          <ul className="mt-2 space-y-1">
            {event.flags.map((f, i) => (
              <li key={i} className="text-xs leading-relaxed text-faint">
                {f}
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}

export default function CalendarPage() {
  const { state, ready, signedIn, save } = useProfileStore();
  /*
    The user's OWN holdings when they have entered any, and only then. This screen
    used to pass DEFAULT_HOLDINGS unconditionally, so every balance and every AED
    at-risk figure on it belonged to a fixture rather than to the reader.

    A guest who has entered nothing still sees the demo inventory, clearly marked, so
    the page demonstrates something on arrival. A signed-in user never does: sample
    balances under "your deadlines" read as their own, and the whole point of this
    screen is that its dates can be trusted.
  */
  const usingDemoHoldings = state.pointsHoldings.length === 0 && !signedIn;
  const holdings = usingDemoHoldings ? DEFAULT_HOLDINGS : state.pointsHoldings;

  const view = useMemo(() => {
    if (!ready) return null;
    return runCalendar({
      holdings,
      cardIds: state.cardIds,
      spending: state.spending,
      openedOn: state.cardOpenedOn,
    });
  }, [ready, holdings, state.cardIds, state.spending, state.cardOpenedOn]);

  /*
    What the engine could not date, expressed as the app's own state so the inputs
    below can write to it. Derived from OUR record rather than parsed back out of the
    engine's `undated` prompts: those are prose for the reader, not identifiers, and
    matching on them would break the moment the wording changed.
  */
  const cardsNeedingOpenedOn = useMemo(
    () => (view ? view.heldCards.filter((h) => h.openedOn === undefined) : []),
    [view],
  );
  // Only the user's real holdings are editable. Demo balances belong to a fixture,
  // so offering to date them would invite answering a question about someone else's
  // points and then seeing the answer vanish.
  const holdingsNeedingExpiry = useMemo(
    () => (usingDemoHoldings ? [] : state.pointsHoldings.filter((h) => h.expiryDate === undefined)),
    [usingDemoHoldings, state.pointsHoldings],
  );

  /** Record (or clear) the date a card was opened with the bank. */
  function setOpenedOn(cardId: string, value: string): void {
    const next = { ...state.cardOpenedOn };
    // Clearing the field must REMOVE the key, not store "". An empty string is not a
    // date, and leaving one behind would mean the card never appears in this list
    // again while still producing an undated deadline the reader cannot fix.
    if (value === "") delete next[cardId];
    else next[cardId] = value;
    save({ cardOpenedOn: next });
  }

  /** Record (or clear) a points expiry the user has looked up. */
  function setHoldingExpiry(currency: string, value: string): void {
    save({
      pointsHoldings: state.pointsHoldings.map((h) => {
        if (h.currency !== currency) return h;
        if (value === "") {
          const { expiryDate: _dropped, ...rest } = h;
          return rest;
        }
        return { ...h, expiryDate: value };
      }),
    });
  }

  const groups = useMemo(() => (view ? groupByMonth(view.calendar.events) : []), [view]);

  const totalAtStake = useMemo(
    () =>
      view
        ? view.calendar.events.reduce((sum, e) => sum + (e.valueAtRiskAed ?? 0), 0)
        : 0,
    [view],
  );

  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <Aurora subtle className="opacity-40" />
      <div className="relative mx-auto max-w-5xl px-5 py-12">
        <Reveal>
          <Badge tone="brand">Deadline Calendar</Badge>
          <h1 className="mt-4 font-display text-4xl font-semibold md:text-5xl">
            What you lose by forgetting
          </h1>
          <p className="mt-3 max-w-xl text-muted">
            Points that expire, programs that devalue, and annual fees that renew - on one
            timeline, with what to do about each. Dates come from your own records or from
            published program policy. We never invent one.
          </p>
        </Reveal>

        {!view ? (
          <p className="mt-10 text-muted">Loading your profile…</p>
        ) : (
          <>
            {/* ── Summary strip ───────────────────────────────────────────── */}
            <Reveal>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <Card className="p-5">
                  <p className="text-xs uppercase tracking-wide text-faint">Next 12 months</p>
                  <p className="mt-1 font-display text-3xl font-semibold tabular-nums">
                    {view.calendar.events.length}
                  </p>
                  <p className="mt-1 text-sm text-muted">dated deadlines</p>
                </Card>
                <Card className="p-5">
                  <p className="text-xs uppercase tracking-wide text-faint">At stake</p>
                  <p className="mt-1 font-display text-3xl font-semibold tabular-nums">
                    {aed(totalAtStake)}
                  </p>
                  <p className="mt-1 text-sm text-muted">across dated deadlines</p>
                </Card>
                <Card className="p-5">
                  <p className="text-xs uppercase tracking-wide text-faint">Can&apos;t date yet</p>
                  <p className="mt-1 font-display text-3xl font-semibold tabular-nums">
                    {view.calendar.undated.length}
                  </p>
                  <p className="mt-1 text-sm text-muted">waiting on one answer each</p>
                </Card>
              </div>
            </Reveal>

            {/* ── Demo-data notice ────────────────────────────────────────── */}
            {usingDemoHoldings && (
              <Reveal>
                <p className="mt-5 rounded-[var(--radius-md)] border border-dashed border-line bg-surface-2/40 px-4 py-3 text-sm text-muted">
                  <span className="font-medium text-fg">Sample holdings.</span> You haven&apos;t
                  told us what points you hold, so this timeline uses the same example inventory
                  as the points screen. Add your own and every figure here becomes yours. Your
                  cards and spending already are.{" "}
                  <Link href="/points" className="text-clay underline underline-offset-2">
                    Edit holdings on the points screen
                  </Link>
                  .
                </p>
              </Reveal>
            )}

            {/* ── Engine-level flags ──────────────────────────────────────── */}
            {view.calendar.flags.length > 0 && (
              <Reveal>
                <Card className="mt-5 border-warning/30 bg-warning/[0.06] p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
                    <ul className="space-y-1.5">
                      {view.calendar.flags.map((f, i) => (
                        <li key={i} className="text-sm leading-relaxed text-muted">
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              </Reveal>
            )}

            {/* ── The timeline ────────────────────────────────────────────── */}
            <section className="mt-12">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-clay" aria-hidden />
                <h2 className="font-display text-2xl font-semibold">Timeline</h2>
              </div>

              {groups.length === 0 ? (
                <Card className="mt-5 p-6">
                  <p className="text-muted">
                    Nothing dated in the next 12 months.{" "}
                    {view.calendar.undated.length > 0 && (
                      <>
                        That is not the same as nothing coming up - there{" "}
                        {view.calendar.undated.length === 1 ? "is" : "are"}{" "}
                        {view.calendar.undated.length} deadline
                        {view.calendar.undated.length === 1 ? "" : "s"} below we can&apos;t date
                        yet.
                      </>
                    )}
                  </p>
                </Card>
              ) : (
                <div className="mt-5 space-y-8">
                  {groups.map((g) => (
                    <div key={g.key}>
                      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-faint">
                        {g.label}
                      </h3>
                      <Stagger>
                        <div className="space-y-3">
                          {g.events.map((e, i) => (
                            <StaggerItem key={`${e.kind}-${e.date}-${i}`}>
                              <EventRow event={e} />
                            </StaggerItem>
                          ))}
                        </div>
                      </Stagger>
                    </div>
                  ))}
                </div>
              )}

              {view.calendar.beyondHorizon > 0 && (
                <p className="mt-4 text-sm text-faint">
                  {view.calendar.beyondHorizon} further deadline
                  {view.calendar.beyondHorizon === 1 ? "" : "s"} fall beyond the next 12 months.
                </p>
              )}
            </section>

            {/* ── Undated: the honest half ────────────────────────────────── */}
            {view.calendar.undated.length > 0 && (
              <section className="mt-14">
                <div className="flex items-center gap-2">
                  <CircleHelp className="h-5 w-5 text-clay" aria-hidden />
                  <h2 className="font-display text-2xl font-semibold">We can&apos;t date these yet</h2>
                </div>
                <p className="mt-2 max-w-2xl text-muted">
                  These deadlines are real - we just don&apos;t have the one date each needs. They
                  are listed rather than hidden, because an empty calendar would otherwise read as
                  &ldquo;nothing is coming up&rdquo;.
                </p>
                <Stagger>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {view.calendar.undated.map((u, i) => (
                      <StaggerItem key={`${u.kind}-${i}`}>
                        <Card className="h-full p-5">
                          <p className="text-base font-semibold text-fg">{u.title}</p>
                          <p className="mt-1.5 text-sm text-muted">{u.reason}</p>
                          <p className="mt-3 text-sm font-medium text-clay">{u.prompt}</p>
                        </Card>
                      </StaggerItem>
                    ))}
                  </div>
                </Stagger>
              </section>
            )}

            {/*
              ── Turning the questions into answers ────────────────────────
              The list above states what we cannot date. This is where the reader
              fixes it. Every input writes one date the engine asked for by name, and
              nothing here computes or defaults anything: an empty field stays empty
              and its deadline stays undated.
            */}
            {(cardsNeedingOpenedOn.length > 0 || holdingsNeedingExpiry.length > 0) && (
              <section className="mt-14">
                <div className="flex items-center gap-2">
                  <CircleHelp className="h-5 w-5 text-clay" aria-hidden />
                  <h2 className="font-display text-2xl font-semibold">Fill in your calendar</h2>
                </div>
                <p className="mt-2 max-w-2xl text-muted">
                  Each date you add here turns one of the deadlines above into a real one, with
                  the amount at stake. We never guess these.
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {cardsNeedingOpenedOn.map((held) => (
                    <Card key={held.card.id} className="p-5">
                      <p className="text-base font-semibold text-fg">{held.card.name}</p>
                      <p className="mt-1.5 text-sm text-muted">
                        When did you open this card with the bank? That sets the renewal date its
                        annual fee falls on.
                      </p>
                      <input
                        type="date"
                        value={state.cardOpenedOn[held.card.id] ?? ""}
                        max={todayIso()}
                        onChange={(e) => setOpenedOn(held.card.id, e.target.value)}
                        aria-label={`Date you opened ${held.card.name}`}
                        className="mt-3 w-full rounded-[var(--radius-md)] border border-line bg-surface-2 px-2 py-1.5 text-sm text-fg outline-none focus:border-line-strong"
                      />
                    </Card>
                  ))}
                  {holdingsNeedingExpiry.map((h) => (
                    <Card key={h.currency} className="p-5">
                      <p className="text-base font-semibold text-fg">
                        {h.balance.toLocaleString("en-US")} {h.currency}
                      </p>
                      <p className="mt-1.5 text-sm text-muted">
                        When do these expire? If you only know when you earned them, your bank&apos;s
                        statement will show the expiry.
                      </p>
                      <input
                        type="date"
                        value={h.expiryDate ?? ""}
                        onChange={(e) => setHoldingExpiry(h.currency, e.target.value)}
                        aria-label={`Expiry date for ${h.currency}`}
                        className="mt-3 w-full rounded-[var(--radius-md)] border border-line bg-surface-2 px-2 py-1.5 text-sm text-fg outline-none focus:border-line-strong"
                      />
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* ── Spend thresholds: deliberately NOT on the timeline ──────── */}
            <section className="mt-14">
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-clay" aria-hidden />
                <h2 className="font-display text-2xl font-semibold">Spend thresholds</h2>
              </div>
              <p className="mt-2 max-w-2xl text-muted">
                Not dates. A monthly cap binds after a certain amount of spend, and when that
                happens depends on how you actually spend - so we give you the amount, which is
                exact, rather than a guessed day of the month.
              </p>

              {view.thresholds.thresholds.length === 0 ? (
                <Card className="mt-5 p-6">
                  <p className="text-muted">
                    None of the cards on your profile have a capped bonus your spending reaches.
                    {view.heldCards.length === 0 && " Add the cards you hold to see this."}
                  </p>
                  {view.heldCards.length === 0 && (
                    <Link href="/dashboard" className="mt-4 inline-block">
                      <Button variant="outline">
                        Add your cards
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </Card>
              ) : (
                <Stagger>
                  <div className="mt-5 space-y-3">
                    {view.thresholds.thresholds.map((t, i) => (
                      <StaggerItem key={`${t.cardId}-${t.cardCategory}-${t.period}-${i}`}>
                        <Card
                          className={cn(
                            "p-5",
                            t.reached && "border-warning/30 bg-warning/[0.05]",
                          )}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-fg">{t.cardName}</p>
                            <Badge tone={t.reached ? "warning" : "neutral"}>
                              {t.reached ? "You reach this" : "Not reached"}
                            </Badge>
                            <span className="text-xs uppercase tracking-wide text-faint">
                              {t.period}
                            </span>
                          </div>
                          <p className="mt-1.5 text-sm text-muted">{t.detail}</p>
                          {t.switchTo.length > 0 && (
                            <div className="mt-3 space-y-1">
                              {t.switchTo.map((s) => (
                                <p key={s.spendCategory} className="text-sm font-medium text-fg">
                                  After that, put {prettyLabel(s.spendCategory).toLowerCase()} on{" "}
                                  <span className="text-clay">{s.cardName}</span>.
                                </p>
                              ))}
                            </div>
                          )}
                          {t.switchTo.length === 0 && (
                            <p className="mt-3 text-sm text-faint">
                              No other card on your profile earns more here.
                            </p>
                          )}
                        </Card>
                      </StaggerItem>
                    ))}
                  </div>
                </Stagger>
              )}

              {/* The thresholds we refused to state, for the same reason as `undated`. */}
              {view.thresholds.unstated.length > 0 && (
                <div className="mt-5 space-y-3">
                  {view.thresholds.unstated.map((u, i) => (
                    <div
                      key={`${u.cardId}-${u.cardCategory}-${i}`}
                      className="rounded-[var(--radius-md)] border border-dashed border-line bg-surface-2/40 p-4"
                    >
                      <p className="text-sm font-medium text-fg">
                        {u.cardName} - {prettyLabel(u.cardCategory).toLowerCase()}
                      </p>
                      <p className="mt-1 text-sm text-muted">{u.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
