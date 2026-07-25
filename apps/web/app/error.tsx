"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Aurora } from "@/components/aurora";

/*
  Route-segment error boundary. Catches an unexpected throw in any page under the
  root layout and shows a calm, on-brand recovery screen with a retry, instead of
  a blank white crash. `reset()` re-renders the failed segment.
*/

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error for observability; swap for a real logger in production.
    console.error(error);
  }, [error]);

  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-5">
      <Aurora className="opacity-40" />
      <div className="relative max-w-md text-center">
        <h1 className="text-3xl font-semibold md:text-4xl">Something went wrong</h1>
        <p className="mt-3 text-muted">
          An unexpected error interrupted this page. You can try again, or head back home.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-faint">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={reset}>
            <RotateCw className="h-4 w-4" />
            Try again
          </Button>
          <Link href="/">
            <Button variant="outline" size="lg">
              <Home className="h-4 w-4" />
              Back home
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
