import * as React from "react";
import {
  type TaskStatus,
  type TaskType,
  type PriorityLevel,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
  PRIORITY_LABELS,
} from "../types";
import { Clock } from "lucide-react";

interface TaskStatusBadgeProps {
  status: TaskStatus;
}

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const label = TASK_STATUS_LABELS[status] || status;

  const colorStyles: Record<TaskStatus, string> = {
    TODO: "border-border bg-muted/50 text-muted-foreground",
    IN_PROGRESS: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    IN_REVIEW: "border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    REVISION_REQUESTED: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    APPROVED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    COMPLETED: "border-teal-500/30 bg-teal-500/10 text-teal-600 dark:text-teal-400",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold border ${
        colorStyles[status] || "border-border bg-muted text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}

interface TaskTypeBadgeProps {
  taskType: TaskType;
}

export function TaskTypeBadge({ taskType }: TaskTypeBadgeProps) {
  const label = TASK_TYPE_LABELS[taskType] || taskType;

  const colorStyles: Record<TaskType, string> = {
    GRAPHIC_DESIGN: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    VIDEO_EDITING: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
    CONTENT_PLAN: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    SCRIPT: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    PUBLISHING: "border-teal-500/30 bg-teal-500/10 text-teal-600 dark:text-teal-400",
    OTHER: "border-border bg-muted/40 text-muted-foreground",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${
        colorStyles[taskType] || "border-border bg-muted text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}

interface TaskPriorityBadgeProps {
  priority: PriorityLevel;
}

export function TaskPriorityBadge({ priority }: TaskPriorityBadgeProps) {
  const label = PRIORITY_LABELS[priority] || priority;

  const colorStyles: Record<PriorityLevel, string> = {
    LOW: "text-muted-foreground/80 bg-muted/30 border-border/50",
    MEDIUM: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20",
    HIGH: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
    URGENT: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20 font-semibold",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs border ${
        colorStyles[priority] || "text-muted-foreground border-border"
      }`}
    >
      {label}
    </span>
  );
}

interface DeadlineBadgeProps {
  deadline: string;
}

export function DeadlineBadge({ deadline }: DeadlineBadgeProps) {
  const deadlineDate = new Date(deadline);
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const formattedDate = deadlineDate.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });

  if (diffDays < 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
        <Clock className="size-3.5" />
        <span>Terlambat {Math.abs(diffDays)} hari ({formattedDate})</span>
      </span>
    );
  }

  if (diffDays === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
        <Clock className="size-3.5" />
        <span>Batas waktu hari ini</span>
      </span>
    );
  }

  if (diffDays <= 2) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
        <Clock className="size-3.5" />
        <span>{diffDays} hari lagi ({formattedDate})</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Clock className="size-3.5" />
      <span>{diffDays} hari lagi ({formattedDate})</span>
    </span>
  );
}
