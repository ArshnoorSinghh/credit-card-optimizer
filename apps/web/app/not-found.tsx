import Link from "next/link";
import { Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Aurora } from "@/components/aurora";

/*
  App-wide 404. Rendered inside the root layout (navbar + fonts + tokens all
  present), so a mistyped URL lands on a branded page rather than Next's default.
*/

export default function NotFound() {
  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-5">
      <Aurora className="opacity-40" />
      <div className="relative text-center">
        <p className="font-display text-7xl font-semibold text-gradient md:text-8xl">404</p>
        <h1 className="mt-4 text-3xl font-semibold md:text-4xl">This page took a wrong turn</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">
          The link may be broken, or the page may have moved. Let&apos;s get you back to something
          useful.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/">
            <Button size="lg">
              <Home className="h-4 w-4" />
              Back home
            </Button>
          </Link>
          <Link href="/cards">
            <Button variant="outline" size="lg">
              <Search className="h-4 w-4" />
              Browse cards
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
