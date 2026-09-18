"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/constants/navigation";
import type { UserProfile } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProfileFormProps {
  initialProfile: UserProfile;
}

export function ProfileForm({ initialProfile }: ProfileFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = React.useState(initialProfile.fullName);
  const [isLoading, setIsLoading] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setFeedback({
        type: "error",
        message: "Nama lengkap minimal 2 karakter.",
      });
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: trimmedName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", initialProfile.id);

      if (error) {
        setFeedback({
          type: "error",
          message: `Gagal memperbarui profil: ${error.message}`,
        });
        setIsLoading(false);
        return;
      }

      setFeedback({
        type: "success",
        message: "Profil Anda berhasil diperbarui.",
      });
      router.refresh();
    } catch {
      setFeedback({
        type: "error",
        message: "Terjadi kesalahan jaringan saat memperbarui profil.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const roleLabel =
    ROLE_LABELS[initialProfile.role] ?? initialProfile.role;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-md border p-3.5 text-xs font-medium ${
            feedback.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="space-y-4">
        {/* Full Name */}
        <div className="space-y-1.5">
          <Label htmlFor="fullName" className="text-xs font-medium">
            Nama Lengkap
          </Label>
          <Input
            id="fullName"
            name="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={isLoading}
            required
            className="max-w-md text-sm"
          />
        </div>

        {/* Email (Read only) */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
            Alamat Email
          </Label>
          <Input
            id="email"
            type="email"
            value={initialProfile.email}
            disabled
            className="max-w-md text-sm bg-muted/50 cursor-not-allowed opacity-80"
          />
          <p className="text-[11px] text-muted-foreground">
            Alamat email terdaftar dikelola oleh administrator sistem.
          </p>
        </div>

        {/* Role (Read only) */}
        <div className="space-y-1.5">
          <Label htmlFor="role" className="text-xs font-medium text-muted-foreground">
            Peran Operasional
          </Label>
          <Input
            id="role"
            type="text"
            value={roleLabel}
            disabled
            className="max-w-md text-sm bg-muted/50 cursor-not-allowed opacity-80 font-medium"
          />
          <p className="text-[11px] text-muted-foreground">
            Peran menentukan hak akses modul dan alur persetujuan Anda.
          </p>
        </div>
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          disabled={isLoading || fullName.trim() === initialProfile.fullName}
          size="sm"
        >
          {isLoading ? "Menyimpan..." : "Simpan Perubahan"}
        </Button>
      </div>
    </form>
  );
}
