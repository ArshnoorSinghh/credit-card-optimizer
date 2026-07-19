"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Show, UserButton } from "@clerk/nextjs";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/*
  Navbar — sticky, glass, condenses on scroll. The auth controls are an
  INVITATION not a gate (guest/demo stays usable signed-out), preserving the
  existing layout's intent. Clerk's <UserButton> is themed dark via layout's
  appearance prop.
*/

const LINKS = [
  { href: "/cards", label: "Cards" },
  { href: "/optimizer", label: "Card Optimizer" },
  { href: "/points", label: "Points" },
  { href: "/dashboard", label: "Wallet" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled ? "glass border-b border-line" : "border-b border-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-sm text-muted transition-colors hover:bg-white/5 hover:text-fg"
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
        </div>
      </nav>
    </motion.header>
  );
}
