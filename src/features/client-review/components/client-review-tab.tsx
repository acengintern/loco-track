"use client";

import * as React from "react";
import type { ProjectClientReviewData, PresentedTaskCandidate } from "../types";
import {
  startClientReviewAction,
  startClientRePresentationAction,
  finalizeClientApprovalAction,
} from "../actions";
import { ClientVerdictDialog } from "./client-verdict-dialog";
import { PublishProjectDialog } from "./publish-project-dialog";
import { ClientHistoryTimeline } from "./client-history-timeline";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { TaskTypeBadge } from "@/features/tasks/components/task-badges";
import type { TaskType } from "@/features/tasks/types";
import {
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Globe,
  ExternalLink,
  Loader2,
  FileCheck,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface ClientReviewTabProps {
  data: ProjectClientReviewData;
  projectName: string;
  userRole?: string;
  currentUserId?: string;
  canManage: boolean;
}

export function ClientReviewTab({
  data,
  projectName,
  canManage,
}: ClientReviewTabProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Modal states
  const [selectedCandidate, setSelectedCandidate] = React.useState<PresentedTaskCandidate | null>(null);
  const [isVerdictDialogOpen, setIsVerdictDialogOpen] = React.useState(false);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = React.useState(false);

  const isAuthorizedManager = canManage;

  const handleStartReview = async () => {
    setErrorMessage(null);
    setIsProcessing(true);

    const res = await startClientReviewAction(data.projectId);
    if (!res.success) {
      const errorMsg = res.error || "Gagal mengajukan review client. Coba lagi.";
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
      setIsProcessing(false);
      return;
    }

    toast.success("Project berhasil diajukan ke review client.");
    setIsProcessing(false);
    router.refresh();
  };

  const handleRePresent = async () => {
    setErrorMessage(null);
    setIsProcessing(true);

    const res = await startClientRePresentationAction(data.projectId);
    if (!res.success) {
      const errorMsg = res.error || "Gagal mengajukan ulang ke client. Coba lagi.";
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
      setIsProcessing(false);
      return;
    }

    toast.success("Materi revisi berhasil diajukan kembali ke client.");
    setIsProcessing(false);
    router.refresh();
  };

  const handleFinalizeApproval = async () => {
    setErrorMessage(null);
    setIsProcessing(true);

    const res = await finalizeClientApprovalAction(data.projectId);
    if (!res.success) {
      const errorMsg = res.error || "Gagal menyelesaikan persetujuan client. Coba lagi.";
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
      setIsProcessing(false);
      return;
    }

    toast.success("Persetujuan client berhasil difinalisasi.");
    setIsProcessing(false);
    router.refresh();
  };

  const handleOpenVerdictDialog = (candidate: PresentedTaskCandidate) => {
    setSelectedCandidate(candidate);
    setIsVerdictDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Error alert */}
      {errorMessage && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3.5 flex items-start gap-2.5 text-xs text-destructive">
          <ShieldAlert className="size-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Top Phase Header / Banner */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground/80">
                Fase Review Klien & Publikasi
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase ${
                  data.projectStatus === "PUBLISHED"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : data.projectStatus === "APPROVED"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : data.projectStatus === "CLIENT_REVIEW"
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {data.projectStatus}
              </span>
            </div>
            <h2 className="text-base font-semibold text-foreground">
              {data.projectStatus === "PUBLISHED"
                ? "Konten Telah Resmi Dipublikasikan"
                : data.projectStatus === "APPROVED"
                ? "Semua Deliverable Telah Disetujui Klien"
                : data.projectStatus === "CLIENT_REVIEW"
                ? `Review Klien Berjalan ${data.currentRound ? `(Ronde ${data.currentRound.round_number})` : ""}`
                : "Menunggu Penyelesaian QC Internal"}
            </h2>
            <p className="text-xs text-muted-foreground max-w-2xl">
              {data.projectStatus === "PUBLISHED"
                ? "Project telah selesai dan tautan konten publik telah dicatat permanen."
                : data.projectStatus === "APPROVED"
                ? "Klien telah memberikan persetujuan final. SMS dapat mempublikasikan konten dan mencatat URL tayang."
                : data.projectStatus === "CLIENT_REVIEW"
                ? "SMS mencatat respon dari klien per deliverable. Revisi dari klien wajib melalui re-QC Creative Director."
                : "Semua tugas produksi harus lolos QC internal Creative Director sebelum dapat diajukan ke klien."}
            </p>
          </div>

          {/* Primary Action Buttons based on state */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* 1. Start Client Review (from INTERNAL_QC) */}
            {data.projectStatus === "INTERNAL_QC" && isAuthorizedManager && (
              <Button
                type="button"
                size="sm"
                onClick={handleStartReview}
                disabled={isProcessing || !data.canStartReview}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <Send className="size-3.5 mr-1.5" />
                    <span>Ajukan ke Klien (Ronde 1)</span>
                  </>
                )}
              </Button>
            )}

            {/* 2. Re-present to Client (from CLIENT_REVIEW after CD re-QC) */}
            {data.projectStatus === "CLIENT_REVIEW" && isAuthorizedManager && data.canRePresent && (
              <Button
                type="button"
                size="sm"
                onClick={handleRePresent}
                disabled={isProcessing}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <Send className="size-3.5 mr-1.5" />
                    <span>Ajukan Ulang ke Klien</span>
                  </>
                )}
              </Button>
            )}

            {/* 3. Finalize Client Approval (from CLIENT_REVIEW when all candidates approved) */}
            {data.projectStatus === "CLIENT_REVIEW" && isAuthorizedManager && data.canFinalizeApproval && (
              <Button
                type="button"
                size="sm"
                onClick={handleFinalizeApproval}
                disabled={isProcessing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5 mr-1.5" />
                    <span>Finalisasi Persetujuan Klien</span>
                  </>
                )}
              </Button>
            )}

            {/* 4. Publish Project (from APPROVED) */}
            {data.projectStatus === "APPROVED" && isAuthorizedManager && data.canPublish && (
              <Button
                type="button"
                size="sm"
                onClick={() => setIsPublishDialogOpen(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Globe className="size-3.5 mr-1.5" />
                <span>Publikasikan Konten</span>
              </Button>
            )}
          </div>
        </div>

        {/* Guidance for PRODUCTION */}
        {data.projectStatus === "PRODUCTION" && (
          <div className="rounded border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-900 dark:text-sky-300 flex items-start gap-2">
            <Clock className="size-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold">Project masih dalam tahap Produksi:</span>
              <p className="text-[11px] leading-relaxed">
                Terdapat tugas yang belum selesai atau belum lolos QC internal Creative Director. Selesaikan seluruh tugas di tab &quot;Tugas&quot; agar status project naik ke tahap QC Internal dan tombol &quot;Ajukan ke Klien (Ronde 1)&quot; aktif.
              </p>
            </div>
          </div>
        )}

        {/* Readiness Warning / Guidance for INTERNAL_QC */}
        {data.projectStatus === "INTERNAL_QC" && !data.canStartReview && (
          <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold">Project belum siap diajukan ke klien:</span>
              <p className="text-[11px] leading-relaxed">
                Pastikan seluruh tugas produksi telah disetujui (APPROVED) oleh Creative Director dan tidak ada revisi internal yang sedang berjalan.
              </p>
            </div>
          </div>
        )}

        {/* Decision D-002 Re-QC Notice for CLIENT_REVIEW when revisions exist */}
        {data.projectStatus === "CLIENT_REVIEW" && data.revisionTasksCount > 0 && !data.canRePresent && (
          <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold">Revisi Klien Sedang Diproses (Aturan D-002):</span>
              <p className="text-[11px] leading-relaxed">
                Kreatif sedang mengerjakan revisi yang diminta klien. Setiap hasil revisi wajib diunggah dalam versi baru dan lolos re-QC Creative Director sebelum tombol pengajuan ulang ke klien aktif.
              </p>
            </div>
          </div>
        )}

        {/* Metric summary boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-border/60 pt-4 text-xs">
          <div className="rounded border border-border/60 bg-muted/20 p-2.5">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 block">
              Total Deliverable
            </span>
            <span className="text-base font-bold text-foreground">
              {data.presentedCandidates.length}
            </span>
          </div>

          <div className="rounded border border-border/60 bg-muted/20 p-2.5">
            <span className="text-[10px] uppercase font-semibold text-emerald-600 dark:text-emerald-400 block">
              Disetujui Klien
            </span>
            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
              {data.approvedTasksCount}
            </span>
          </div>

          <div className="rounded border border-border/60 bg-muted/20 p-2.5">
            <span className="text-[10px] uppercase font-semibold text-amber-600 dark:text-amber-400 block">
              Revisi Diminta
            </span>
            <span className="text-base font-bold text-amber-600 dark:text-amber-400">
              {data.revisionTasksCount}
            </span>
          </div>

          <div className="rounded border border-border/60 bg-muted/20 p-2.5">
            <span className="text-[10px] uppercase font-semibold text-blue-600 dark:text-blue-400 block">
              Menunggu Keputusan
            </span>
            <span className="text-base font-bold text-blue-600 dark:text-blue-400">
              {data.pendingTasksCount}
            </span>
          </div>
        </div>
      </div>

      {/* Publication Info Card (if published) */}
      {data.projectStatus === "PUBLISHED" && data.publicationUrl && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-sm font-semibold text-foreground">
                Detail Publikasi Resmi
              </h3>
            </div>
            <a
              href={data.publicationUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <span>Buka Tautan Live</span>
              <ExternalLink className="size-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-emerald-500/20 pt-3 text-xs">
            <div>
              <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 block mb-0.5">
                URL Tayang
              </span>
              <span className="font-mono text-foreground break-all text-[11px]">
                {data.publicationUrl}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 block mb-0.5">
                Dipublikasikan Oleh
              </span>
              <span className="font-medium text-foreground">
                {data.publishedBy?.full_name || "SMS"}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 block mb-0.5">
                Waktu Publikasi
              </span>
              <span className="font-medium text-foreground">
                {data.publishedAt
                  ? new Date(data.publishedAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "-"}
              </span>
            </div>
          </div>

          {data.publishNote && (
            <div className="rounded border border-emerald-500/20 bg-background/60 p-2.5 text-xs text-foreground">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground block mb-0.5">
                Catatan Publikasi:
              </span>
              {data.publishNote}
            </div>
          )}
        </div>
      )}

      {/* Presented Deliverables Table / Cards */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-foreground">
              Deliverable yang Diajukan
            </h3>
            <p className="text-xs text-muted-foreground">
              Daftar artefak resmi yang dipresentasikan kepada klien pada ronde aktif.
            </p>
          </div>
        </div>

        {data.presentedCandidates.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Belum ada deliverable yang dipresentasikan untuk project ini.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {data.presentedCandidates.map((c) => {
              const hasClientVerdict = !!c.client_item;
              const isClientApproved = c.client_item?.verdict === "APPROVED";
              const canRecordVerdict =
                data.projectStatus === "CLIENT_REVIEW" &&
                data.currentRound?.overall_verdict === "PENDING" &&
                !hasClientVerdict &&
                isAuthorizedManager;

              return (
                <div
                  key={c.task_id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <TaskTypeBadge taskType={c.task_type as TaskType} />
                      <span className="text-xs font-semibold text-foreground">
                        {c.task_title}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.2 rounded">
                        v{c.version}
                      </span>
                    </div>

                    <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-2">
                      <span>PIC: {c.assignee_name}</span>
                      <span>•</span>
                      <span>File: {c.file_name}</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <FileCheck className="size-3" />
                        <span>QC Internal Lolos</span>
                      </span>
                    </div>

                    {c.client_item?.feedback_notes && (
                      <div className="mt-1 rounded border border-border/80 bg-muted/40 p-2 text-[11px] text-foreground">
                        <span className="text-[10px] font-semibold text-muted-foreground block mb-0.5">
                          Feedback Klien:
                        </span>
                        {c.client_item.feedback_notes}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                    {/* Status Badge */}
                    {hasClientVerdict ? (
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold uppercase ${
                          isClientApproved
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {isClientApproved ? (
                          <CheckCircle2 className="size-3 text-emerald-500" />
                        ) : (
                          <AlertTriangle className="size-3 text-amber-500" />
                        )}
                        <span>{isClientApproved ? "Disetujui Klien" : "Revisi Klien"}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold uppercase bg-muted text-muted-foreground">
                        <Clock className="size-3" />
                        <span>Menunggu Respon</span>
                      </span>
                    )}

                    {/* Action to Record Verdict */}
                    {canRecordVerdict && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenVerdictDialog(c)}
                        className="text-xs"
                      >
                        <span>Catat Hasil Review</span>
                        <ArrowRight className="size-3 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review Rounds History */}
      <ClientHistoryTimeline rounds={data.allRounds} />

      {/* Client Verdict Dialog */}
      {selectedCandidate && (
        <ClientVerdictDialog
          candidate={selectedCandidate}
          reviewId={data.currentRound?.id || null}
          projectId={data.projectId}
          isOpen={isVerdictDialogOpen}
          onClose={() => {
            setIsVerdictDialogOpen(false);
            setSelectedCandidate(null);
          }}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}

      {/* Publish Project Dialog */}
      <PublishProjectDialog
        projectId={data.projectId}
        projectName={projectName}
        isOpen={isPublishDialogOpen}
        onClose={() => setIsPublishDialogOpen(false)}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
