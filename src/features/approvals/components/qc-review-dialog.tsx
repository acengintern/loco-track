"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { TaskTypeBadge, TaskPriorityBadge } from "@/features/tasks/components/task-badges";
import type { ApprovalQueueItem, QcReviewWithRelations, RevisionRequestWithRelations } from "../types";
import { submitQcVerdictAction, getTaskQcHistoryAction } from "../actions";
import { getDeliverableSignedUrlAction } from "@/features/deliverables/actions";
import { QcHistoryTimeline } from "./qc-history-timeline";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  AlertTriangle,
  FileText,
  Download,
  Eye,
  Loader2,
  AlertCircle,
  User,
  Calendar,
  RotateCcw,
  Video,
  ImageIcon,
} from "lucide-react";
import Image from "next/image";

interface QcReviewDialogProps {
  item: ApprovalQueueItem | null;
  isOpen: boolean;
  onClose: () => void;
  userRole: string;
  onSuccess?: () => void;
}

export function QcReviewDialog({
  item,
  isOpen,
  onClose,
  userRole,
  onSuccess,
}: QcReviewDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Active view tab: latest vs previous comparison
  const [activeVersionTab, setActiveVersionTab] = React.useState<"latest" | "previous">("latest");
  const [latestSignedUrl, setLatestSignedUrl] = React.useState<string | null>(null);
  const [previousSignedUrl, setPreviousSignedUrl] = React.useState<string | null>(null);
  const [isLoadingLatestPreview, setIsLoadingLatestPreview] = React.useState(false);
  const [isLoadingPreviousPreview, setIsLoadingPreviousPreview] = React.useState(false);

  const [qcReviews, setQcReviews] = React.useState<QcReviewWithRelations[]>([]);
  const [revisionRequests, setRevisionRequests] = React.useState<RevisionRequestWithRelations[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);

  const [isRevisionMode, setIsRevisionMode] = React.useState(false);
  const [revisionNotes, setRevisionNotes] = React.useState("");
  const [isApproveConfirm, setIsApproveConfirm] = React.useState(false);

  const isCreativeDirector = userRole === "CREATIVE_DIRECTOR";

  const [prevOpen, setPrevOpen] = React.useState(isOpen);
  const [prevTaskId, setPrevTaskId] = React.useState<string | null>(item?.task_id || null);

  if (prevOpen !== isOpen || prevTaskId !== (item?.task_id || null)) {
    setPrevOpen(isOpen);
    setPrevTaskId(item?.task_id || null);
    if (isOpen && item) {
      setActiveVersionTab("latest");
      setLatestSignedUrl(null);
      setPreviousSignedUrl(null);
      setIsLoadingLatestPreview(Boolean(item.latest_file));
      setIsLoadingPreviousPreview(Boolean(item.previous_file && item.has_prior_revisions));
      setIsLoadingHistory(true);
      setQcReviews([]);
      setRevisionRequests([]);
      setIsRevisionMode(false);
      setIsApproveConfirm(false);
      setRevisionNotes("");
      setErrorMessage(null);
    }
  }

  const handleModalClose = React.useCallback(() => {
    setActiveVersionTab("latest");
    setLatestSignedUrl(null);
    setPreviousSignedUrl(null);
    setQcReviews([]);
    setRevisionRequests([]);
    setIsRevisionMode(false);
    setIsApproveConfirm(false);
    setRevisionNotes("");
    setErrorMessage(null);
    onClose();
  }, [onClose]);

  React.useEffect(() => {
    if (!isOpen || !item) {
      return;
    }

    let isMounted = true;

    // Fetch signed URL for latest candidate deliverable
    if (item.latest_file) {
      getDeliverableSignedUrlAction(item.latest_file.id, item.project_id)
        .then((res) => {
          if (isMounted) {
            if (res.success && res.data?.signedUrl) {
              setLatestSignedUrl(res.data.signedUrl);
            }
            setIsLoadingLatestPreview(false);
          }
        })
        .catch(() => {
          if (isMounted) setIsLoadingLatestPreview(false);
        });
    }

    // Fetch signed URL for lineage-safe previous deliverable (if any)
    if (item.previous_file && item.has_prior_revisions) {
      getDeliverableSignedUrlAction(item.previous_file.id, item.project_id)
        .then((res) => {
          if (isMounted) {
            if (res.success && res.data?.signedUrl) {
              setPreviousSignedUrl(res.data.signedUrl);
            }
            setIsLoadingPreviousPreview(false);
          }
        })
        .catch(() => {
          if (isMounted) setIsLoadingPreviousPreview(false);
        });
    }

    // Fetch chronological QC history
    getTaskQcHistoryAction(item.task_id)
      .then((res) => {
        if (isMounted) {
          if (res.success && res.data) {
            setQcReviews(res.data.qcReviews);
            setRevisionRequests(res.data.revisionRequests);
          }
          setIsLoadingHistory(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoadingHistory(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, item]);

  if (!item) return null;

  const handleApprove = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);

    const res = await submitQcVerdictAction(item.task_id, item.project_id, "APPROVED");

    if (!res.success) {
      const msg = res.error || "Gagal menyetujui deliverable.";
      setErrorMessage(msg);
      toast.error(msg);
      setIsSubmitting(false);
      return;
    }

    toast.success("Deliverable berhasil disetujui internal (Lolos QC untuk Client Review).");
    setIsSubmitting(false);
    handleModalClose();
    if (onSuccess) onSuccess();
  };

  const handleRequestRevision = async () => {
    if (!revisionNotes.trim()) {
      const msg = "Catatan revisi wajib diisi secara spesifik.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const res = await submitQcVerdictAction(
      item.task_id,
      item.project_id,
      "REVISION_REQUESTED",
      revisionNotes.trim()
    );

    if (!res.success) {
      const msg = res.error || "Gagal mengajukan revisi.";
      setErrorMessage(msg);
      toast.error(msg);
      setIsSubmitting(false);
      return;
    }

    toast.success("Permintaan revisi berhasil dikirim ke PIC.");
    setIsSubmitting(false);
    handleModalClose();
    if (onSuccess) onSuccess();
  };

  // Determine active media properties based on active tab
  const activeFile = activeVersionTab === "latest" ? item.latest_file : item.previous_file;
  const activeSignedUrl = activeVersionTab === "latest" ? latestSignedUrl : previousSignedUrl;
  const isLoadingActivePreview =
    activeVersionTab === "latest" ? isLoadingLatestPreview : isLoadingPreviousPreview;

  const fileType = activeFile?.file_type || "";
  const mimeType = activeFile?.mime_type || "";
  const fileName = activeFile?.file_name || "";

  const isImage =
    mimeType.startsWith("image/") ||
    ["DESIGN", "BRIEF", "REFERENCE"].includes(fileType) ||
    /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(fileName);

  const isVideo =
    mimeType.startsWith("video/") ||
    fileType === "VIDEO" ||
    /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(fileName);

  const canCompareVersions = Boolean(item.previous_file && item.has_prior_revisions);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleModalClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[calc(100dvh-3.5rem)] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl">
        <DialogHeader className="px-6 py-5 border-b border-border/80 bg-card shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-primary">
                {item.project_code}
              </span>
              <span className="text-muted-foreground text-xs">/</span>
              <span className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-md">
                {item.project_name}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <TaskTypeBadge taskType={item.task_type} />
              <TaskPriorityBadge priority={item.priority} />
            </div>
          </div>
          <DialogTitle className="text-lg font-semibold text-foreground">
            {item.task_title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Peninjauan kualitas internal tugas produksi sebelum diteruskan ke peninjauan klien.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-xs">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Task & Candidate Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg border border-border bg-card p-3 text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">PIC Pelaksana</span>
              <span className="font-medium text-foreground mt-0.5 flex items-center gap-1">
                <User className="size-3 text-muted-foreground" />
                {item.assignee ? item.assignee.full_name : "Belum ditugaskan"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Deadline Tugas</span>
              <span className="font-medium text-foreground mt-0.5 flex items-center gap-1">
                <Calendar className="size-3 text-muted-foreground" />
                {item.deadline ? new Date(item.deadline).toLocaleDateString("id-ID") : "Tidak ada"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Kandidat Review</span>
              <span className="font-mono font-semibold text-foreground mt-0.5 block">
                {item.latest_file ? `Versi v${item.latest_file.version}` : "Belum ada file"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Status Putaran</span>
              {item.has_prior_revisions ? (
                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold mt-0.5">
                  <RotateCcw className="size-3" />
                  Ronde {item.qc_round} (Revisi)
                </span>
              ) : (
                <span className="font-medium text-foreground mt-0.5 block">
                  Ronde 1 (Baru)
                </span>
              )}
            </div>
          </div>

          {/* Previous Revision Notes Callout (If re-reviewing after revision) */}
          {item.has_prior_revisions && item.previous_revision_notes && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <RotateCcw className="size-3.5" />
                <span>Catatan Revisi Sebelumnya (Menuju Ronde {item.qc_round})</span>
              </div>
              <div className="rounded border border-amber-500/15 bg-background/60 p-2.5 text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {item.previous_revision_notes}
              </div>
            </div>
          )}

          {/* Deliverable Preview Container */}
          <div className="rounded-lg border border-border bg-card/60 p-4 space-y-3">
            {/* Version Comparison Tabs & Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {/* Version Comparison Toggle */}
              {canCompareVersions ? (
                <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-1 border border-border/80">
                  <button
                    type="button"
                    onClick={() => setActiveVersionTab("latest")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs transition-colors",
                      activeVersionTab === "latest"
                        ? "bg-background text-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground font-medium"
                    )}
                  >
                    <FileText className="size-3 text-primary" />
                    <span>Versi Terkini (v{item.latest_file?.version})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveVersionTab("previous")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs transition-colors",
                      activeVersionTab === "previous"
                        ? "bg-background text-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground font-medium"
                    )}
                  >
                    <RotateCcw className="size-3 text-amber-500" />
                    <span>Versi Sebelumnya (v{item.previous_file?.version})</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-primary shrink-0" />
                  <span className="text-xs font-semibold text-foreground truncate max-w-[200px] sm:max-w-md">
                    {activeFile ? activeFile.file_name : "File Deliverable"}
                  </span>
                  {activeFile && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground shrink-0">
                      v{activeFile.version}
                    </span>
                  )}
                </div>
              )}

              {/* Download / Open File Button */}
              {activeSignedUrl && (
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <a
                    href={activeSignedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors shrink-0"
                  >
                    <Eye className="size-3" />
                    <span>Buka Penuh</span>
                  </a>
                  <a
                    href={activeSignedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors shrink-0"
                  >
                    <Download className="size-3" />
                    <span>Unduh</span>
                  </a>
                </div>
              )}
            </div>

            {/* Active File Context Label when Tab Switcher is present */}
            {canCompareVersions && (
              <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/50 pt-2">
                <span className="truncate max-w-[300px]">
                  Nama file: <strong className="text-foreground">{activeFile?.file_name}</strong>
                </span>
                <span className="font-mono text-[10px]">
                  {activeVersionTab === "latest" ? "Kandidat Final (Terkini)" : "Aset Sebelum Revisi Terakhir"}
                </span>
              </div>
            )}

            {/* Media Viewport */}
            <div className="rounded-md border border-border/80 bg-background/50 flex flex-col items-center justify-center min-h-[260px] p-2 overflow-hidden">
              {isLoadingActivePreview ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-12">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Memuat pratinjau media deliverable...</span>
                </div>
              ) : activeSignedUrl ? (
                isVideo ? (
                  <div className="w-full flex flex-col items-center">
                    <video
                      key={activeSignedUrl}
                      src={activeSignedUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="max-h-[420px] w-full rounded bg-black object-contain shadow-inner"
                    >
                      Browser Anda tidak mendukung pemutaran video langsung.
                    </video>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-2">
                      <Video className="size-3 text-primary" />
                      <span>Pemutar HTML5 aktif. Gunakan kontrol pemutar untuk memeriksa audio dan visual.</span>
                    </div>
                  </div>
                ) : isImage ? (
                  <div className="w-full flex flex-col items-center">
                    <Image
                      unoptimized
                      src={activeSignedUrl}
                      alt={activeFile?.file_name || "Deliverable"}
                      width={1200}
                      height={600}
                      className="max-h-[420px] w-auto object-contain rounded"
                    />
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-2">
                      <ImageIcon className="size-3 text-primary" />
                      <span>Pratinjau visual resolusi tinggi. Klik &ldquo;Buka Penuh&rdquo; untuk inspeksi detail 1:1.</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 space-y-3">
                    <FileText className="size-12 text-muted-foreground mx-auto" />
                    <div>
                      <p className="text-xs font-medium text-foreground">
                        {activeFile?.file_name}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Pratinjau media langsung tidak didukung untuk tipe file ini.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <a
                        href={activeSignedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                      >
                        <Eye className="size-3.5" />
                        <span>Buka File di Tab Baru</span>
                      </a>
                    </div>
                  </div>
                )
              ) : (
                <p className="text-xs text-muted-foreground py-10">
                  File deliverable tidak ditemukan atau tautan pratinjau kedaluwarsa.
                </p>
              )}
            </div>
          </div>

          {/* Prior QC History Timeline */}
          <div className="rounded-lg border border-border bg-card/40 p-4">
            {isLoadingHistory ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="size-3.5 animate-spin" />
                <span>Memuat riwayat evaluasi QC...</span>
              </div>
            ) : (
              <QcHistoryTimeline reviews={qcReviews} revisions={revisionRequests} />
            )}
          </div>
        </div>

        {/* Decision & Action Footer */}
        <div className="px-6 py-4.5 sm:py-5 border-t border-border bg-muted/20 shrink-0 mt-0">
          {!isCreativeDirector ? (
            <div className="rounded-md border border-border/80 bg-muted/40 p-3 text-xs text-muted-foreground flex items-center justify-between gap-3">
              <span>Mode peninjauan monitoring (Read-only). Keputusan QC resmi hanya dapat diterbitkan oleh Creative Director.</span>
              <Button type="button" variant="outline" size="sm" onClick={handleModalClose}>
                Tutup
              </Button>
            </div>
          ) : isApproveConfirm ? (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>Konfirmasi Persetujuan QC Internal</span>
              </div>
              <p className="text-xs text-foreground leading-relaxed">
                Setujui versi v{item.latest_file?.version} untuk tugas &ldquo;{item.task_title}&rdquo;? Setelah disetujui secara internal oleh Creative Director, deliverable ini akan diteruskan ke tahap peninjauan klien (Client Review).
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => setIsApproveConfirm(false)}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={handleApprove}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {isSubmitting ? (
                    <Loader2 className="size-3 animate-spin mr-1.5" />
                  ) : (
                    <CheckCircle2 className="size-3.5 mr-1.5" />
                  )}
                  <span>Ya, Setujui Deliverable</span>
                </Button>
              </div>
            </div>
          ) : isRevisionMode ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-xs">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>Catatan Revisi Internal (Kandidat v{item.latest_file?.version})</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {revisionNotes.length}/5000 karakter
                </span>
              </div>

              <textarea
                aria-label="Catatan revisi internal"
                value={revisionNotes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRevisionNotes(e.target.value)}
                maxLength={5000}
                placeholder="Tuliskan catatan revisi yang spesifik dan dapat ditindaklanjuti oleh PIC (contoh: Koreksi ritme video pada detik 00:04, sesuaikan font headline)..."
                rows={3}
                className="w-full rounded-md border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => setIsRevisionMode(false)}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isSubmitting || !revisionNotes.trim()}
                  onClick={handleRequestRevision}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
                >
                  {isSubmitting ? (
                    <Loader2 className="size-3 animate-spin mr-1.5" />
                  ) : (
                    <AlertTriangle className="size-3.5 mr-1.5" />
                  )}
                  <span>Kirim Permintaan Revisi</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" size="sm" onClick={handleModalClose}>
                Tutup
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIsRevisionMode(true)}
                  className="border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 font-medium"
                >
                  <AlertTriangle className="size-3.5 mr-1.5 text-amber-500" />
                  <span>Minta Revisi</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsApproveConfirm(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                >
                  <CheckCircle2 className="size-3.5 mr-1.5" />
                  <span>Setujui Deliverable</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
