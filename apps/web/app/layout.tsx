import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Fils",
  description: "UAE credit-card optimization",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          {/*
            Auth controls are an INVITATION, not a gate: signing in is optional and
            everything below stays usable signed-out (guest/demo mode). Deliberately
            unstyled to match the test-harness page — real styling lands with the
            frontend.
          */}
          <header
            style={{
              fontFamily: "system-ui, sans-serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 16px",
              borderBottom: "1px solid #ccc",
            }}
          >
            <strong>Fils</strong>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Show when="signed-out">
                <SignInButton />
                <SignUpButton />
              </Show>
              <Show when="signed-in">
                <UserButton />
              </Show>
            </span>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
