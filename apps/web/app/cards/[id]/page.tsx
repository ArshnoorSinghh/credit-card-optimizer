"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Check, TriangleAlert, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CreditCardArt } from "@/components/credit-card-art";
import { cardById } from "@/lib/cards";
import { aed, label } from "@/lib/format";

const ART_GRADIENT: Record<string, string> = {
  cashback: "from-emerald-400 via-teal-500 to-sky",
  points: "from-violet via-indigo to-sky",
  miles: "from-sky via-indigo to-violet",
};

function cap(monthly: number | null, annual: number | null): string {
  if (monthly) return `${monthly.toLocaleString()}/mo cap`;
  if (annual) return `${annual.toLocaleString()}/yr cap`;
  return "Uncapped";
}

export default function CardDetailPage() {
  const params = useParams<{ id: string }>();
  const card = cardById(params.id);

  if (!card) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-24 text-center">
        <h1 className="text-3xl font-semibold">Card not found</h1>
        <p className="mt-3 text-muted">We couldn&apos;t find a card with that id.</p>
        <Link href="/cards" className="mt-6 inline-block">
          <Button variant="outline">Back to all cards</Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="relative mx-auto max-w-5xl px-5 py-12">
      <Link href="/cards" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        All cards
      </Link>

      <div className="mt-6 grid gap-8 md:grid-cols-[340px_1fr]">
        {/* Left: art + quick facts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-5 md:sticky md:top-24 md:self-start"
        >
          <CreditCardArt
            bank={card.bank}
            name={card.name}
            tier={card.tier}
            network={card.network}
            gradient={ART_GRADIENT[card.rewards.type] ?? "from-violet via-indigo to-sky"}
          />
          <Card className="space-y-3">
            <Fact k="Annual fee">
              {card.fees.annual_fee_aed === 0 ? (
                <span className="text-success">Free for life</span>
              ) : (
                aed(card.fees.annual_fee_aed)
              )}
            </Fact>
            <Fact k="Min salary">{aed(card.eligibility.min_monthly_salary_aed)}/mo</Fact>
            <Fact k="Rewards in">{card.rewards.currency}</Fact>
            <Fact k="Network">{card.network}</Fact>
            <Fact k="Salary transfer">
              {card.eligibility.salary_transfer_required ? "Required" : "Not required"}
            </Fact>
          </Card>
          <Link href="/optimizer">
            <Button className="w-full">Optimize with this card</Button>
          </Link>
        </motion.div>

        {/* Right: details */}
        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{card.bank}</Badge>
              <Badge tone="brand">{label(card.rewards.type)}</Badge>
              {card.excluded_from_scoring && <Badge tone="warning">Pending verification</Badge>}
            </div>
            <h1 className="mt-4 text-4xl font-semibold">{card.name}</h1>
            <p className="mt-2 text-muted">Headline rate: {card.rewards.base_rate}</p>
          </div>

          {card.data_caveat && (
            <Card className="border-warning/30 bg-warning/5">
              <div className="flex gap-3">
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <div>
                  <p className="font-medium text-fg">Data caveat</p>
                  <p className="mt-1 text-sm text-muted">{card.data_caveat}</p>
                </div>
              </div>
            </Card>
          )}

          {/* Reward categories */}
          <Card>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-faint">
              Reward rates
            </h3>
            <div className="overflow-hidden rounded-[var(--radius-md)] border border-line">
              {card.rewards.categories.map((cat, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-4 border-b border-line bg-surface-2/40 px-4 py-3 last:border-0"
                >
                  <span className="font-medium text-fg">{label(cat.category)}</span>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-fg">{cat.rate}</span>
                    <span className="text-faint">{cap(cat.monthly_cap, cat.annual_cap)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Fees + eligibility */}
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-faint">Fees</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between">
                  <span className="text-muted">Annual</span>
                  <span className="text-fg">
                    {card.fees.annual_fee_aed === 0 ? "None" : aed(card.fees.annual_fee_aed)}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted">Joining</span>
                  <span className="text-fg">
                    {card.fees.joining_fee_aed === 0 ? "None" : aed(card.fees.joining_fee_aed)}
                  </span>
                </li>
                {card.fees.waiver_conditions && (
                  <li className="pt-1 text-muted">Waiver: {card.fees.waiver_conditions}</li>
                )}
              </ul>
            </Card>
            <Card>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-faint">
                Redemption
              </h3>
              <div className="flex flex-wrap gap-2">
                {card.redemption.primary_uses.map((u, i) => (
                  <Badge key={i} tone="neutral">
                    {u}
                  </Badge>
                ))}
              </div>
              {card.redemption.redemption_url && (
                <a
                  href={card.redemption.redemption_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm text-violet hover:underline"
                >
                  Redemption details <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </Card>
          </div>

          {/* Benefits */}
          {card.benefits.length > 0 && (
            <Card>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-faint">
                Benefits
              </h3>
              <ul className="grid gap-2.5 sm:grid-cols-2">
                {card.benefits.map((b, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {b}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {card.source_url && (
            <a
              href={card.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-faint hover:text-muted"
            >
              Source <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </main>
  );
}

function Fact({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{k}</span>
      <span className="font-medium text-fg">{children}</span>
    </div>
  );
}
