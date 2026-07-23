"use client";

import type { ReactNode } from "react";
import { CreditCard, Layers, GitCompareArrows, Coins, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ALL_CARDS } from "@/lib/cards";
import { aed, label } from "@/lib/format";

/*
  RafiqReceipt — renders the STRUCTURED engine result behind a Rafiq reply as a
  readable "receipt", so the real numbers are shown by the engine's data, never by
  parsing the model's prose. Each engine tool has its own shape; we narrow per tool
  and render defensively (optional-chained), so an unexpected shape degrades to
  nothing rather than throwing.
*/

const nameOf = (id: string): string => ALL_CARDS.find((c) => c.id === id)?.name ?? id;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

// ── Shell + rows ─────────────────────────────────────────────────────────────

function Shell({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="mt-3 rounded-[var(--radius-md)] border border-line bg-surface-2/70 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-faint">
        <span className="text-clay">{icon}</span>
        {title}
      </div>
      <div className="space-y-2.5 text-sm">{children}</div>
    </div>
  );
}

function Row({ label: l, value, strong }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted">{l}</span>
      <span className={strong ? "font-semibold tabular-nums text-clay" : "tabular-nums text-fg"}>{value}</span>
    </div>
  );
}

// ── Per-tool receipts ────────────────────────────────────────────────────────

function WhichCardReceipt({ d }: { d: Record<string, unknown> }) {
  const category = typeof d.resolvedCategory === "string" ? d.resolvedCategory : "";
  const merchant = typeof d.merchant === "string" ? d.merchant : null;
  const best = d.bestOwnedCard as Record<string, unknown> | null;
  const unowned = d.bestUnownedCard as Record<string, unknown> | null;
  const bestAnnual = num(best?.annualEarningsAed);

  return (
    <Shell icon={<CreditCard className="h-4 w-4" />} title={`Best card${merchant ? ` · ${merchant}` : category ? ` · ${label(category)}` : ""}`}>
      {best && typeof best.cardName === "string" ? (
        <Row
          label={
            <span>
              <span className="text-fg">{best.cardName}</span>
              {typeof best.bank === "string" && <span className="text-faint"> · {best.bank}</span>}
            </span>
          }
          value={bestAnnual !== null ? `${aed(bestAnnual)}/yr` : "n/a"}
          strong
        />
      ) : (
        <p className="text-muted">{(d.noOwnedCardReason as string) ?? "None of your cards earns extra here."}</p>
      )}

      {unowned && typeof unowned.cardName === "string" && num(unowned.improvementAed) !== null && (
        <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
          <span className="text-muted">
            Not yours: <span className="text-fg">{unowned.cardName}</span>
            {num(unowned.annualFeeAed) !== null && (
              <span className="text-faint"> · fee {aed(num(unowned.annualFeeAed)!)}</span>
            )}
          </span>
          <Badge tone="success">+{aed(num(unowned.improvementAed)!)}/yr</Badge>
        </div>
      )}
    </Shell>
  );
}

function PortfolioReceipt({ d }: { d: Record<string, unknown> }) {
  const best = d.overallBest as Record<string, unknown> | null;
  if (!best) return null;
  const cardIds = Array.isArray(best.cardIds) ? (best.cardIds as string[]) : [];
  const net = num(best.netAnnualValue);
  const year1 = num(best.netAnnualValueYear1);
  const fees = best.totalFees as Record<string, unknown> | undefined;
  const eligible = num(d.eligibleCardCount);
  const total = num(d.totalCardCount);

  return (
    <Shell icon={<Layers className="h-4 w-4" />} title={`Best portfolio · ${cardIds.length} card${cardIds.length === 1 ? "" : "s"}`}>
      <div className="flex flex-wrap gap-1.5">
        {cardIds.map((id) => (
          <span key={id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-flame" />
            <span className="text-fg">{nameOf(id)}</span>
          </span>
        ))}
      </div>
      {net !== null && <Row label="Net value / year" value={`${aed(net)}`} strong />}
      {year1 !== null && <Row label="Year 1 (after waivers)" value={aed(year1)} />}
      {num(fees?.ongoing) !== null && <Row label="Annual fees" value={aed(num(fees?.ongoing)!)} />}
      {eligible !== null && total !== null && (
        <p className="border-t border-line pt-2.5 text-xs text-faint">{eligible} of {total} cards match your profile</p>
      )}
    </Shell>
  );
}

function CompareReceipt({ d }: { d: Record<string, unknown> }) {
  const cards = Array.isArray(d.cards) ? (d.cards as Record<string, unknown>[]) : [];
  if (cards.length === 0) return null;
  const winner = typeof d.winnerOngoing === "string" ? d.winnerOngoing : null;
  const delta = num(d.ongoingDeltaAed);

  return (
    <Shell icon={<GitCompareArrows className="h-4 w-4" />} title="Compared for your spending">
      {cards.map((c, i) => {
        const isWinner = c.cardName === winner;
        return (
          <Row
            key={i}
            label={
              <span className={isWinner ? "text-fg" : ""}>
                {isWinner && <span className="mr-1.5 text-clay">★</span>}
                {typeof c.cardName === "string" ? c.cardName : "n/a"}
                {num(c.annualFeeAed) !== null && <span className="text-faint"> · fee {aed(num(c.annualFeeAed)!)}</span>}
              </span>
            }
            value={num(c.netAnnualValueAed) !== null ? `${aed(num(c.netAnnualValueAed)!)}/yr` : "n/a"}
            strong={isWinner}
          />
        );
      })}
      {winner && delta !== null && (
        <p className="border-t border-line pt-2.5 text-xs text-faint">
          <span className="text-fg">{winner}</span> wins by {aed(delta)}/yr for how you spend.
        </p>
      )}
    </Shell>
  );
}

function RedemptionReceipt({ d }: { d: Record<string, unknown> }) {
  const suggestions = Array.isArray(d.suggestions) ? (d.suggestions as Record<string, unknown>[]) : [];
  const total = num(d.totalAed);
  const goal = typeof d.goal === "string" ? d.goal : "";

  return (
    <Shell icon={<Coins className="h-4 w-4" />} title={`Redemption${goal ? ` · ${label(goal)}` : ""}`}>
      {total !== null && <Row label="Best total value" value={aed(total)} strong />}
      {suggestions.map((s, i) => {
        const best = s.best as Record<string, unknown> | null;
        return (
          <div key={i} className="border-t border-line pt-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-fg">
                {num(s.balance) !== null ? num(s.balance)!.toLocaleString("en-AE") : ""}{" "}
                {typeof s.currency === "string" ? s.currency : ""}
              </span>
              {num(best?.aedValue) !== null && <span className="tabular-nums text-clay">{aed(num(best?.aedValue)!)}</span>}
            </div>
            {typeof s.receipt === "string" && <p className="mt-1 text-xs text-muted">{s.receipt}</p>}
          </div>
        );
      })}
    </Shell>
  );
}

const URGENCY_TONE = { urgent: "danger", soon: "warning", later: "neutral", unknown: "neutral" } as const;

function BurnReceipt({ d }: { d: Record<string, unknown> }) {
  const items = Array.isArray(d.items) ? (d.items as Record<string, unknown>[]) : [];
  if (items.length === 0) return null;

  return (
    <Shell icon={<Flame className="h-4 w-4" />} title="Burn priority">
      {items.map((it, i) => {
        const urgency = (typeof it.urgency === "string" ? it.urgency : "unknown") as keyof typeof URGENCY_TONE;
        const atRisk = num(it.valueAtRiskAed);
        return (
          <div key={i} className="flex items-baseline justify-between gap-3">
            <span className="flex items-center gap-2">
              <Badge tone={URGENCY_TONE[urgency] ?? "neutral"}>{urgency}</Badge>
              <span className="text-fg">
                {num(it.balance) !== null ? num(it.balance)!.toLocaleString("en-AE") : ""}{" "}
                {typeof it.currency === "string" ? it.currency : ""}
              </span>
              {typeof it.expiryDate === "string" && <span className="text-xs text-faint">exp {it.expiryDate}</span>}
            </span>
            {atRisk !== null && <span className="tabular-nums text-fg">{aed(atRisk)}</span>}
          </div>
        );
      })}
    </Shell>
  );
}

export function RafiqReceipt({ tool, data }: { tool: string | null; data: unknown }) {
  if (!tool || data === null || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  switch (tool) {
    case "which_card":
      return <WhichCardReceipt d={d} />;
    case "optimize_portfolio":
      return <PortfolioReceipt d={d} />;
    case "compare_cards":
      return <CompareReceipt d={d} />;
    case "recommend_redemptions":
      return <RedemptionReceipt d={d} />;
    case "burn_priority":
      return <BurnReceipt d={d} />;
    default:
      return null;
  }
}
