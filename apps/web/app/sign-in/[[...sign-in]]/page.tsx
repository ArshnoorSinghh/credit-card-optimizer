import { SignIn } from "@clerk/nextjs";
import { BurjSunrise } from "@/components/burj-sunrise";
import { Logo } from "@/components/logo";

export default function SignInPage() {
  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center overflow-hidden px-5 py-16">
      <BurjSunrise className="opacity-90" />
      <div className="relative flex flex-col items-center">
        <Logo className="mb-8" />
        <h1 className="mb-2 text-2xl font-semibold">Welcome back</h1>
        <p className="mb-8 text-sm text-muted">Log in to your Fils wallet</p>
        <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" />
      </div>
    </main>
  );
}
