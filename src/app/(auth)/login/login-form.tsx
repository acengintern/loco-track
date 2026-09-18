"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { resolveLoginIdentifier } from "./actions";

export function LoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier || !password) {
      setErrorMessage("Email/username atau kata sandi tidak sesuai.");
      return;
    }

    setIsLoading(true);

    try {
      let targetEmail = trimmedIdentifier.toLowerCase();
      if (!trimmedIdentifier.includes("@")) {
        const resolveRes = await resolveLoginIdentifier(trimmedIdentifier);
        if (!resolveRes.success || !resolveRes.email) {
          setErrorMessage(
            resolveRes.error || "Email/username atau kata sandi tidak sesuai."
          );
          setIsLoading(false);
          return;
        }
        targetEmail = resolveRes.email;
      }

      const supabase = createClient();

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: targetEmail,
          password,
        });

      if (authError || !authData.user) {
        setErrorMessage("Email/username atau kata sandi tidak sesuai.");
        setIsLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        setErrorMessage("Profil pengguna tidak ditemukan. Hubungi administrator.");
        setIsLoading(false);
        return;
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();
        setErrorMessage("Akun Anda sedang dinonaktifkan. Hubungi administrator.");
        setIsLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setErrorMessage("Terjadi kesalahan sistem saat mencoba masuk. Silakan coba lagi.");
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive animate-in fade-in-0 slide-in-from-top-1 duration-200 ease-out"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <span className="font-medium leading-tight">{errorMessage}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="identifier" className="text-xs font-medium text-foreground">
          Email atau username
        </Label>
        <Input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          required
          autoFocus
          disabled={isLoading}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Masukkan email atau username"
          className="h-10 rounded-lg border-border bg-background px-3 text-sm placeholder:text-muted-foreground transition-colors focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-xs font-medium text-foreground">
          Kata sandi
        </Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            disabled={isLoading}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Masukkan kata sandi"
            className="h-10 rounded-lg border-border bg-background pr-10 text-sm placeholder:text-muted-foreground transition-colors focus-visible:ring-1 focus-visible:ring-ring"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            disabled={isLoading}
            aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors duration-150 hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm"
          >
            {showPassword ? (
              <EyeOff className="size-4 transition-transform duration-150" aria-hidden="true" />
            ) : (
              <Eye className="size-4 transition-transform duration-150" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-10 rounded-lg font-medium text-sm shadow-xs transition-all duration-150 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60"
        >
          {isLoading ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              <span>Memproses...</span>
            </span>
          ) : (
            "Masuk"
          )}
        </Button>
      </div>
    </form>
  );
}
