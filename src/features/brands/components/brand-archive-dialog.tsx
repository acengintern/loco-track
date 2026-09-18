"use client";

import * as React from "react";
import { archiveBrandAction } from "../actions";
import type { BrandRow } from "../types";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface BrandArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand: BrandRow | null;
  onSuccess?: () => void;
}

export function BrandArchiveDialog({
  open,
  onOpenChange,
  brand,
  onSuccess,
}: BrandArchiveDialogProps) {
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!brand) return null;

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) setError(null);
    onOpenChange(isOpen);
  };

  const handleArchive = async () => {
    setIsPending(true);
    setError(null);

    try {
      const res = await archiveBrandAction(brand.id);
      if (!res.success) {
        setError(res.error || "Gagal mengarsipkan brand.");
        setIsPending(false);
        return;
      }

      handleOpenChange(false);
      if (onSuccess) onSuccess();
    } catch {
      setError("Terjadi kesalahan teknis saat mengarsipkan brand.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-sm font-semibold">
            Arsipkan Brand?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Brand <strong className="font-semibold text-foreground">{brand.name}</strong> ({brand.code})
            akan dinonaktifkan dan diarsipkan. Catatan: Brand yang memiliki riwayat project tidak
            dapat diarsipkan demi integritas histori data operasional agency.
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
            className="h-8 text-xs"
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={handleArchive}
            className="h-8 text-xs"
          >
            {isPending ? "Mengarsipkan..." : "Ya, Arsipkan"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
