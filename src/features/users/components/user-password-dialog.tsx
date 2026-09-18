"use client";

import * as React from "react";
import { Loader2, KeyRound, Copy, Check, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { UserListItem } from "../types";
import { resetUserPasswordAction } from "../actions";

interface UserPasswordDialogProps {
  user: UserListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function UserPasswordDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: UserPasswordDialogProps) {
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [isPending, setIsPending] = React.useState(false);

  const handleDialogChange = (newOpen: boolean) => {
    if (!newOpen) {
      setPassword("");
      setShowPassword(false);
      setCopied(false);
      setServerError(null);
      setSuccessMessage(null);
    }
    onOpenChange(newOpen);
  };

  if (!user) return null;

  const handleGeneratePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";
    let gen = "";
    for (let i = 0; i < 12; i++) {
      gen += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(gen);
    setShowPassword(true);
  };

  const handleCopy = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setServerError("Kata sandi baru minimal 8 karakter.");
      return;
    }

    setIsPending(true);
    setServerError(null);

    const res = await resetUserPasswordAction({
      id: user.id,
      password,
    });

    setIsPending(false);

    if (!res.success) {
      setServerError(res.error || "Gagal mereset kata sandi.");
      return;
    }

    setSuccessMessage("Kata sandi berhasil diperbarui.");
    setTimeout(() => {
      onOpenChange(false);
      onSuccess?.();
    }, 1200);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <KeyRound className="size-4" />
            </div>
            <DialogTitle className="text-base font-semibold">
              Atur Ulang Kata Sandi
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Tetapkan kata sandi baru untuk akun{" "}
            <span className="font-semibold text-foreground">{user.fullName}</span> (
            {user.email}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {serverError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
              {serverError}
            </div>
          )}

          {successMessage && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400">
              {successMessage}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="new-user-password"
                className="text-xs font-medium text-foreground"
              >
                Kata Sandi Baru <span className="text-destructive">*</span>
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-xs text-primary hover:underline font-medium cursor-pointer"
              >
                Generate Sandi Acak
              </button>
            </div>

            <div className="relative">
              <Input
                id="new-user-password"
                type={showPassword ? "text" : "password"}
                placeholder="Minimal 8 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-8 text-xs pr-16"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {password && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="p-1 text-muted-foreground hover:text-foreground rounded cursor-pointer"
                    title="Salin kata sandi"
                    aria-label="Salin kata sandi"
                  >
                    {copied ? (
                      <Check className="size-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded cursor-pointer"
                  title={showPassword ? "Sembunyikan" : "Tampilkan"}
                  aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                >
                  {showPassword ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Pastikan Anda mencatat atau menyalin kata sandi sebelum menyimpannya.
            </p>
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="h-8 text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || password.length < 8}
              className="h-8 text-xs gap-1.5"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              <span>Simpan Kata Sandi</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
