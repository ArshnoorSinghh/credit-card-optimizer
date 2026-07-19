import { cn } from "@/lib/cn";

/*
  CreditCardArt — a stylized, brand-neutral credit-card visual (no real logos).
  Used for hero decoration and as the thumbnail in the card browser. Pure
  presentational; pass the display fields you have.
*/

export function CreditCardArt({
  bank,
  name,
  tier,
  highlight,
  network,
  gradient = "from-violet via-indigo to-sky",
  className,
}: {
  bank: string;
  name: string;
  tier?: string;
  highlight?: string;
  network?: string;
  gradient?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-[1.586/1] w-full overflow-hidden rounded-[var(--radius-lg)] p-5 text-white",
        "border border-white/15 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]",
        "bg-linear-to-br",
        gradient,
        className,
      )}
    >
      {/* sheen */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,rgba(255,255,255,0.28),transparent_45%)]" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-white/80">{bank}</p>
            <p className="mt-0.5 text-lg font-semibold leading-tight">{name}</p>
          </div>
          {tier ? (
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide backdrop-blur">
              {tier}
            </span>
          ) : null}
        </div>

        {/* chip */}
        <div className="h-8 w-11 rounded-md bg-linear-to-br from-yellow-200/90 to-yellow-500/80 shadow-inner" />

        <div className="flex items-end justify-between">
          <p className="font-mono text-sm tracking-[0.2em] text-white/85">•••• •••• •••• 8842</p>
          <div className="text-right">
            {highlight ? <p className="text-sm font-semibold">{highlight}</p> : null}
            {network ? (
              <p className="text-[10px] uppercase tracking-widest text-white/70">{network}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
