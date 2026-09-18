import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Masuk | LOCO TRACK",
  description: "Masuk ke workspace operasional produksi konten LOCO TRACK.",
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-foreground sm:px-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand Header */}
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center justify-center">
            <span className="flex h-8 w-8 items-center justify-center rounded border border-border bg-foreground font-semibold text-background text-xs tracking-wider">
              LT
            </span>
          </div>
          <div className="space-y-1">
            <h1 className="font-semibold text-lg tracking-tight text-foreground sm:text-xl">
              Masuk ke workspace
            </h1>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Kelola produksi konten dari brief hingga publish.
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="rounded border border-border bg-card p-6 shadow-none sm:p-7">
          <LoginForm />
        </div>

        {/* Security & Access Notice */}
        <p className="text-center text-[11px] text-muted-foreground leading-relaxed">
          Akses terbatas untuk personel internal terdaftar.
        </p>
      </div>
    </div>
  );
}
