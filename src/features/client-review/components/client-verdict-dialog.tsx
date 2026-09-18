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
import { TaskTypeBadge } from "@/features/tasks/components/task-badges";
import type { TaskType } from "@/features/tasks/types";
import type { PresentedTaskCandidate, QcVerdict } from "../types";
import { recordClientItemVerdictAction } from "../actions";
import { getDeliverableSignedUrlAction } from "@/features/deliverables/actions";
import {
  CheckCircle2,
  AlertTriangle,
  FileText,
  Download,
  Loader2,
  AlertCircle,
  Eye,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import Image from "next/image";

interface ClientVerdictDialogProps {
  candidate: PresentedTaskCandidate | null;
  reviewId: string | null;
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ClientVerdictDialog({
  candidate,
  reviewId,
  projectId,
  isOpen,
  onClose,
  onSuccess,
}: ClientVerdictDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [signedUrl, setSignedUrl] = React.useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = React.useState(false);

  const [verdict, setVerdict] = React.useState<QcVerdict | null>(null);
  const [feedback, setFeedback] = React.useState("");

  const handleModalClose = React.useCallback(() => {
    setSignedUrl(null);
    setVerdict(null);
    setFeedback("");
    setErrorMessage(null);
    onClose();
  }, [onClose]);

  React.useEffect(() => {
    if (!isOpen || !candidate) {
      return;
    }

    let isMounted = true;

    getDeliverableSignedUrlAction(candidate.file_id, projectId)
      .then((res) => {
        if (isMounted) {
          if (res.success && res.data?.signedUrl) {
            setSignedUrl(res.data.signedUrl);
          }
          setIsLoadingPreview(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoadingPreview(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, candidate, projectId]);

  if (!candidate || !reviewId) return null;

  const isImage = candidate.file_name.match(/\.(png|jpe?g|webp|gif|svg)$/i);

  const handleSubmit = async () => {
    if (!verdict) {
      setErrorMessage("Silakan pilih keputusan review client terlebih dahulu.");
      return;
    }

    if (verdict === "REVISION_REQUESTED" && !feedback.trim()) {
      setErrorMessage("Catatan feedback client wajib diisi saat meminta revisi.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const res = await recordClientItemVerdictAction(
      reviewId,
      candidate.task_id,
      verdict,
      feedback.trim(),
      projectId
    );

    if (!res.success) {
      const errorMsg = res.error || "Gagal mencatat keputusan review client. Coba lagi.";
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
      setIsSubmitting(false);
      return;
    }

    toast.success(
      verdict === "APPROVED"
        ? "Persetujuan client berhasil dicatat."
        : "Revisi dari client berhasil dicatat."
    );
    setIsSubmitting(false);
    handleModalClose();
    if (onSuccess) onSuccess();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleModalClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <TaskTypeBadge taskType={candidate.task_type as TaskType} />
            <span className="font-mono text-xs font-semibold text-primary">
              Versi {candidate.version}
            </span>
          </div>
          <DialogTitle className="text-base font-semibold text-foreground">
            Catat Hasil Review Client: {candidate.task_title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Rekam respon atau persetujuan dari pihak klien untuk deliverable versi ini.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
          {errorMessage && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-2 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Deliverable Details & Preview */}
          <div className="rounded-lg border border-border bg-card p-3 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                <span className="font-medium text-foreground truncate max-w-[280px]">
                  {candidate.file_name}
                </span>
              </div>
              {signedUrl && (
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                >
                  <Download className="size-3" />
                  <span>Unduh File</span>
                </a>
              )}
            </div>

            {isLoadingPreview ? (
              <div className="h-40 rounded-md border border-border/60 bg-muted flex items-center justify-center text-muted-foreground gap-2">
                <Loader2 className="size-4 animate-spin" />
                <span>Memuat pratinjau file...</span>
              </div>
            ) : isImage && signedUrl ? (
              <div className="relative h-48 w-full rounded-md border border-border/60 bg-black/5 overflow-hidden flex items-center justify-center">
                <Image
                  src={signedUrl}
                  alt={candidate.file_name}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 500px"
                />
              </div>
            ) : (
              <div className="h-20 rounded-md border border-border/60 bg-muted/50 flex flex-col items-center justify-center text-muted-foreground gap-1">
                <Eye className="size-4 text-muted-foreground/60" />
                <span className="text-[11px]">Pratinjau langsung tidak tersedia untuk format file ini</span>
              </div>
            )}
          </div>

          {/* Verdict Selection */}
          <div className="space-y-3 pt-2">
            <label className="text-xs font-semibold text-foreground block">
              Keputusan Klien
            </label>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setVerdict("APPROVED");
                  setErrorMessage(null);
                }}
                className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border text-center transition-colors ${
                  verdict === "APPROVED"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/20"
                    : "border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                <CheckCircle2 className="size-5 text-emerald-500" />
                <span className="text-xs font-semibold">Disetujui Klien</span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Klien menyetujui versi deliverable ini tanpa perubahan
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setVerdict("REVISION_REQUESTED");
                  setErrorMessage(null);
                }}
                className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border text-center transition-colors ${
                  verdict === "REVISION_REQUESTED"
                    ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-2 ring-amber-500/20"
                    : "border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                <AlertTriangle className="size-5 text-amber-500" />
                <span className="text-xs font-semibold">Revisi Diminta</span>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Klien meminta perbaikan pada deliverable ini
                </span>
              </button>
            </div>

            <div className="space-y-1.5 pt-1">
              <label
                htmlFor="client-feedback-notes"
                className="text-xs font-semibold text-foreground flex items-center justify-between"
              >
                <span>
                  Catatan Feedback Klien{" "}
                  {verdict === "REVISION_REQUESTED" ? (
                    <span className="text-destructive">*</span>
                  ) : (
                    <span className="text-muted-foreground font-normal">(Opsional)</span>
                  )}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {feedback.length}/5000 karakter
                </span>
              </label>
              <textarea
                id="client-feedback-notes"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                maxLength={5000}
                placeholder={
                  verdict === "REVISION_REQUESTED"
                    ? "Tuliskan poin-poin revisi yang diminta oleh klien secara spesifik..."
                    : "Catatan atau apresiasi dari klien (jika ada)..."
                }
                rows={3}
                className="w-full rounded-md border border-border bg-background p-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleModalClose}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={isSubmitting || !verdict || (verdict === "REVISION_REQUESTED" && !feedback.trim())}
            className={
              verdict === "APPROVED"
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : verdict === "REVISION_REQUESTED"
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : ""
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <span>Simpan Keputusan</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
