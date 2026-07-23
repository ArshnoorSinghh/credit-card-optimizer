"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Show, UserButton } from "@clerk/nextjs";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/*
  Navbar — sticky, glass, condenses on scroll. The auth controls are an
  INVITATION not a gate (guest/demo stays usable signed-out), preserving the
  existing layout's intent. Clerk's <UserButton> is themed dark via layout's
  appearance prop.

  On mobile the primary links live in a slide-down drawer behind a hamburger, so
  every destination stays reachable on a phone (not just the demo CTA).
*/

const LINKS = [
  { href: "/cards", label: "Cards" },
  { href: "/optimizer", label: "Card Optimizer" },
  { href: "/points", label: "Points" },
  { href: "/dashboard", label: "Wallet" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the drawer whenever the route changes (a link was followed).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape, and lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled || open ? "glass border-b border-line" : "border-b border-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-sm text-muted transition-colors hover:bg-black/[0.04] hover:text-fg"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Show when="signed-out">
            <Link href="/sign-in" className="hidden sm:block">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link href="/onboarding">
              <Button size="sm">Try the demo</Button>
            </Link>
          </Show>
          <Show when="signed-in">
            <Link href="/dashboard" className="hidden sm:block">
              <Button variant="ghost" size="sm">
                Wallet
              </Button>
            </Link>
            <UserButton />
          </Show>

          {/* Mobile hamburger — toggles the drawer. */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="grid h-9 w-9 place-items-center rounded-full text-fg transition-colors hover:bg-black/[0.04] md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-nav"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-line md:hidden"
          >
            <div className="mx-auto max-w-6xl px-5 py-4">
              <ul className="flex flex-col gap-1">
                {LINKS.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className={cn(
                        "block rounded-[var(--radius-md)] px-4 py-3 text-base transition-colors",
                        pathname === l.href
                          ? "bg-flame/10 font-medium text-fg"
                          : "text-muted hover:bg-black/[0.04] hover:text-fg",
                      )}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <Show when="signed-out">
                <Link href="/sign-in" className="mt-2 block">
                  <Button variant="outline" size="sm" className="w-full">
                    Log in
                  </Button>
                </Link>
              </Show>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
