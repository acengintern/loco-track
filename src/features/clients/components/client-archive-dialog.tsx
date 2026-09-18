"use client";

import * as React from "react";
import { archiveClientAction } from "../actions";
import type { ClientRow } from "../types";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ClientArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ClientRow | null;
  onSuccess?: () => void;
}

export function ClientArchiveDialog({
  open,
  onOpenChange,
  client,
  onSuccess,
}: ClientArchiveDialogProps) {
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!client) return null;

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) setError(null);
    onOpenChange(isOpen);
  };

  const handleArchive = async () => {
    setIsPending(true);
    setError(null);

    try {
      const res = await archiveClientAction(client.id);
      if (!res.success) {
        setError(res.error || "Gagal mengarsipkan client.");
        setIsPending(false);
        return;
      }

      handleOpenChange(false);
      if (onSuccess) onSuccess();
    } catch {
      setError("Terjadi kesalahan teknis saat mengarsipkan client.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-sm font-semibold">
            Arsipkan Client?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Client <strong className="font-semibold text-foreground">{client.name}</strong> akan
            dinonaktifkan dan diarsipkan. Data riwayat proyek dan brand yang sudah ada tetap
            tersimpan, namun client ini tidak akan muncul lagi pada daftar pemilihan aktif.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive font-medium"
          >
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => handleOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={handleArchive}
          >
            {isPending ? "Mengarsipkan..." : "Ya, Arsipkan"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
