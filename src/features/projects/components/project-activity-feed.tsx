import * as React from "react";
import {
  Activity,
  PlusCircle,
  FileEdit,
  UserPlus,
  UserMinus,
  Archive,
  CheckCircle2,
  ListTodo,
  UserCheck,
  PlayCircle,
  Layers,
  Calendar,
  FileText,
  Upload,
  RefreshCw,
  AlertCircle,
  Globe,
  MessageSquare,
  Send,
  ClipboardCheck,
} from "lucide-react";
import type { ProjectActivityLog } from "../types";
import { ROLE_LABELS } from "@/constants/navigation";

interface ProjectActivityFeedProps {
  logs: ProjectActivityLog[];
}

interface EventMetaResult {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function getEventMeta(log: ProjectActivityLog): EventMetaResult {
  const meta = log.metadata || {};
  const actor = log.user ? log.user.full_name : "Sistem";

  switch (log.event_type) {
    case "TASK_CREATED": {
      const taskTitle = (meta.title || meta.task_title || meta.name) as string | undefined;
      const typeLabel =
        meta.task_type === "VIDEO_EDITING"
          ? "Video Editing"
          : meta.task_type === "GRAPHIC_DESIGN"
            ? "Graphic Design"
            : undefined;
      const target = taskTitle || typeLabel || "produksi";
      return {
        icon: <ListTodo className="size-3.5 text-indigo-600 dark:text-indigo-400" />,
        title: "Task Dibuat",
        description: `${actor} membuat task ${target}.`,
      };
    }

    case "TASK_ASSIGNED": {
      const taskTitle = (meta.title || meta.task_title || meta.name) as string | undefined;
      const assignee = (meta.assignee_name || meta.assigned_to_name || meta.target_user_name) as string | undefined;
      const target = taskTitle || "Task";
      const desc = assignee
        ? `${target} ditugaskan kepada ${assignee}.`
        : `${target} telah ditugaskan oleh ${actor}.`;
      return {
        icon: <UserCheck className="size-3.5 text-blue-600 dark:text-blue-400" />,
        title: "Task Ditugaskan",
        description: desc,
      };
    }

    case "TASK_STARTED": {
      const taskTitle = (meta.task_title || meta.title || meta.name) as string | undefined;
      const target = taskTitle || "task produksi";
      return {
        icon: <PlayCircle className="size-3.5 text-amber-600 dark:text-amber-400" />,
        title: "Pengerjaan Dimulai",
        description: `${actor} mulai mengerjakan ${target}.`,
      };
    }

    case "TASK_REASSIGNED": {
      const taskTitle = (meta.task_title || meta.title) as string | undefined;
      const newAssignee = (meta.new_assignee_name || meta.assignee_name) as string | undefined;
      const prevAssignee = (meta.previous_assignee_name || meta.prev_assignee_name) as string | undefined;
      const target = taskTitle ? `Task "${taskTitle}"` : "Penugasan task";
      let desc = `${target} dialihkan oleh ${actor}.`;
      if (newAssignee && prevAssignee) {
        desc = `${target} dialihkan dari ${prevAssignee} ke ${newAssignee}.`;
      } else if (newAssignee) {
        desc = `${target} dialihkan penugasannya kepada ${newAssignee}.`;
      }
      return {
        icon: <UserPlus className="size-3.5 text-sky-600 dark:text-sky-400" />,
        title: "Penugasan Dialihkan",
        description: desc,
      };
    }

    case "TASK_STATUS_CHANGED": {
      const taskTitle = (meta.task_title || meta.title) as string | undefined;
      const toStatus = (meta.to_status || meta.new_status || meta.status) as string | undefined;
      const target = taskTitle ? `"${taskTitle}"` : "task";
      let desc = `Status ${target} diperbarui oleh ${actor}.`;
      if (toStatus === "IN_REVIEW") {
        desc = `${actor} mengajukan ${target} untuk review QC internal.`;
      } else if (toStatus === "APPROVED") {
        desc = `${target} disetujui pada evaluasi QC.`;
      } else if (toStatus === "COMPLETED") {
        desc = `${target} diselesaikan oleh ${actor}.`;
      } else if (toStatus === "REVISION_REQUESTED") {
        desc = `${target} memerlukan revisi perbaikan.`;
      } else if (toStatus) {
        desc = `Status ${target} diubah menjadi ${toStatus}.`;
      }
      return {
        icon: <RefreshCw className="size-3.5 text-violet-600 dark:text-violet-400" />,
        title: "Status Task Diperbarui",
        description: desc,
      };
    }

    case "TASK_UPDATED": {
      const taskTitle = (meta.task_title || meta.title) as string | undefined;
      return {
        icon: <FileEdit className="size-3.5 text-blue-600 dark:text-blue-400" />,
        title: "Task Diperbarui",
        description: `${actor} memperbarui rincian ${taskTitle ? `task "${taskTitle}"` : "task"}.`,
      };
    }

    case "TASK_ARCHIVED": {
      const taskTitle = (meta.task_title || meta.title) as string | undefined;
      return {
        icon: <Archive className="size-3.5 text-muted-foreground" />,
        title: "Task Diarsipkan",
        description: `${actor} mengarsipkan ${taskTitle ? `task "${taskTitle}"` : "task"}.`,
      };
    }

    case "SCRIPT_CREATED": {
      const title = (meta.title || meta.script_title) as string | undefined;
      return {
        icon: <Layers className="size-3.5 text-cyan-600 dark:text-cyan-400" />,
        title: "Naskah Dibuat",
        description: `${actor} membuat naskah project${title ? `: "${title}"` : ""}.`,
      };
    }

    case "SCRIPT_UPDATED": {
      const title = (meta.title || meta.script_title) as string | undefined;
      return {
        icon: <FileEdit className="size-3.5 text-blue-600 dark:text-blue-400" />,
        title: "Naskah Diperbarui",
        description: `${actor} memperbarui naskah project${title ? `: "${title}"` : ""}.`,
      };
    }

    case "SCRIPT_READY": {
      const title = (meta.title || meta.script_title) as string | undefined;
      return {
        icon: <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />,
        title: "Naskah Siap Produksi",
        description: `Naskah project${title ? ` "${title}"` : ""} disetujui dan siap masuk tahap produksi.`,
      };
    }

    case "CONTENT_PLAN_CREATED": {
      const title = (meta.title || meta.plan_title) as string | undefined;
      return {
        icon: <Calendar className="size-3.5 text-purple-600 dark:text-purple-400" />,
        title: "Content Plan Ditambahkan",
        description: `${actor} menambahkan content plan${title ? `: "${title}"` : ""}.`,
      };
    }

    case "CONTENT_PLAN_UPDATED": {
      const title = (meta.title || meta.plan_title) as string | undefined;
      return {
        icon: <FileEdit className="size-3.5 text-purple-600 dark:text-purple-400" />,
        title: "Content Plan Diperbarui",
        description: `${actor} memperbarui content plan${title ? `: "${title}"` : ""}.`,
      };
    }

    case "BRIEF_CREATED": {
      return {
        icon: <FileText className="size-3.5 text-teal-600 dark:text-teal-400" />,
        title: "Brief Dibuat",
        description: `Brief project dibuat oleh ${actor}.`,
      };
    }

    case "BRIEF_UPDATED": {
      return {
        icon: <FileEdit className="size-3.5 text-teal-600 dark:text-teal-400" />,
        title: "Brief Diperbarui",
        description: `${actor} memperbarui arahan brief project.`,
      };
    }

    case "DELIVERABLE_UPLOADED":
    case "FILE_UPLOADED": {
      const fileName = (meta.file_name || meta.name || meta.title) as string | undefined;
      const version = meta.version ? `v${meta.version}` : undefined;
      return {
        icon: <Upload className="size-3.5 text-emerald-600 dark:text-emerald-400" />,
        title: "Deliverable Diunggah",
        description: `${actor} mengunggah berkas ${fileName ? `"${fileName}"` : "deliverable"}${version ? ` (${version})` : ""}.`,
      };
    }

    case "FILE_VERSION_BUMPED": {
      const fileName = (meta.file_name || meta.name) as string | undefined;
      const version = meta.version ? `v${meta.version}` : undefined;
      return {
        icon: <RefreshCw className="size-3.5 text-emerald-600 dark:text-emerald-400" />,
        title: "Versi Deliverable Baru",
        description: `${actor} meningkatkan versi ${fileName ? `"${fileName}"` : "deliverable"}${version ? ` ke ${version}` : ""}.`,
      };
    }

    case "FILE_DELETED":
    case "FILE_SOFT_DELETED": {
      const fileName = (meta.file_name || meta.name) as string | undefined;
      return {
        icon: <Archive className="size-3.5 text-destructive" />,
        title: "Deliverable Dihapus",
        description: `${actor} menghapus berkas deliverable${fileName ? ` "${fileName}"` : ""}.`,
      };
    }

    case "INTERNAL_QC_STARTED": {
      return {
        icon: <ClipboardCheck className="size-3.5 text-amber-600 dark:text-amber-400" />,
        title: "QC Dimulai",
        description: `Pemeriksaan Quality Control (QC) internal dimulai oleh ${actor}.`,
      };
    }

    case "QC_APPROVED":
    case "INTERNAL_QC_APPROVED":
    case "INTERNAL_QC_COMPLETED": {
      return {
        icon: <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />,
        title: "Disetujui QC Internal",
        description: `Deliverable telah diperiksa dan disetujui pada tahap QC oleh ${actor}.`,
      };
    }

    case "QC_REJECTED":
    case "INTERNAL_QC_REJECTED": {
      const notes = meta.notes as string | undefined;
      return {
        icon: <AlertCircle className="size-3.5 text-amber-600 dark:text-amber-400" />,
        title: "Catatan QC Diajukan",
        description: `${actor} meminta revisi internal atas hasil evaluasi deliverable${notes ? `: "${notes}"` : ""}.`,
      };
    }

    case "REVISION_REQUESTED": {
      const notes = meta.notes as string | undefined;
      const isClient = meta.source === "CLIENT";
      return {
        icon: <AlertCircle className="size-3.5 text-rose-600 dark:text-rose-400" />,
        title: isClient ? "Revisi Klien Diajukan" : "Catatan Revisi QC",
        description: `${actor} mengajukan catatan revisi ${isClient ? "klien" : "QC internal"}${notes ? `: "${notes}"` : ""}.`,
      };
    }

    case "REVISION_RESOLVED": {
      return {
        icon: <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />,
        title: "Revisi Diselesaikan",
        description: `Catatan revisi telah diselesaikan dan diperbaiki oleh ${actor}.`,
      };
    }

    case "CLIENT_REVIEW_ROUND_STARTED": {
      const round = (meta.round_number || meta.round) as number | undefined;
      return {
        icon: <Globe className="size-3.5 text-purple-600 dark:text-purple-400" />,
        title: "Review Klien Dibuka",
        description: `${actor} membuka putaran review klien${round ? ` ke-${round}` : ""} untuk evaluasi materi.`,
      };
    }

    case "CLIENT_FEEDBACK_RECORDED": {
      const verdict = (meta.verdict || meta.overall_verdict) as string | undefined;
      const verdictLabel =
        verdict === "APPROVED"
          ? "Disetujui"
          : verdict === "REVISION_REQUESTED"
            ? "Perlu Revisi"
            : verdict;
      return {
        icon: <MessageSquare className="size-3.5 text-purple-600 dark:text-purple-400" />,
        title: "Respon Klien Dicatat",
        description: `${actor} mencatat respon evaluasi klien${verdictLabel ? ` (${verdictLabel})` : ""}.`,
      };
    }

    case "CLIENT_REVISION_DISPATCHED": {
      return {
        icon: <Send className="size-3.5 text-amber-600 dark:text-amber-400" />,
        title: "Revisi Klien Diteruskan",
        description: `${actor} meneruskan catatan revisi klien ke tim produksi.`,
      };
    }

    case "PROJECT_CREATED": {
      return {
        icon: <PlusCircle className="size-3.5 text-emerald-600 dark:text-emerald-400" />,
        title: "Project Dibuat",
        description: `${actor} membuat project ini dengan status awal Brief Received.`,
      };
    }

    case "PROJECT_UPDATED": {
      return {
        icon: <FileEdit className="size-3.5 text-blue-600 dark:text-blue-400" />,
        title: "Metadata Diperbarui",
        description: `${actor} memperbarui informasi jadwal, prioritas, atau detail project.`,
      };
    }

    case "PROJECT_STATUS_CHANGED": {
      const to = (meta.new_status || meta.to_status || meta.status) as string | undefined;
      return {
        icon: <RefreshCw className="size-3.5 text-blue-600 dark:text-blue-400" />,
        title: "Status Project Diperbarui",
        description: `${actor} memperbarui status alur kerja project${to ? ` menjadi ${to}` : ""}.`,
      };
    }

    case "PROJECT_PUBLISHED": {
      return {
        icon: <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />,
        title: "Project Dipublikasikan",
        description: `${actor} menandai materi project telah resmi dipublikasikan ke kanal publik.`,
      };
    }

    case "MEMBER_ADDED": {
      const name = (meta.full_name || meta.user_name) as string | undefined;
      return {
        icon: <UserPlus className="size-3.5 text-indigo-600 dark:text-indigo-400" />,
        title: "Anggota Ditambahkan",
        description: `${actor} menambahkan ${name || "anggota tim"} ke dalam roster tim project.`,
      };
    }

    case "MEMBER_REMOVED": {
      const name = (meta.full_name || meta.user_name) as string | undefined;
      return {
        icon: <UserMinus className="size-3.5 text-amber-600 dark:text-amber-400" />,
        title: "Anggota Dikeluarkan",
        description: `${actor} menghapus ${name || "anggota tim"} dari daftar penugasan project.`,
      };
    }

    case "PROJECT_ARCHIVED": {
      return {
        icon: <Archive className="size-3.5 text-destructive" />,
        title: "Project Diarsipkan",
        description: `${actor} menonaktifkan dan memindahkan project ini ke dalam arsip.`,
      };
    }

    default: {
      const titleFallback = log.event_type
        .toLowerCase()
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      const notes = meta.notes ? `Catatan: "${meta.notes}". ` : "";
      const description = notes
        ? notes.trim()
        : `${actor} melakukan pembaruan alur operasional pada project.`;
      return {
        icon: <Activity className="size-3.5 text-muted-foreground" />,
        title: titleFallback,
        description,
      };
    }
  }
}

export function ProjectActivityFeed({ logs }: ProjectActivityFeedProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-2xs">
      <div className="flex items-center gap-2">
        <Activity className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">
          Log Aktivitas & Audit ({logs.length})
        </h2>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
          Belum ada catatan aktivitas untuk project ini.
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border/80">
          {logs.map((log) => {
            const meta = getEventMeta(log);
            const userName = log.user ? log.user.full_name : "Sistem";
            const userRole = log.user ? (ROLE_LABELS[log.user.role] || log.user.role) : "";

            return (
              <div key={log.id} className="relative text-xs">
                {/* Node marker */}
                <div className="absolute -left-6 top-0.5 flex size-4 items-center justify-center rounded-full bg-card border border-border">
                  {meta.icon}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
                    <span>{meta.title}</span>
                    <span className="text-muted-foreground font-normal">•</span>
                    <span className="text-muted-foreground text-[11px] font-normal">
                      oleh {userName} {userRole ? `(${userRole})` : ""}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    {meta.description}
                  </p>
                  <span className="text-[10px] text-muted-foreground/70 block mt-1">
                    {new Date(log.created_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
