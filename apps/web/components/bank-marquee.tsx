import { BANKS } from "@/lib/cards";

/*
  BankMarquee — an infinite ticker of the UAE banks Fils covers. A nod to
  Revolut's currency ticker, reinterpreted as "every bank in one place." The
  list is rendered twice so the -50% translate loops seamlessly; edges fade into
  the canvas. Pure CSS motion (settles static under reduced-motion).
*/

export function BankMarquee() {
  const items = [...BANKS, ...BANKS];
  return (
    <div className="relative overflow-hidden border-y border-line bg-bg-soft/50 py-5">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-28 bg-gradient-to-r from-bg-soft to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-28 bg-gradient-to-l from-bg-soft to-transparent" />
      <div className="flex w-max items-center gap-10 pr-10 animate-[marquee_38s_linear_infinite]">
        {items.map((bank, i) => (
          <span key={i} className="flex items-center gap-10 whitespace-nowrap">
            <span className="text-sm font-medium uppercase tracking-[0.18em] text-faint">{bank}</span>
            <span className="h-1 w-1 rounded-full bg-flame/50" />
          </span>
        ))}
      </div>
    </div>
  );
}
