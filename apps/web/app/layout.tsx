import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fils — UAE Credit Card Optimizer",
  description: "Find your optimal UAE credit card portfolio. Maximize rewards, minimize fees.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <header className="header">
            <div className="header-inner">
              <div className="brand">
                <span className="brand-mark">F</span>
                Fils
              </div>
              <div className="header-auth">
                <Show when="signed-out">
                  <SignInButton mode="modal">
                    <button className="btn-ghost">Sign in</button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="btn-primary">Get started</button>
                  </SignUpButton>
                </Show>
                <Show when="signed-in">
                  <UserButton />
                </Show>
              </div>
            </div>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
