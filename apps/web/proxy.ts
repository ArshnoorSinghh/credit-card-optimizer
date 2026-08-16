import { clerkMiddleware } from "@clerk/nextjs/server";

// why this middleware protects NOTHING by default:
//
// Fils is usable without an account — the optimizer is a guest/demo surface, so
// /api/optimize and the landing page MUST answer anonymous requests. The inverse
// (protect-everything, allowlist the exceptions) puts the demo one forgotten
// matcher entry away from breaking, and fails closed on every route we add.
//
// This also follows Clerk's current guidance: protect access as close to the
// resource as possible, not in middleware (`createRouteMatcher` is deprecated).
// So this call only attaches session context to the request; routes that need a
// user enforce it themselves with `await auth()`. See lib/auth.ts.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    // Clerk's auto-proxy path — required for the handshake to work.
    "/__clerk/:path*",
  ],
};
