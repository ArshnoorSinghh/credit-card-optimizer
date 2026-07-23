import { SignUp } from "@clerk/nextjs";
import { BurjSunrise } from "@/components/burj-sunrise";

export default function SignUpPage() {
  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center overflow-hidden px-5 py-16">
      <BurjSunrise className="opacity-90" />
      <div className="relative flex flex-col items-center">
        <h1 className="mb-2 text-2xl font-semibold">Create your account</h1>
        <p className="mb-8 text-sm text-muted">Find your best UAE cards in a minute</p>
        <SignUp signInUrl="/sign-in" fallbackRedirectUrl="/hub" />
      </div>
    </main>
  );
}
