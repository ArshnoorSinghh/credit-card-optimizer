"use client";

import { Show } from "@clerk/nextjs";

/*
  SignedOutOnly / SignedInOnly — auth gating for SERVER components.

  why this wrapper exists instead of importing Clerk's <Show> directly:
  `@clerk/nextjs` resolves `Show` to a *server* component in the App Router,
  which reads the session and therefore opts its whole route out of static
  prerendering. The footer alone renders on every legal and marketing page, so
  importing it there would turn the entire static surface dynamic just to hide
  one link.

  Crossing a "use client" boundary picks up the client build of `Show` instead:
  the page still prerenders, and the gating resolves on hydration. The tradeoff
  is that gated content pops in a beat late, so use this for supplementary
  affordances (a footer link, a CTA button) and NOT for anything above the fold
  whose absence would shift layout.
*/

export function SignedOutOnly({ children }: { children: React.ReactNode }) {
  return <Show when="signed-out">{children}</Show>;
}

export function SignedInOnly({ children }: { children: React.ReactNode }) {
  return <Show when="signed-in">{children}</Show>;
}
