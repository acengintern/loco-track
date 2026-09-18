import * as React from "react";
import type { ProjectPhase, PriorityLevel } from "@/types/database";

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

export const PROJECT_PRIORITY_LABELS: Record<PriorityLevel, string> = {
  LOW: "Rendah",
  MEDIUM: "Sedang",
  HIGH: "Tinggi",
  URGENT: "Mendesak",
};

export function ProjectStatusBadge({ status }: { status: ProjectPhase }) {
  const label = PROJECT_STATUS_LABELS[status] || status;

  let colorClasses = "bg-muted text-muted-foreground border-border";

  switch (status) {
    case "BRIEF_RECEIVED":
    case "CONTENT_PLANNING":
    case "SCRIPT_READY":
      colorClasses = "bg-muted text-foreground border-border";
      break;
    case "PRODUCTION":
    case "CLIENT_REVIEW":
      colorClasses =
        "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
      break;
    case "INTERNAL_QC":
      colorClasses =
        "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
      break;
    case "APPROVED":
    case "PUBLISHED":
    case "DONE":
      colorClasses =
        "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
      break;
    case "CANCELLED":
      colorClasses =
        "bg-destructive/10 text-destructive border-destructive/20";
      break;
  }

  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold border ${colorClasses}`}
    >
      {label}
    </span>
  );
}

export function ProjectPriorityBadge({ priority }: { priority: PriorityLevel }) {
  const label = PROJECT_PRIORITY_LABELS[priority] || priority;

  let colorClasses = "bg-muted text-muted-foreground border-border";

  switch (priority) {
    case "URGENT":
      colorClasses =
        "bg-destructive/10 text-destructive border-destructive/20 font-semibold";
      break;
    case "HIGH":
      colorClasses =
        "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
      break;
    case "MEDIUM":
      colorClasses = "bg-muted text-foreground border-border";
      break;
    case "LOW":
      colorClasses = "bg-muted/60 text-muted-foreground border-border/60";
      break;
  }

  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium border ${colorClasses}`}
    >
      {label}
    </span>
  );
}
