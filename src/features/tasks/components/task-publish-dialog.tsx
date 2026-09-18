"use client";

import * as React from "react";
import { publishTaskAction } from "../actions";
import type { TaskWithRelations } from "../types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Globe, Loader2, ShieldAlert } from "lucide-react";

interface TaskPublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskWithRelations | null;
  projectId?: string;
  onSuccess?: () => void;
}

interface TaskPublishFormProps {
  task: TaskWithRelations;
  projectId?: string;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

function TaskPublishForm({
  task,
  projectId,
  onOpenChange,
  onSuccess,
}: TaskPublishFormProps) {
  const [url, setUrl] = React.useState(task.publication_url || "");
  const [note, setNote] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUrl = url.trim();
    if (!cleanUrl) {
      setErrorMessage("Tautan publikasi (URL) wajib diisi.");
      return;
    }

    if (!/^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(cleanUrl)) {
      setErrorMessage("Format tautan tidak valid. Harus diawali dengan http:// atau https://.");
      return;
    }

    setIsSubmitting(true);

    const res = await publishTaskAction({
      taskId: task.id,
      publicationUrl: cleanUrl,
      publishNote: note.trim() || undefined,
      projectId: projectId || task.project_id,
    });

    if (!res.success) {
      const errorMsg = res.error || "Gagal mempublikasikan tugas.";
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
      setIsSubmitting(false);
      return;
    }

    toast.success("Konten berhasil dipublikasikan.");
    setIsSubmitting(false);
    onOpenChange(false);
    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Globe className="size-4" />
          </div>
          <DialogTitle className="text-sm font-semibold">
            Publikasikan Konten
          </DialogTitle>
        </div>
        <DialogDescription className="text-xs text-muted-foreground line-clamp-2">
          Tugas: <span className="font-medium text-foreground">{task.title}</span>
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs pt-1">
        {errorMessage && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-2 text-destructive">
            <ShieldAlert className="size-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="publish-url" className="text-xs font-semibold text-foreground">
            Tautan Tayang (URL Live) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="publish-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.instagram.com/p/..."
            className="text-xs h-8"
            required
          />
          <p className="text-[11px] text-muted-foreground">
            Masukkan tautan postingan live di media sosial (Instagram, TikTok, YouTube, dll).
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="publish-note" className="text-xs font-semibold text-foreground">
            Catatan Rilis (Opsional)
          </Label>
          <textarea
            id="publish-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Contoh: Tayang di Feed kolaborasi jam 12.00..."
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring resize-none leading-relaxed"
          />
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <Globe className="size-3.5 mr-1.5" />
                <span>Tandai Tayang</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export function TaskPublishDialog({
  open,
  onOpenChange,
  task,
  projectId,
  onSuccess,
}: TaskPublishDialogProps) {
  if (!task) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <TaskPublishForm
          task={task}
          projectId={projectId}
          onOpenChange={onOpenChange}
          onSuccess={onSuccess}
        />
      )}
    </Dialog>
  );
}
