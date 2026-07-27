import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Newsreader, Hanken_Grotesk } from "next/font/google";
import { CursorGlow } from "@/components/cursor-glow";
import { Navbar } from "@/components/navbar";
import { ToastProvider } from "@/components/ui/toast";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

// Display: Newsreader — a warm, editorial serif that reads "heritage private
// bank" rather than generic-SaaS. Body: Hanken Grotesk — a clean humanist sans
// for copy and money figures. Exposed as CSS variables that globals.css maps
// onto --font-display / --font-sans.
//
// why Newsreader and not Fraunces: Fraunces' lowercase "f" carries almost no
// crossbar to the right of the stem, so at heading sizes it reads as a long-s —
// "Transfers" looked like "Tranſers" on the legal pages. That shape is baked
// into the glyph, not a ligature or an axis (checked: it survives WONK 0/1 and
// every opsz), so the only fix was a different display face.
//
// why: opsz is requested explicitly so the browser's default optical sizing can
// use it — Newsreader pins opsz at 18 otherwise, which is a text cut, and the
// hero runs at 72px.
const display = Newsreader({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-newsreader",
  display: "swap",
});
const sans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

// why: the SEO/social metadata block comes from the frontend-polish branch, but the
// copy inside it is main's. Main's "remove dashes" pass replaced every em/en dash in
// user-facing text with a plain hyphen and rewrote the description to match what the
// engine actually does, so the title and description below are main's, not the
// branch's older dash-y strings.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Fils - Smarter UAE credit cards",
    template: "%s · Fils",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "UAE credit cards",
    "credit card optimizer",
    "cashback",
    "rewards points",
    "Skywards miles",
    "Dubai",
    "Abu Dhabi",
  ],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "Fils - Smarter UAE credit cards",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_AE",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fils - Smarter UAE credit cards",
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f1e6",
  colorScheme: "light",
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

// Copy overrides for Clerk's hosted UI. why: the sign-up verification step is
// where people get stuck - the mail lands in spam often enough that "nothing
// arrived" is really "look in the junk folder". Both the link and the code
// flavours of the step are overridden because which one Clerk renders depends on
// the instance's verification setting.
const clerkLocalization = {
  signUp: {
    emailLink: {
      formSubtitle:
        "Use the verification link sent to your email address. If it is not there in a minute, check your spam or junk folder.",
    },
    emailCode: {
      formSubtitle:
        "Enter the verification code sent to your email address. If it is not there in a minute, check your spam or junk folder.",
    },
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen bg-bg text-fg antialiased">
        <ClerkProvider appearance={clerkAppearance} localization={clerkLocalization}>
          {/* Skip link — first focusable element, visible only when focused. */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-flame focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-glow"
          >
            Skip to content
          </a>
          <CursorGlow />
          <ToastProvider>
            <div className="relative z-10">
              <Navbar />
              <div id="main-content" tabIndex={-1} className="outline-none">
              {children}
            </div>
            </div>
          </ToastProvider>
        </ClerkProvider>
        <Analytics />
      </body>
    </html>
  );
}
