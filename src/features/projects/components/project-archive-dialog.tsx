"use client";

import * as React from "react";
import { archiveProjectAction } from "../actions";
import type { ProjectWithRelations } from "../types";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

interface ProjectArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectWithRelations | null;
  onSuccess?: () => void;
}

export function ProjectArchiveDialog({
  open,
  onOpenChange,
  project,
  onSuccess,
}: ProjectArchiveDialogProps) {
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!project) return null;

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) setError(null);
    onOpenChange(isOpen);
  };

  const handleArchive = async () => {
    setIsPending(true);
    setError(null);

    try {
      const res = await archiveProjectAction(project.id);
      if (!res.success) {
        const errorMsg = res.error || "Gagal mengarsipkan project. Coba lagi.";
        setError(errorMsg);
        toast.error(errorMsg);
        setIsPending(false);
        return;
      }

      toast.success("Project berhasil diarsipkan.");
      handleOpenChange(false);
      if (onSuccess) onSuccess();
    } catch {
      const errorMsg = "Terjadi kesalahan teknis saat mengarsipkan project.";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-sm font-semibold">
            Arsipkan Project?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Project <strong className="font-semibold text-foreground">{project.name}</strong> ({project.project_code})
            akan dinonaktifkan dan diarsipkan. Data riwayat dan aset tetap tersimpan untuk keperluan audit,
            namun project ini tidak akan ditampilkan pada daftar aktif harian.
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
