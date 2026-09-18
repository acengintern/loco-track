import type { NotificationCategoryKey } from "./types";

export interface CategoryDisplayInfo {
  key: NotificationCategoryKey;
  label: string;
  badgeClass: string;
}

export const NOTIFICATION_CATEGORIES: Array<{
  value: NotificationCategoryKey;
  label: string;
}> = [
  { value: "ALL", label: "Semua Kategori" },
  { value: "TASK_ASSIGNMENT", label: "Penugasan" },
  { value: "REVISION_INTERNAL", label: "Revisi Internal" },
  { value: "REVISION_CLIENT", label: "Revisi dari Client" },
  { value: "QC", label: "Quality Control" },
  { value: "PROJECT", label: "Project" },
];

export function getNotificationCategory(item: {
  sourceEventType?: string | null;
  title: string;
}): CategoryDisplayInfo {
  const type = item.sourceEventType || "";
  const title = (item.title || "").toLowerCase();

  if (
    type === "TASK_ASSIGNMENT" ||
    title.includes("tugas baru") ||
    title.includes("penugasan")
  ) {
    return {
      key: "TASK_ASSIGNMENT",
      label: "Penugasan",
      badgeClass:
        "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20",
    };
  }

  if (type === "REVISION_REQUEST" || title.includes("revisi")) {
    if (title.includes("client") || title.includes("klien")) {
      return {
        key: "REVISION_CLIENT",
        label: "Revisi dari Client",
        badgeClass:
          "bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20",
      };
    }
    return {
      key: "REVISION_INTERNAL",
      label: "Revisi Internal",
      badgeClass:
        "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
    };
  }

  if (
    type === "QC_REVIEW" ||
    type === "TASK_IN_REVIEW" ||
    title.includes("qc") ||
    title.includes("review qc")
  ) {
    return {
      key: "QC",
      label: "Quality Control",
      badgeClass:
        "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20",
    };
  }

  if (type === "PROJECT_STATUS_CHANGE" || title.includes("project")) {
    return {
      key: "PROJECT",
      label: "Project",
      badgeClass:
        "bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border border-zinc-500/20",
    };
  }

  return {
    key: "OTHER",
    label: "Informasi",
    badgeClass: "bg-muted text-muted-foreground border border-border",
  };
}

export function formatNotificationTimestamp(dateStr: string): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "-";

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const timeStr = date
    .toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(".", ":");

  if (isToday) {
    return `Hari ini, ${timeStr}`;
  }
  if (isYesterday) {
    return `Kemarin, ${timeStr}`;
  }

  const dateFormatted = date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return `${dateFormatted}, ${timeStr}`;
}
