import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isGateArmed, isPublicPath } from "@/lib/access-gate";

// why this middleware now BLOCKS by default:
//
// It used to protect nothing, and the comment here explained why: Fils was usable
// without an account, so the optimizer and landing page had to answer anonymous
// requests, and a protect-everything model was "one forgotten matcher entry away
// from breaking the demo".
//
// Fils is now INVITE-ONLY, which inverts the failure that costs something. The
// expensive mistake is no longer a broken demo; it is a route quietly serving the
// full personalised product to someone who was never let in. So the gate fails
// CLOSED: anything not named public in lib/access-gate.ts is blocked, and a route
// added tomorrow is blocked until someone opens it deliberately.
//
// Clerk's "protect close to the resource" guidance still holds for USER-level
// authorization, and routes keep enforcing that themselves with `await auth()` —
// see lib/auth.ts. This gate is a different question, asked earlier: is this
// surface open to the public at all? That is a property of the ROUTE, not of the
// visitor, so the middleware is the honest place for it. `createRouteMatcher` is
// deprecated and stays unused; the matching is a pure function in lib/access-gate.ts.
export default clerkMiddleware(async (_auth, req) => {
  if (!isGateArmed()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  // An API caller gets a machine-readable 403, never an HTML redirect — a fetch
  // that silently receives a login page is far harder to debug than a clear status.
  if (pathname.startsWith("/api")) {
    return NextResponse.json(
      { error: "Fils is invite-only right now. Join the waitlist at /." },
      { status: 403 },
    );
  }

  // A browser gets sent to the landing page, where the waitlist form is. `?from=`
  // records which surface they were reaching for, so the form can attribute the
  // signup and so the funnel shows what people actually wanted.
  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.search = `?from=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
});

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    // Clerk's auto-proxy path — required for the handshake to work.
    "/__clerk/:path*",
  ],
};
