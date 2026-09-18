"use client";

import * as React from "react";
import { transitionTaskStatusAction } from "../actions";
import type { TaskWithRelations, TaskStatus } from "../types";
import {
  Play,
  Loader2,
  AlertCircle,
  Upload,
  FileText,
  CheckCircle,
  CheckCircle2,
  UserPlus,
  Layers,
  Globe,
  ExternalLink,
  FileCheck,
} from "lucide-react";
import { toast } from "@/components/ui/toast";

interface TaskStatusControlProps {
  task: TaskWithRelations;
  projectId: string;
  currentUserId: string;
  userRole?: string;
  canManage: boolean;
  isProjectTerminal?: boolean;
  onOpenDeliverables?: () => void;
  onOpenAssign?: () => void;
  onOpenClientReview?: () => void;
  onOpenPublish?: () => void;
  onSuccess?: () => void;
}

export function TaskStatusControl({
  task,
  projectId,
  currentUserId,
  userRole,
  canManage,
  isProjectTerminal = false,
  onOpenDeliverables,
  onOpenAssign,
  onOpenClientReview,
  onOpenPublish,
  onSuccess,
}: TaskStatusControlProps) {
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const isAssignee = Boolean(task.current_assignee_id && task.current_assignee_id === currentUserId);
  const isCreativeRole = userRole === "GRAPHIC_DESIGNER" || userRole === "VIDEO_EDITOR";
  const isAssignedCreative = isCreativeRole && isAssignee;
  const hasNoPic = !task.current_assignee_id;

  // "Mulai Kerjakan" strictly only for active assigned creative
  const canStartWork =
    isAssignedCreative &&
    !isProjectTerminal &&
    (task.status === "TODO" || task.status === "REVISION_REQUESTED");

  const handleTransition = async (targetStatus: TaskStatus) => {
    setActionError(null);
    setIsUpdating(true);

    const res = await transitionTaskStatusAction(task.id, projectId, targetStatus);

    if (!res.success) {
      const msg = res.error || "Gagal mengubah status tugas.";
      setActionError(msg);
      toast.error(msg);
      setIsUpdating(false);
      return;
    }

    toast.success(
      task.status === "REVISION_REQUESTED"
        ? "Pengerjaan revisi dimulai."
        : "Pengerjaan tugas dimulai."
    );
    setIsUpdating(false);
    if (onSuccess) {
      onSuccess();
    }
  };

  if (isProjectTerminal) {
    return (
      <div className="text-[11px] text-muted-foreground/70 italic">
        Proyek selesai
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {actionError && (
        <div className="flex items-center gap-1.5 text-[11px] text-destructive mb-1">
          <AlertCircle className="size-3 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Task without PIC */}
      {hasNoPic && (task.status === "TODO" || task.status === "REVISION_REQUESTED") ? (
        canManage ? (
          <button
            type="button"
            onClick={onOpenAssign}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
          >
            <UserPlus className="size-3" />
            <span>Tugaskan PIC</span>
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/80 italic">
            Belum ada PIC
          </span>
        )
      ) : canStartWork ? (
        /* Assigned creative starting work */
        <button
          type="button"
          onClick={() => handleTransition("IN_PROGRESS")}
          disabled={isUpdating}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 shadow-2xs cursor-pointer"
        >
          {isUpdating ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Play className="size-3" />
          )}
          <span>{task.status === "REVISION_REQUESTED" ? "Mulai Revisi" : "Mulai Kerjakan"}</span>
        </button>
      ) : task.status === "TODO" ? (
        /* TODO state where user is not the assigned creative */
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/80">
          Menunggu pengerjaan
        </span>
      ) : task.status === "IN_PROGRESS" ? (
        isAssignedCreative ? (
          <button
            type="button"
            onClick={onOpenDeliverables}
            className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 dark:bg-sky-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-700 transition-colors focus:outline-none focus:ring-1 focus:ring-ring shadow-2xs cursor-pointer"
          >
            <Upload className="size-3" />
            <span>Unggah File</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenDeliverables}
            className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-xs font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 transition-colors focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
          >
            <Layers className="size-3 text-sky-500" />
            <span>{userRole === "SOCIAL_MEDIA_SPECIALIST" ? "Lihat Deliverable" : "Deliverables"}</span>
          </button>
        )
      ) : task.status === "IN_REVIEW" ? (
        userRole === "CREATIVE_DIRECTOR" ? (
          <button
            type="button"
            onClick={onOpenDeliverables}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 dark:bg-amber-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 transition-colors focus:outline-none focus:ring-1 focus:ring-ring shadow-2xs cursor-pointer"
          >
            <FileText className="size-3" />
            <span>Review QC</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenDeliverables}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
          >
            <FileText className="size-3 text-amber-500" />
            <span>{userRole === "SOCIAL_MEDIA_SPECIALIST" ? "Lihat Deliverable" : "Dalam Review"}</span>
          </button>
        )
      ) : task.status === "REVISION_REQUESTED" ? (
        <button
          type="button"
          onClick={onOpenDeliverables}
          className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 transition-colors focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
        >
          <AlertCircle className="size-3 text-rose-500" />
          <span>Lihat Revisi</span>
        </button>
      ) : task.status === "APPROVED" ? (
        canManage ? (
          <div className="inline-flex items-center gap-1.5">
            {task.latest_client_review?.verdict === "APPROVED" ? (
              <button
                type="button"
                onClick={onOpenPublish}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white transition-colors shadow-2xs cursor-pointer"
                title="Konten telah disetujui klien, klik untuk publikasikan"
              >
                <Globe className="size-3" />
                <span>Publikasikan</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenClientReview}
                className="inline-flex items-center gap-1 rounded-md bg-primary hover:bg-primary/90 px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-colors shadow-2xs cursor-pointer"
                title="Catat respon atau persetujuan klien untuk tugas ini"
              >
                <FileCheck className="size-3" />
                <span>Review Klien</span>
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenDeliverables}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
          >
            <CheckCircle className="size-3 text-emerald-500" />
            <span>QC Lolos</span>
          </button>
        )
      ) : task.status === "COMPLETED" ? (
        <div className="inline-flex items-center gap-1.5">
          {task.publication_url ? (
            <a
              href={task.publication_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              title="Buka tautan postingan live di media sosial"
            >
              <Globe className="size-3 text-emerald-500" />
              <span>Tayang</span>
              <ExternalLink className="size-2.5" />
            </a>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-3 text-emerald-500" />
              <span>Selesai</span>
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
