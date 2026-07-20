import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Space_Grotesk } from "next/font/google";
import { CursorGlow } from "@/components/cursor-glow";
import { Navbar } from "@/components/navbar";

// Display face for headings (geometric, confident) + a clean body face. Exposed
// as CSS variables that globals.css maps onto --font-display / --font-sans.
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fils — Smarter UAE credit cards",
  description:
    "Model your spending, find your best 1–3 card portfolio, and make every point count. UAE credit-card optimization.",
};

// Dark theme for Clerk's hosted UI so sign-in/sign-up match the product.
// why: the color variables below are the source of truth — Clerk derives every
// text/border/muted shade from them, so setting them correctly (bright fg,
// legible secondary) guarantees contrast on our near-black canvas. The element
// overrides only sharpen a few pieces that otherwise render too dim.
const clerkAppearance = {
  variables: {
    colorPrimary: "#7c6cff",
    // Surface the Clerk card ABOVE the page canvas so it reads as a distinct
    // panel instead of blending into the background.
    colorBackground: "#14141f",
    colorText: "#f4f4f7",
    // Brighter than the old #a6a6b4 — labels, hints and the "or" divider were
    // too dim against the dark card.
    colorTextSecondary: "#c9c9d4",
    colorInputBackground: "#1c1c2a",
    colorInputText: "#f4f4f7",
    colorNeutral: "#ffffff",
    colorDanger: "#fb7185",
    colorSuccess: "#34d399",
    borderRadius: "0.75rem",
    fontSize: "0.95rem",
  },
  elements: {
    // Distinct, elevated panel so it doesn't merge with the page background.
    card: "bg-[#14141f] border border-white/10 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.85)]",
    headerTitle: "text-fg",
    headerSubtitle: "text-[#c9c9d4]",
    socialButtonsBlockButton: "border-white/12 text-fg hover:bg-white/5",
    socialButtonsBlockButtonText: "text-fg font-medium",
    dividerLine: "bg-white/12",
    dividerText: "text-[#c9c9d4]",
    formFieldLabel: "text-[#e4e4ea] font-medium",
    formFieldInput: "bg-[#1c1c2a] border-white/12 text-fg placeholder:text-[#8a8a98]",
    formFieldInputShowPasswordButton: "text-[#c9c9d4] hover:text-fg",
    formFieldHintText: "text-[#c9c9d4]",
    identityPreviewText: "text-fg",
    identityPreviewEditButton: "text-violet",
    footer: "bg-transparent",
    footerActionText: "text-[#c9c9d4]",
    footerActionLink: "text-violet hover:text-violet/80 font-medium",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen bg-bg text-fg antialiased">
        <ClerkProvider appearance={clerkAppearance}>
          <CursorGlow />
          <div className="relative z-10">
            <Navbar />
            {children}
          </div>
        </ClerkProvider>
      </body>
    </html>
  );
}
