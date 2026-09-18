import { ROLE_LABELS } from "./navigation";
import type { UserRole } from "@/lib/supabase/provisioning";
import type { ProjectPhase, PriorityLevel } from "@/types/database";
import type { TaskStatus, TaskType } from "@/features/tasks/types";

export { ROLE_LABELS };

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "Belum dikerjakan",
  IN_PROGRESS: "Sedang dikerjakan",
  IN_REVIEW: "Menunggu review",
  REVISION_REQUESTED: "Perlu revisi",
  APPROVED: "Disetujui",
  COMPLETED: "Selesai",
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  GRAPHIC_DESIGN: "Desain Grafis",
  VIDEO_EDITING: "Video Editing",
  CONTENT_PLAN: "Content Plan",
  SCRIPT: "Script",
  PUBLISHING: "Publishing",
  OTHER: "Lainnya",
};

export const PROJECT_STATUS_LABELS: Record<ProjectPhase, string> = {
  BRIEF_RECEIVED: "Brief Diterima",
  CONTENT_PLANNING: "Perencanaan Konten",
  SCRIPT_READY: "Naskah Siap",
  PRODUCTION: "Produksi",
  INTERNAL_QC: "QC Internal",
  CLIENT_REVIEW: "Review Klien",
  APPROVED: "Disetujui",
  PUBLISHED: "Terpublikasi",
  DONE: "Selesai",
  CANCELLED: "Dibatalkan",
};

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  LOW: "Rendah",
  MEDIUM: "Sedang",
  HIGH: "Tinggi",
  URGENT: "Mendesak",
};

export const CHANNEL_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  FACEBOOK: "Facebook",
  LINKEDIN: "LinkedIn",
  TWITTER: "X / Twitter",
  OTHER: "Lainnya",
};

export const SCRIPT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  READY: "Siap Produksi",
  APPROVED: "Disetujui",
};

export const ACTIVITY_CATEGORY_LABELS: Record<string, string> = {
  PROJECT: "Project",
  TASK: "Tugas",
  DELIVERABLE: "Deliverable",
  QC: "Quality Control",
  CLIENT_REVIEW: "Review Klien",
};

/**
 * Formats a content plan into a human-readable display string.
 * Example: "Carousel Edukasi Skincare · Instagram" or "Promo Launch · Instagram (18 Sep 2026)"
 */
export function formatContentPlanLabel(
  cp: {
    title?: string | null;
    channel?: string | null;
    planned_post_date?: string | null;
  } | null | undefined
): string {
  if (!cp) return "Belum Dipilih / Tidak Ditautkan";

  const title = cp.title?.trim() || "Rencana Konten Tanpa Judul";
  const channelLabel = cp.channel ? (CHANNEL_LABELS[cp.channel] || cp.channel) : "";

  let dateStr = "";
  if (cp.planned_post_date) {
    try {
      const d = new Date(cp.planned_post_date);
      if (!isNaN(d.getTime())) {
        dateStr = d.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }
    } catch {
      dateStr = "";
    }
  }

  if (channelLabel && dateStr) {
    return `${title} · ${channelLabel} (${dateStr})`;
  }
  if (channelLabel) {
    return `${title} · ${channelLabel}`;
  }
  if (dateStr) {
    return `${title} · ${dateStr}`;
  }
  return title;
}

/**
 * Formats a script into a human-readable display string.
 * Example: "Video Launch September · Siap Produksi"
 */
export function formatScriptLabel(
  sc: {
    title?: string | null;
    status?: string | null;
    hook?: string | null;
  } | null | undefined
): string {
  if (!sc) return "Belum Dipilih / Tidak Ditautkan";

  let mainTitle = sc.title?.trim();
  if (!mainTitle && sc.hook) {
    const cleanHook = sc.hook.trim().replace(/\s+/g, " ");
    mainTitle = cleanHook.length > 45 ? `${cleanHook.slice(0, 42)}...` : cleanHook;
  }
  if (!mainTitle) {
    mainTitle = "Naskah Tanpa Judul";
  }

  const statusLabel =
    sc.status === "READY"
      ? "Siap Produksi"
      : sc.status === "DRAFT"
      ? "Draft"
      : sc.status
      ? (SCRIPT_STATUS_LABELS[sc.status] || sc.status)
      : "";

  return statusLabel ? `${mainTitle} · ${statusLabel}` : mainTitle;
}

/**
 * Formats a user with their role label.
 * Example: "Diana Designer · Graphic Designer"
 */
export function formatUserWithRole(
  user: {
    full_name?: string | null;
    role?: string | null;
  } | null | undefined
): string {
  if (!user || !user.full_name) return "Belum Ditugaskan";

  const roleKey = user.role as UserRole;
  const roleLabel = roleKey && ROLE_LABELS[roleKey] ? ROLE_LABELS[roleKey] : (user.role || "");

  return roleLabel ? `${user.full_name} · ${roleLabel}` : user.full_name;
}

/**
 * Formats a brand option for select triggers and options.
 * Example: "Client Name · Brand Name (CODE)"
 */
export function formatBrandOptionLabel(brand: {
  name: string;
  code?: string | null;
  client_name?: string | null;
}): string {
  const parts: string[] = [];
  if (brand.client_name) {
    parts.push(brand.client_name);
  }
  const brandCode = brand.code ? ` (${brand.code})` : "";
  parts.push(`${brand.name}${brandCode}`);
  return parts.join(" · ");
}
