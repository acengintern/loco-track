"use client";

import * as React from "react";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { UserListItem } from "../types";
import { toggleUserStatusAction } from "../actions";

interface UserStatusDialogProps {
  user: UserListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function UserStatusDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: UserStatusDialogProps) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isPending, setIsPending] = React.useState(false);

  if (!user) return null;

  const isDeactivating = user.isActive;

  const handleConfirm = async () => {
    setIsPending(true);
    setServerError(null);

    const res = await toggleUserStatusAction({
      id: user.id,
      isActive: !user.isActive,
    });

    setIsPending(false);

    if (!res.success) {
      setServerError(res.error || "Gagal mengubah status pengguna.");
      return;
    }

    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            {isDeactivating ? (
              <div className="flex size-8 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                <AlertTriangle className="size-4" />
              </div>
            ) : (
              <div className="flex size-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
              </div>
            )}
            <DialogTitle className="text-base font-semibold">
              {isDeactivating ? "Nonaktifkan Akun Pengguna" : "Aktifkan Kembali Akun"}
            </DialogTitle>
          </div>

          <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
            {isDeactivating ? (
              <>
                Apakah Anda yakin ingin menonaktifkan akun{" "}
                <span className="font-semibold text-foreground">{user.fullName}</span> (
                {user.email})? Seluruh sesi login aktif akan segera dicabut dan pengguna
                tidak dapat lagi mengakses sistem.
              </>
            ) : (
              <>
                Apakah Anda yakin ingin mengaktifkan kembali akun{" "}
                <span className="font-semibold text-foreground">{user.fullName}</span> (
                {user.email})? Pengguna akan dapat login kembali dan melanjutkan pekerjaan.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {serverError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
            {serverError}
          </div>
        )}

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
            type="button"
            variant={isDeactivating ? "destructive" : "default"}
            size="sm"
            onClick={handleConfirm}
            disabled={isPending}
            className="h-8 text-xs gap-1.5"
          >
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            <span>
              {isDeactivating ? "Nonaktifkan Akun" : "Aktifkan Akun"}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
