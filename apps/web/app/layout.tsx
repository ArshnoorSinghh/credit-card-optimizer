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
const clerkAppearance = {
  variables: {
    colorPrimary: "#7c6cff",
    colorBackground: "#12121c",
    colorText: "#f4f4f7",
    colorTextSecondary: "#a6a6b4",
    colorInputBackground: "#191926",
    colorInputText: "#f4f4f7",
    colorNeutral: "#ffffff",
    borderRadius: "0.75rem",
  },
  elements: {
    card: "bg-surface border border-line shadow-2xl",
    headerTitle: "text-fg",
    socialButtonsBlockButton: "border-line text-fg",
    formFieldInput: "bg-surface-2 border-line",
    footerActionLink: "text-violet",
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
