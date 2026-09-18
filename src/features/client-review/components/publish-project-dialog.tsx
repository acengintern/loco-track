"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publishProjectAction } from "../actions";
import { Globe, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "@/components/ui/toast";

interface PublishProjectDialogProps {
  projectId: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function PublishProjectDialog({
  projectId,
  projectName,
  isOpen,
  onClose,
  onSuccess,
}: PublishProjectDialogProps) {
  const [url, setUrl] = React.useState("");
  const [note, setNote] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleModalClose = React.useCallback(() => {
    setUrl("");
    setNote("");
    setErrorMessage(null);
    onClose();
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanUrl = url.trim();
    if (!cleanUrl) {
      setErrorMessage("Tautan publikasi konten wajib diisi.");
      return;
    }

    if (!/^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(cleanUrl)) {
      setErrorMessage("Format tautan tidak valid. Pastikan diawali dengan https:// atau http://.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const res = await publishProjectAction(projectId, cleanUrl, note.trim() || undefined);

    if (!res.success) {
      const errorMsg = res.error || "Gagal mempublikasikan project. Coba lagi.";
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
      setIsSubmitting(false);
      return;
    }

    toast.success("Project berhasil dipublikasikan.");
    setIsSubmitting(false);
    handleModalClose();
    if (onSuccess) onSuccess();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleModalClose()}>
      <DialogContent className="sm:max-w-md max-h-[calc(100dvh-3.5rem)] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl">
        <DialogHeader className="px-6 py-5 border-b border-border/80 bg-card shrink-0">
          <div className="flex items-center gap-2 text-primary">
            <Globe className="size-4" />
            <span className="font-semibold text-xs tracking-wide uppercase">
              Publikasi Final
            </span>
          </div>
          <DialogTitle className="text-base font-semibold text-foreground">
            Publikasikan: {projectName}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Masukkan tautan hasil unggahan konten yang telah live di media sosial atau kanal publikasi klien.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
            {errorMessage && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-2 text-xs text-destructive">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="pub-url" className="text-xs font-medium">
                Tautan Publikasi (URL) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pub-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://instagram.com/p/..."
                required
                className="text-xs h-9"
              />
              <span className="text-[10px] text-muted-foreground">
                Tautan ini akan dicatat permanen dalam riwayat publikasi proyek.
              </span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pub-note" className="text-xs font-medium">
                Catatan Publikasi (Opsional)
              </Label>
              <textarea
                id="pub-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Tambahkan catatan analitik awal atau konfirmasi klien..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-4.5 sm:py-5 border-t border-border bg-muted/20 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 shrink-0 mt-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleModalClose}
              disabled={isSubmitting}
              className="h-8 text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !url.trim()}
              className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  <span>Mempublikasikan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5 mr-1.5" />
                  <span>Konfirmasi Publikasi</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
