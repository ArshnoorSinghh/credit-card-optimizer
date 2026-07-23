"use client";

import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/ui/reveal";
import { Aurora } from "@/components/aurora";
import { RafiqChat } from "@/components/rafiq-chat";
import { useStoredProfile } from "@/lib/profile-store";

/*
  Ask Rafiq. One grounded assistant for everything: which card to use for a
  purchase, a head to head comparison, the best portfolio, or what your points
  are worth. The numbers always come from the engine tools, never the model.
*/

const INTRO =
  "Ask about a purchase, your best portfolio, a head to head comparison, or what your points are worth. I only answer with numbers from the engine.";

const SUGGESTIONS = [
  "Which card should I use for Carrefour?",
  "Which cards should I get?",
  "Compare FAB Cashback and ADCB 365",
  "What are my points worth?",
];

export default function AskPage() {
  const [stored] = useStoredProfile();

  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <Aurora className="opacity-40" />
      <div className="relative mx-auto max-w-3xl px-5 py-12">
        <Reveal>
          <Badge tone="brand">Ask Rafiq</Badge>
          <h1 className="mt-4 text-4xl font-semibold md:text-5xl">Ask Rafiq anything about your cards</h1>
          <p className="mt-3 max-w-xl text-muted">{INTRO}</p>
        </Reveal>

        <div className="mt-8">
          <RafiqChat
            spending={stored.spending}
            profile={stored.profile}
            suggestions={SUGGESTIONS}
            intro={INTRO}
          />
        </div>
      </div>
    </main>
  );
}
