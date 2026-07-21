import { cn } from "@/lib/cn";
import { cardSkin } from "@/lib/card-design";

/*
  CreditCardArt — renders a card face that mirrors how the real UAE card looks:
  the issuing bank / co-brand program's actual brand colors, wordmark, tier and
  payment network, instead of a generic gradient. The palette + program logic
  lives in lib/card-design.ts (real third-party brand colors, isolated there).

  We deliberately don't reproduce trademarked bank *logos* as raster art (we
  ship no such assets); we recreate the brand's color scheme + typographic
  wordmark + the real network mark, which reads as the actual card.
*/

export function CreditCardArt({
  bank,
  name,
  tier,
  highlight,
  network,
  currency,
  className,
}: {
  bank: string;
  name: string;
  tier?: string;
  highlight?: string;
  network?: string;
  currency?: string;
  className?: string;
}) {
  const skin = cardSkin({ bank, name, currency });

  return (
    <div
      className={cn(
        "relative aspect-[1.586/1] w-full overflow-hidden rounded-[var(--radius-lg)] p-5 text-white",
        "border border-white/15 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]",
        className,
      )}
      style={{ background: skin.bg }}
    >
      <Motif kind={skin.motif} />
      {/* top-light sheen for the plastic/metal look */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(130%_90%_at_0%_0%,rgba(255,255,255,0.28),transparent_46%)]" />

      <div className="relative flex h-full flex-col justify-between">
        {/* Bank + program wordmark, tier badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold uppercase tracking-[0.14em] text-white drop-shadow-sm">
              {skin.brand}
            </p>
            {skin.program ? (
              <p
                className="mt-0.5 truncate text-xs font-medium tracking-wide"
                style={{ color: skin.accent }}
              >
                {skin.program}
              </p>
            ) : null}
          </div>
          {tier ? (
            <span
              className="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide backdrop-blur"
              style={{ borderColor: hexA(skin.accent, 0.5), color: skin.accent }}
            >
              {tier}
            </span>
          ) : null}
        </div>

        {/* Chip + contactless */}
        <div className="flex items-center gap-3">
          <Chip tone={skin.chip ?? "gold"} />
          <Contactless />
        </div>

        {/* Number + network */}
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-sm tracking-[0.18em] text-white/85">•••• 8842</p>
            {highlight ? (
              <p className="mt-1 truncate text-xs font-medium text-white/90">{highlight}</p>
            ) : null}
          </div>
          <NetworkMark network={network} />
        </div>
      </div>
    </div>
  );
}

/* ---- Decorative brand motifs -------------------------------------------- */
function Motif({ kind }: { kind?: string }) {
  if (kind === "arc") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-70">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full border-[24px] border-white/10" />
        <div className="absolute -right-4 top-6 h-40 w-40 rounded-full border-[16px] border-white/10" />
      </div>
    );
  }
  if (kind === "waves") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-60">
        <div className="absolute -bottom-24 -right-10 h-56 w-[130%] rotate-[-8deg] rounded-[50%] bg-white/10" />
        <div className="absolute -bottom-16 -right-10 h-56 w-[130%] rotate-[-8deg] rounded-[50%] bg-white/[0.06]" />
      </div>
    );
  }
  if (kind === "hex") {
    return (
      <div className="pointer-events-none absolute -right-8 -top-8 opacity-25">
        <div className="h-40 w-40 rotate-12 bg-white/10 [clip-path:polygon(25%_0,75%_0,100%_50%,75%_100%,25%_100%,0_50%)]" />
      </div>
    );
  }
  // default: diagonal sheen streak
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-70">
      <div className="absolute -inset-y-8 left-1/3 w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/12 to-transparent" />
    </div>
  );
}

/* ---- EMV chip ------------------------------------------------------------ */
function Chip({ tone }: { tone: "gold" | "silver" }) {
  const grad =
    tone === "silver"
      ? "linear-gradient(135deg,#e9edf2,#aeb4bd)"
      : "linear-gradient(135deg,#f7e39b,#c8a03a)";
  return (
    <div
      className="relative h-8 w-11 shrink-0 rounded-md shadow-inner"
      style={{ background: grad }}
    >
      {/* contact lines */}
      <div className="absolute inset-1.5 rounded-sm border border-black/20" />
      <div className="absolute left-1.5 right-1.5 top-1/2 h-px -translate-y-1/2 bg-black/25" />
      <div className="absolute inset-y-1.5 left-1/2 w-px -translate-x-1/2 bg-black/25" />
    </div>
  );
}

/* ---- Contactless glyph --------------------------------------------------- */
function Contactless() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-white/70" fill="none">
      <path d="M8 6a10 10 0 0 1 0 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 4a14 14 0 0 1 0 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16 2a18 18 0 0 1 0 20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* ---- Payment network marks ---------------------------------------------- */
function NetworkMark({ network }: { network?: string }) {
  const n = (network ?? "").toLowerCase();
  if (n.includes("diners")) return <DinersMark />;
  if (n.includes("mastercard")) return <MastercardMark />;
  // Visa is by far the most common network in the dataset.
  return <VisaMark />;
}

function VisaMark() {
  return (
    <span className="select-none font-display text-lg font-bold italic tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
      VISA
    </span>
  );
}

function MastercardMark() {
  return (
    <div className="flex items-center">
      <span className="h-6 w-6 rounded-full bg-[#eb001b]" />
      <span className="-ml-3 h-6 w-6 rounded-full bg-[#f79e1b] mix-blend-hard-light" />
    </div>
  );
}

function DinersMark() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative h-6 w-6 overflow-hidden rounded-full bg-white ring-2 ring-[#0a3d91]">
        <span className="absolute inset-y-0 left-0 w-1/2 bg-[#0a3d91]" />
        <span className="absolute inset-[3px] rounded-full border-2 border-white" />
      </span>
      <span className="text-[9px] font-semibold uppercase leading-tight tracking-wide text-white/80">
        Diners
        <br />
        Club
      </span>
    </div>
  );
}

/* Convert a #rrggbb (or a keyword we control) to an rgba() string. */
function hexA(hex: string, alpha: number): string {
  if (!hex.startsWith("#") || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
