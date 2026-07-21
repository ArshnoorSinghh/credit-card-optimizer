import Link from "next/link";
import { Logo } from "@/components/logo";

/* Footer — quiet, link-dense, sits on the darkest surface. */

const COLS = [
  {
    title: "Product",
    links: [
      { href: "/optimizer", label: "Card Optimizer" },
      { href: "/points", label: "Points Optimizer" },
      { href: "/cards", label: "Card browser" },
      { href: "/dashboard", label: "My Wallet" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/", label: "About" },
      { href: "/", label: "How it works" },
      { href: "/", label: "Careers" },
      { href: "/", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/terms", label: "Terms" },
      { href: "/legal/cookies", label: "Cookies" },
      { href: "/legal/disclaimer", label: "Financial disclaimer" },
      { href: "/legal/complaints", label: "Complaints" },
      { href: "/legal", label: "All policies" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-bg-soft">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm text-muted">
            The smartest way to pick and use UAE credit cards. Model your spend, find your best
            portfolio, and never leave rewards on the table.
          </p>
        </div>
        {COLS.map((col) => (
          <div key={col.title}>
            <h4 className="mb-3 text-sm font-semibold text-fg">{col.title}</h4>
            <ul className="space-y-2.5">
              {col.links.map((l, i) => (
                <li key={i}>
                  <Link href={l.href} className="text-sm text-muted transition-colors hover:text-fg">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 py-6 text-xs text-faint sm:flex-row">
          <span>© {new Date().getFullYear()} Fils. Built in the UAE.</span>
          <Link href="/legal/disclaimer" className="transition-colors hover:text-fg">
            Rates are modelled estimates — verify with the issuer before applying.
          </Link>
        </div>
      </div>
    </footer>
  );
}
