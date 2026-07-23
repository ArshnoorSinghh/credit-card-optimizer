import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import { CursorGlow } from "@/components/cursor-glow";
import { Navbar } from "@/components/navbar";

// Display: Fraunces — a warm, high-contrast serif that reads "heritage private
// bank" rather than generic-SaaS. Body: Hanken Grotesk — a clean humanist sans
// for copy and money figures. Exposed as CSS variables that globals.css maps
// onto --font-display / --font-sans.
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});
const sans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fils - Smarter UAE credit cards",
  description:
    "Find the best 1 to 3 UAE credit card combination for how you actually spend, net of every annual fee and reward cap. See the maths behind every recommendation, and know what your points are worth.",
};

// Light "Gulf Golden Hour" theme for Clerk's hosted UI so sign-in/sign-up match
// the product. why: the color variables are the source of truth — Clerk derives
// every text/border/muted shade from them. On a LIGHT ground, colorNeutral must
// be DARK (Clerk mixes it with alpha to build borders, placeholders and muted
// text); getting that wrong is what makes light Clerk themes look washed out.
const clerkAppearance = {
  variables: {
    colorPrimary: "#e86f2c", // flame accent
    colorBackground: "#fffdf9", // warm near-white — lifts off the eggshell page
    colorText: "#2a2016", // warm ink
    colorTextSecondary: "#6a5b47", // warm taupe, legible on light
    colorInputBackground: "#f2eadd", // warm sand
    colorInputText: "#2a2016",
    colorNeutral: "#3a2a17", // warm dark base for borders/placeholders on light
    colorDanger: "#c0392b",
    colorSuccess: "#2f855a",
    borderRadius: "0.75rem",
    fontSize: "0.95rem",
  },
  elements: {
    // Distinct, elevated warm panel with a soft sunlit shadow.
    card: "bg-surface border border-line shadow-lift",
    headerTitle: "text-fg",
    headerSubtitle: "text-muted",
    socialButtonsBlockButton: "border-line text-fg hover:bg-black/[0.04]",
    socialButtonsBlockButtonText: "text-fg font-medium",
    dividerLine: "bg-line-strong",
    dividerText: "text-faint",
    formFieldLabel: "text-fg font-medium",
    formFieldInput: "bg-surface-2 border-line text-fg placeholder:text-faint",
    formFieldInputShowPasswordButton: "text-faint hover:text-fg",
    formFieldHintText: "text-muted",
    identityPreviewText: "text-fg",
    identityPreviewEditButton: "text-clay",
    footer: "bg-transparent",
    footerActionText: "text-muted",
    footerActionLink: "text-clay hover:text-flame font-medium",
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
