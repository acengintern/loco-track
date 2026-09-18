"use client";

import * as React from "react";
import { resumeRevisionWorkAction } from "../actions";
import { AlertTriangle, Play, Loader2, AlertCircle } from "lucide-react";

interface CreativeRevisionCardProps {
  taskId: string;
  projectId: string;
  revisionNotes?: string;
  roundNumber?: number;
  source?: "INTERNAL_QC" | "CLIENT";
  onSuccess?: () => void;
  className?: string;
}

export function CreativeRevisionCard({
  taskId,
  projectId,
  revisionNotes,
  roundNumber,
  source = "INTERNAL_QC",
  onSuccess,
  className = "",
}: CreativeRevisionCardProps) {
  const [isResuming, setIsResuming] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleResume = async () => {
    setErrorMessage(null);
    setIsResuming(true);

    const res = await resumeRevisionWorkAction(taskId, projectId);

    if (!res.success) {
      setErrorMessage(res.error || "Gagal memulai revisi.");
      setIsResuming(false);
      return;
    }

    setIsResuming(false);
    if (onSuccess) onSuccess();
  };

  return (
    <div
      className={`rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-2 text-xs ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            {source === "CLIENT" ? "Perlu Revisi Klien" : "Perlu Revisi Internal"}{" "}
            {roundNumber ? `(Ronde ${roundNumber})` : ""}
          </span>
        </div>

        <button
          type="button"
          onClick={handleResume}
          disabled={isResuming}
          className="inline-flex items-center gap-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {isResuming ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Play className="size-3" />
          )}
          <span>Mulai Revisi</span>
        </button>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-1.5 text-[11px] text-destructive">
          <AlertCircle className="size-3 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {revisionNotes ? (
        <div className="rounded border border-amber-500/20 bg-background/80 p-2 text-[11px] leading-relaxed text-foreground whitespace-pre-wrap break-words">
          <span className="font-semibold text-amber-700 dark:text-amber-400 block mb-0.5">
            {source === "CLIENT" ? "Catatan Klien (via SMS):" : "Catatan Creative Director:"}
          </span>
          {revisionNotes}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {source === "CLIENT"
            ? "Klien telah meminta revisi pada versi terakhir deliverable ini. Klik \"Mulai Revisi\" untuk melanjutkan pengerjaan dan mengunggah versi perbaikan."
            : "Creative Director telah meminta revisi pada versi terakhir deliverable ini. Klik \"Mulai Revisi\" untuk melanjutkan pengerjaan dan membuka kembali form upload file versi terbaru."}
        </p>
      )}
    </div>
  );
}
