"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { TaskStatusBadge, TaskTypeBadge, TaskPriorityBadge } from "@/features/tasks/components/task-badges";
import type { TaskWithRelations, TaskStatus, TaskType } from "@/features/tasks/types";
import type { DeliverableFile } from "../types";
import { createClient } from "@/lib/supabase/client";
import {
  allocateDeliverableUploadAction,
  commitDeliverableAction,
  compensateDeliverableUploadAction,
  getDeliverableSignedUrlAction,
  softDeleteDeliverableAction,
  submitTaskForReviewAction,
  getTaskDeliverablesAction,
} from "../actions";
import { getTaskQcHistoryAction } from "@/features/approvals/actions";
import { QcHistoryTimeline } from "@/features/approvals/components/qc-history-timeline";
import { CreativeRevisionCard } from "@/features/approvals/components/creative-revision-card";
import { QcReviewDialog } from "@/features/approvals/components/qc-review-dialog";
import type { QcReviewWithRelations, RevisionRequestWithRelations } from "@/features/approvals/types";
import {
  Upload,
  FileText,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Send,
  Lock,
} from "lucide-react";

interface TaskDeliverablesDrawerProps {
  task: TaskWithRelations | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  userRole?: string;
  canManage: boolean;
  onTaskUpdated?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Byte";
  const k = 1024;
  const sizes = ["Byte", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function TaskDeliverablesDrawer({
  task,
  isOpen,
  onClose,
  currentUserId,
  userRole,
  onTaskUpdated,
}: TaskDeliverablesDrawerProps) {
  const [deliverables, setDeliverables] = React.useState<DeliverableFile[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = React.useState<string | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState(false);
  const [downloadingFileId, setDownloadingFileId] = React.useState<string | null>(null);
  const [deletingFileId, setDeletingFileId] = React.useState<string | null>(null);
  const [fileToDelete, setFileToDelete] = React.useState<DeliverableFile | null>(null);
  const [isSubmitReviewConfirmOpen, setIsSubmitReviewConfirmOpen] = React.useState(false);

  const [qcReviews, setQcReviews] = React.useState<QcReviewWithRelations[]>([]);
  const [revisionRequests, setRevisionRequests] = React.useState<RevisionRequestWithRelations[]>([]);
  const [isQcDialogOpen, setIsQcDialogOpen] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const isAssignedCreative =
    (userRole === "GRAPHIC_DESIGNER" || userRole === "VIDEO_EDITOR") &&
    Boolean(task?.current_assignee_id && task.current_assignee_id === currentUserId);
  const isProjectTerminal =
    task?.project?.status === "PUBLISHED" ||
    task?.project?.status === "CANCELLED" ||
    task?.project?.status === "ARCHIVED";
  const canUpload = isAssignedCreative && !isProjectTerminal && task?.status === "IN_PROGRESS";
  const canSubmitForReview = isAssignedCreative && !isProjectTerminal && task?.status === "IN_PROGRESS";
  const isInReview = task?.status === "IN_REVIEW";
  const isCreativeDirector = userRole === "CREATIVE_DIRECTOR";

  const loadFiles = React.useCallback(async (id: string) => {
    try {
      const res = await getTaskDeliverablesAction(id);
      if (res.success && res.data) {
        setDeliverables(res.data);
      }
    } catch (err) {
      console.error("Failed to load deliverables:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadQcHistory = React.useCallback(async (id: string) => {
    try {
      const res = await getTaskQcHistoryAction(id);
      if (res.success && res.data) {
        setQcReviews(res.data.qcReviews);
        setRevisionRequests(res.data.revisionRequests);
      }
    } catch (err) {
      console.error("Failed to load QC history:", err);
    }
  }, []);

  const taskId = task?.id;

  React.useEffect(() => {
    let ignore = false;
    if (taskId && isOpen) {
      getTaskDeliverablesAction(taskId).then((res) => {
        if (!ignore) {
          if (res.success && res.data) {
            setDeliverables(res.data);
          }
          setIsLoading(false);
        }
      });
      getTaskQcHistoryAction(taskId).then((res) => {
        if (!ignore && res.success && res.data) {
          setQcReviews(res.data.qcReviews);
          setRevisionRequests(res.data.revisionRequests);
        }
      });
    }

    return () => {
      ignore = true;
    };
  }, [taskId, isOpen]);

  if (!task) return null;

  const latestDeliverable = deliverables.length > 0 ? deliverables[0] : null;
  const previousVersions = deliverables.length > 1 ? deliverables.slice(1) : [];
  const nextVersionNumber = latestDeliverable ? latestDeliverable.version + 1 : 1;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadSuccess(null);
    setIsUploading(true);

    try {
      // Step 1: Allocate deliverable upload via server action (acquires row lock)
      const allocRes = await allocateDeliverableUploadAction({
        taskId: task.id,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSizeBytes: file.size,
        taskType: task.task_type as TaskType,
      });

      if (!allocRes.success || !allocRes.data) {
        const msg = allocRes.error || "Gagal mengalokasikan upload deliverable.";
        setUploadError(msg);
        toast.error(msg);
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      const alloc = allocRes.data;

      // Step 2: Upload directly from browser to Supabase Storage with authenticated user session
      const supabase = createClient();
      const { error: storageError } = await supabase.storage
        .from(alloc.storage_bucket)
        .upload(alloc.storage_path, file, {
          contentType: alloc.mime_type,
          upsert: false,
        });

      if (storageError) {
        const msg = storageError.message || "Gagal mengunggah file ke storage.";
        setUploadError(msg);
        toast.error(msg);
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      // Step 3: Commit metadata to project_files via server action
      const commitRes = await commitDeliverableAction({
        fileId: alloc.file_id,
        taskId: alloc.task_id,
        assetGroupId: alloc.asset_group_id,
        version: alloc.version,
        storagePath: alloc.storage_path,
        fileName: alloc.file_name,
        fileType: alloc.file_type,
        mimeType: alloc.mime_type,
        fileSizeBytes: alloc.file_size_bytes,
        projectId: task.project_id,
      });

      if (!commitRes.success) {
        // Step 4: Storage compensation - purge uncommitted storage object
        await supabase.storage
          .from(alloc.storage_bucket)
          .remove([alloc.storage_path]);

        await compensateDeliverableUploadAction(alloc.storage_path);

        const msg = commitRes.error || "Gagal mencatat metadata file deliverable.";
        setUploadError(msg);
        toast.error(msg);
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      const successMsg = `Berhasil mengunggah ${file.name} (versi v${alloc.version}).`;
      setUploadSuccess(successMsg);
      toast.success(successMsg);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";

      await loadFiles(task.id);
      if (onTaskUpdated) onTaskUpdated();
    } catch (err: unknown) {
      console.error("Direct upload error:", err);
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan upload.";
      setUploadError(msg);
      toast.error(msg);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = async (file: DeliverableFile) => {
    setDownloadingFileId(file.id);
    try {
      const res = await getDeliverableSignedUrlAction(file.id, task.project_id);
      if (!res.success || !res.data) {
        const msg = res.error || "Gagal mendapatkan URL unduhan.";
        setUploadError(msg);
        toast.error(msg);
        return;
      }

      window.open(res.data.signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handleDelete = (file: DeliverableFile) => {
    setFileToDelete(file);
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;
    setDeletingFileId(fileToDelete.id);
    try {
      const res = await softDeleteDeliverableAction(fileToDelete.id, task.id, task.project_id);
      if (!res.success) {
        const msg = res.error || "Gagal menghapus file.";
        setUploadError(msg);
        toast.error(msg);
        return;
      }
      setFileToDelete(null);
      toast.success("File deliverable berhasil dihapus.");
      await loadFiles(task.id);
      if (onTaskUpdated) onTaskUpdated();
    } finally {
      setDeletingFileId(null);
    }
  };

  const handleSubmitForReview = () => {
    if (deliverables.length === 0) {
      const msg = "Harap unggah minimal satu file deliverable sebelum mengajukan review.";
      setUploadError(msg);
      toast.error(msg);
      return;
    }
    setIsSubmitReviewConfirmOpen(true);
  };

  const confirmSubmitForReview = async () => {
    setIsSubmittingReview(true);
    setIsSubmitReviewConfirmOpen(false);
    try {
      const res = await submitTaskForReviewAction(task.id, task.project_id);
      if (!res.success) {
        const msg = res.error || "Gagal mengajukan tugas untuk review.";
        setUploadError(msg);
        toast.error(msg);
        return;
      }

      toast.success("Deliverable berhasil diajukan untuk review QC.");
      if (onTaskUpdated) onTaskUpdated();
      onClose();
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const canDeleteFile = (file: DeliverableFile) => {
    if (userRole === "ADMIN") return true;
    if (isAssignedCreative && !isProjectTerminal && file.uploaded_by === currentUserId && task.status === "IN_PROGRESS") {
      return true;
    }
    return false;
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col h-full p-0 gap-0">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-muted/20">
          <SheetHeader className="space-y-1 text-left">
            <div className="flex items-center gap-2">
              <TaskTypeBadge taskType={task.task_type as TaskType} />
              <TaskStatusBadge status={task.status as TaskStatus} />
              <TaskPriorityBadge priority={task.priority} />
            </div>
            <SheetTitle className="text-base font-semibold leading-tight text-foreground pt-1">
              {task.title}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              {userRole === "SOCIAL_MEDIA_SPECIALIST"
                ? "Pratinjau deliverable dan riwayat versi (Mode Pemantauan)"
                : "Deliverable dan riwayat versi file tugas produksi."}
            </SheetDescription>
          </SheetHeader>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-xs">
          {/* Review Freeze Alert */}
          {isInReview && (
            <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-sky-700 dark:text-sky-300 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-medium">
                  <Lock className="size-3.5 shrink-0" />
                  <span>Status: Dalam Peninjauan QC</span>
                </div>
                {isCreativeDirector && latestDeliverable && (
                  <Button
                    size="sm"
                    onClick={() => setIsQcDialogOpen(true)}
                    className="h-7 text-xs bg-primary text-primary-foreground font-medium"
                  >
                    Tinjau QC
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Tugas ini sedang ditinjau oleh Creative Director. Unggahan deliverable baru dibekukan hingga ada keputusan QC.
              </p>
            </div>
          )}

          {/* Revision Requested Banner */}
          {task.status === "REVISION_REQUESTED" && (
            <CreativeRevisionCard
              taskId={task.id}
              projectId={task.project_id}
              revisionNotes={revisionRequests[revisionRequests.length - 1]?.notes}
              roundNumber={revisionRequests[revisionRequests.length - 1]?.round_number}
              onSuccess={() => {
                if (onTaskUpdated) onTaskUpdated();
                loadFiles(task.id);
                loadQcHistory(task.id);
              }}
            />
          )}

          {/* Approved Banner */}
          {task.status === "APPROVED" && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-300 space-y-1">
              <div className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Status: Deliverable Disetujui (Terkunci)</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Aset produksi deliverable tugas ini telah disetujui oleh Creative Director dan terkunci sebagai artefak produksi resmi.
              </p>
            </div>
          )}

          {/* Upload Box (Only available during IN_PROGRESS for authorized users) */}
          {canUpload && (
            <div className="rounded-lg border border-dashed border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground text-xs">Unggah Deliverable Baru</span>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  Akan menjadi v{nextVersionNumber}
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                disabled={isUploading}
                className="hidden"
              />

              <div
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className="group flex flex-col items-center justify-center p-4 border border-border/80 rounded-md bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors text-center"
              >
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <span className="text-[11px] font-medium text-foreground">
                      Mengunggah file dan memvalidasi jalur penyimpanan...
                    </span>
                  </div>
                ) : (
                  <>
                    <Upload className="size-6 text-muted-foreground group-hover:text-primary transition-colors mb-1" />
                    <p className="font-medium text-foreground text-xs">
                      Pilih file atau seret ke area ini
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Foto, Video, Audio, PDF, ZIP (Maksimal 500MB)
                    </p>
                  </>
                )}
              </div>

              {uploadError && (
                <div className="flex items-start gap-1.5 text-[11px] text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
                  <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              {uploadSuccess && (
                <div className="flex items-start gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                  <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" />
                  <span>{uploadSuccess}</span>
                </div>
              )}
            </div>
          )}

          {/* Current / Latest Deliverable Section */}
          <div className="space-y-2">
            <h4 className="font-semibold text-foreground text-xs flex items-center justify-between">
              <span>Deliverable Terkini</span>
              {latestDeliverable && (
                <span className="text-[10px] font-normal text-muted-foreground">
                  Asset Group: {latestDeliverable.asset_group_id.slice(0, 8)}...
                </span>
              )}
            </h4>

            {isLoading ? (
              <div className="flex items-center justify-center p-6 text-muted-foreground">
                <Loader2 className="size-4 animate-spin mr-2" />
                <span>Memuat data deliverable...</span>
              </div>
            ) : !latestDeliverable ? (
              <div className="rounded-lg border border-border bg-card p-4 text-center text-muted-foreground">
                <FileText className="size-6 mx-auto mb-1 text-muted-foreground/60" />
                <p className="font-medium text-xs">Belum ada deliverable yang diunggah.</p>
                <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                  {canUpload
                    ? "Unggah versi pertama (v1) di atas untuk memulai siklus pengerjaan."
                    : "Menunggu PIC kreatif mengunggah file hasil produksi."}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-card p-3 space-y-2 shadow-2xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary text-primary-foreground">
                        v{latestDeliverable.version} (Terbaru)
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase font-mono">
                        {latestDeliverable.file_type}
                      </span>
                    </div>
                    <p className="font-medium text-foreground text-xs truncate" title={latestDeliverable.file_name}>
                      {latestDeliverable.file_name}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(latestDeliverable)}
                      disabled={downloadingFileId === latestDeliverable.id}
                      className="h-7 px-2 text-[11px] gap-1"
                    >
                      {downloadingFileId === latestDeliverable.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Download className="size-3" />
                      )}
                      <span>Unduh</span>
                    </Button>

                    {canDeleteFile(latestDeliverable) && (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(latestDeliverable)}
                              disabled={deletingFileId === latestDeliverable.id}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                              aria-label={`Hapus versi terbaru ${latestDeliverable.file_name}`}
                            >
                              {deletingFileId === latestDeliverable.id ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Trash2 className="size-3" />
                              )}
                            </Button>
                          }
                        />
                        <TooltipContent side="top">
                          Hapus file ini
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground border-t border-border/50 pt-2">
                  <div>
                    <span className="text-muted-foreground/70">Ukuran: </span>
                    <span className="font-medium text-foreground">
                      {formatBytes(latestDeliverable.file_size_bytes)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground/70">Pengunggah: </span>
                    <span className="font-medium text-foreground truncate">
                      {latestDeliverable.uploader?.full_name || "Pengguna"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground/70">Diunggah: </span>
                    <span>
                      {new Date(latestDeliverable.created_at).toLocaleString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Previous Versions History (Accordion) */}
          {previousVersions.length > 0 && (
            <div className="space-y-2 border-t border-border/60 pt-3">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center justify-between w-full text-xs font-semibold text-foreground hover:text-primary transition-colors py-1"
              >
                <span>Riwayat Versi Sebelumnya ({previousVersions.length})</span>
                {showHistory ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </button>

              {showHistory && (
                <div className="space-y-2 pt-1">
                  {previousVersions.map((file) => (
                    <div
                      key={file.id}
                      className="rounded-md border border-border/80 bg-muted/10 p-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                            v{file.version}
                          </span>
                          <span className="text-[11px] font-medium text-foreground truncate" title={file.file_name}>
                            {file.file_name}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {formatBytes(file.file_size_bytes)} &bull; {new Date(file.created_at).toLocaleDateString("id-ID")} &bull; {file.uploader?.full_name || "PIC"}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(file)}
                          disabled={downloadingFileId === file.id}
                          className="h-6 px-1.5 text-[10px] gap-1"
                        >
                          {downloadingFileId === file.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Download className="size-3" />
                          )}
                          <span>Unduh</span>
                        </Button>

                        {canDeleteFile(file) && (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(file)}
                                  disabled={deletingFileId === file.id}
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                                  aria-label={`Hapus versi ${file.version} (${file.file_name})`}
                                >
                                  <Trash2 className="size-3" />
                                </Button>
                              }
                            />
                            <TooltipContent side="top">
                              Hapus versi ini
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* QC Review History Timeline */}
          {qcReviews.length > 0 && (
            <div className="border-t border-border/60 pt-3">
              <QcHistoryTimeline reviews={qcReviews} revisions={revisionRequests} />
            </div>
          )}
        </div>

        {/* Footer Actions: Submit for Review Gate */}
        {task.status === "IN_PROGRESS" && (
          <div className="p-4 border-t border-border bg-muted/20 space-y-2">
            {canSubmitForReview ? (
              <>
                {deliverables.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1.5 py-1">
                    <AlertCircle className="size-3.5 shrink-0 text-amber-500" />
                    <span>Unggah minimal 1 file deliverable sebelum mengajukan review.</span>
                  </div>
                ) : null}

                <Button
                  onClick={handleSubmitForReview}
                  disabled={deliverables.length === 0 || isSubmittingReview}
                  className="w-full gap-2 text-xs font-medium"
                >
                  {isSubmittingReview ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  <span>Ajukan ke QC Review</span>
                </Button>
              </>
            ) : (
              <div className="text-center py-1 text-xs text-muted-foreground">
                <span>
                  {userRole === "SOCIAL_MEDIA_SPECIALIST"
                    ? "Mode Pemantauan: Pengunggahan dan pengajuan review dikelola oleh PIC kreatif."
                    : "Pengajuan review QC dikelola langsung oleh PIC kreatif yang ditugaskan."}
                </span>
              </div>
            )}
          </div>
        )}

        {/* QC Review Dialog for Creative Director */}
        {latestDeliverable && (() => {
          const previousDeliverable = deliverables.find(
            (d) =>
              d.id !== latestDeliverable.id &&
              (d.asset_group_id && latestDeliverable.asset_group_id
                ? d.asset_group_id === latestDeliverable.asset_group_id
                : true)
          ) || null;

          const sortedRevs = [...revisionRequests].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          const previousRevisionNotes = sortedRevs[0]?.notes || null;
          const hasPriorRevisions = qcReviews.length > 0 || revisionRequests.length > 0;

          return (
            <QcReviewDialog
              item={{
                task_id: task.id,
                task_title: task.title,
                task_type: task.task_type,
                priority: task.priority,
                deadline: task.deadline,
                project_id: task.project_id,
                project_code: task.project?.project_code || "",
                project_name: task.project?.name || "",
                assignee: task.current_assignee
                  ? { id: task.current_assignee.id, full_name: task.current_assignee.full_name }
                  : null,
                latest_file: {
                  id: latestDeliverable.id,
                  version: latestDeliverable.version,
                  file_name: latestDeliverable.file_name,
                  file_type: latestDeliverable.file_type,
                  mime_type: latestDeliverable.mime_type,
                  file_size_bytes: latestDeliverable.file_size_bytes,
                  storage_path: latestDeliverable.storage_path,
                  created_at: latestDeliverable.created_at,
                  uploaded_by: latestDeliverable.uploaded_by,
                  asset_group_id: latestDeliverable.asset_group_id,
                },
                previous_file: previousDeliverable
                  ? {
                      id: previousDeliverable.id,
                      version: previousDeliverable.version,
                      file_name: previousDeliverable.file_name,
                      file_type: previousDeliverable.file_type,
                      mime_type: previousDeliverable.mime_type,
                      file_size_bytes: previousDeliverable.file_size_bytes,
                      storage_path: previousDeliverable.storage_path,
                      created_at: previousDeliverable.created_at,
                      uploaded_by: previousDeliverable.uploaded_by,
                      asset_group_id: previousDeliverable.asset_group_id,
                    }
                  : null,
                previous_revision_notes: previousRevisionNotes,
                has_prior_revisions: hasPriorRevisions,
                submitted_at: latestDeliverable.created_at,
                qc_round: qcReviews.length + 1,
                prior_reviews_count: qcReviews.length,
              }}
              isOpen={isQcDialogOpen}
              onClose={() => setIsQcDialogOpen(false)}
              userRole={userRole || ""}
              onSuccess={() => {
                if (onTaskUpdated) onTaskUpdated();
                loadFiles(task.id);
                loadQcHistory(task.id);
              }}
            />
          );
        })()}

        {/* Delete Deliverable File Alert Dialog */}
        <AlertDialog
          open={Boolean(fileToDelete)}
          onOpenChange={(open) => {
            if (!open) setFileToDelete(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-semibold">
                Hapus File Deliverable?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground">
                Hapus deliverable &quot;{fileToDelete?.file_name}&quot; (v{fileToDelete?.version})? Tindakan ini akan dicatat dalam riwayat aktivitas proyek.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={Boolean(deletingFileId)}>Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteFile}
                disabled={Boolean(deletingFileId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletingFileId ? "Menghapus..." : "Hapus File"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Submit For Review Alert Dialog */}
        <AlertDialog
          open={isSubmitReviewConfirmOpen}
          onOpenChange={setIsSubmitReviewConfirmOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-semibold">
                Ajukan Deliverable untuk Review QC?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground">
                Setelah diajukan, status tugas menjadi IN_REVIEW dan pengunggahan file baru akan dikunci sementara hingga review internal selesai. Lanjutkan pengajuan?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmittingReview}>Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmSubmitForReview}
                disabled={isSubmittingReview}
              >
                {isSubmittingReview ? "Mengajukan..." : "Ajukan Review"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
