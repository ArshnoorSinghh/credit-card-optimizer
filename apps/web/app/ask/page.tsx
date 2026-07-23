"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { Aurora } from "@/components/aurora";
import { RafiqChat } from "@/components/rafiq-chat";
import { useStoredProfile } from "@/lib/profile-store";

/*
  Ask Rafiq. One surface, two framings. With no query it is the general assistant;
  with ?for=purchase it is the "which card should I use" lookup, with purchase
  focused prompts. Both talk to the same grounded engine tools, so the numbers are
  always the engine's, never the model's.
*/

const PURCHASE = {
  badge: "Which card lookup",
  title: "Which card should I use?",
  intro:
    "Tell me what you are buying, or where, and I will tell you which of your cards earns the most on it. Numbers come straight from the engine.",
  suggestions: [
    "Which card should I use for Carrefour?",
    "Best card for dining out?",
    "Which card for ADNOC fuel?",
  ],
};

const GENERAL = {
  badge: "Ask Rafiq",
  title: "Ask Rafiq anything about your cards",
  intro:
    "Ask about a purchase, your best portfolio, a head to head comparison, or what your points are worth. I only answer with numbers from the engine.",
  suggestions: [
    "Which cards should I get?",
    "Compare FAB Cashback and ADCB 365",
    "What are my points worth?",
  ],
};

function AskInner() {
  const params = useSearchParams();
  const mode = params.get("for") === "purchase" ? PURCHASE : GENERAL;
  const [stored] = useStoredProfile();

  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <Aurora className="opacity-40" />
      <div className="relative mx-auto max-w-3xl px-5 py-12">
        <Reveal>
          <Badge tone="brand">{mode.badge}</Badge>
          <h1 className="mt-4 text-4xl font-semibold md:text-5xl">{mode.title}</h1>
          <p className="mt-3 max-w-xl text-muted">{mode.intro}</p>
        </Reveal>

        <div className="mt-8">
          <RafiqChat
            spending={stored.spending}
            profile={stored.profile}
            suggestions={mode.suggestions}
            intro={mode.intro}
          />
        </div>
      </div>
    </main>
  );
}

export default function AskPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <AskInner />
    </Suspense>
  );
}
