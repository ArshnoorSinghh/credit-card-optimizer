"use client";

import "./globals.css";
import { useEffect } from "react";

/*
  Last-resort boundary for an error thrown in the ROOT layout itself. Next replaces
  the entire document with this, so it must render its own <html>/<body> and cannot
  use the navbar or layout chrome. Kept deliberately minimal and dependency-free.
*/

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-fg antialiased">
        <main className="flex min-h-screen items-center justify-center px-5">
          <div className="max-w-md text-center">
            <h1 className="font-display text-3xl font-semibold">Something went wrong</h1>
            <p className="mt-3 text-muted">
              The application hit an unexpected error. Please reload the page.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-flame px-5 py-2.5 text-sm font-medium text-white shadow-glow transition-transform hover:scale-[1.02]"
            >
              Reload
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
