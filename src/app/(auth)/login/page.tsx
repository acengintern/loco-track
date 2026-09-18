import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Masuk | LOCO TRACK",
  description: "Masuk ke LOCO TRACK.",
};

interface LoginPageProps {
  searchParams?: Promise<{
    switch?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const allowSwitch = resolvedSearchParams.switch === "true";

  // If user is already authenticated with an active profile, redirect directly to dashboard unless switching
  const profile = await getCurrentProfile();
  if (profile && profile.isActive && !allowSwitch) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background px-4 py-8 sm:px-6 md:px-8">
      <div className="w-full max-w-[420px] rounded-xl border border-border/80 bg-card p-6 shadow-xs sm:p-8 sm:shadow-sm animate-in fade-in-0 slide-in-from-bottom-3 duration-300 ease-out motion-reduce:animate-none">
        <div className="flex items-center gap-2.5 select-none">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground text-xs tracking-wider shrink-0 shadow-2xs">
            LT
          </div>
          <span className="font-bold text-xs tracking-wider text-foreground uppercase">
            LOCO TRACK
          </span>
        </div>

        <h1 className="mt-6 font-semibold text-xl tracking-tight text-foreground sm:text-2xl">
          Masuk
        </h1>

        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
