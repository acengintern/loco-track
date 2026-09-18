"use client";

import * as React from "react";
import Link from "next/link";
import { Clock, ArrowRight, User } from "lucide-react";
import type { UrgentTaskItem } from "../types";
import { Badge } from "@/components/ui/badge";

interface TeamDeadlineStripProps {
  tasks: UrgentTaskItem[];
}

export function TeamDeadlineStrip({ tasks }: TeamDeadlineStripProps) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="urgent-deadlines-heading"
      className="rounded-lg border border-border bg-card p-5 shadow-2xs space-y-3.5"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-3">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-amber-600 dark:text-amber-400" />
          <h3 id="urgent-deadlines-heading" className="text-sm font-semibold text-foreground">
            Deadline Terdekat
          </h3>
          <Badge variant="secondary" className="font-mono text-xs">
            {tasks.length} tugas mendesak
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Antrean tugas produksi dengan batas waktu paling dekat yang membutuhkan atensi pengawasan
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex flex-col justify-between rounded-md border border-border/80 bg-background/70 p-3.5 text-xs space-y-3 transition-colors hover:border-border"
          >
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-foreground line-clamp-1">
                  {task.title}
                </span>

                {/* Urgency Badge */}
                <span
                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold shrink-0 border ${
                    task.isOverdue
                      ? "bg-destructive/10 text-destructive border-destructive/20"
                      : task.isDueToday || task.isDueTomorrow
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                        : "bg-muted text-muted-foreground border-border/60"
                  }`}
                >
                  {task.urgencyLabel}
                </span>
              </div>

              <p className="text-xs text-muted-foreground truncate">
                Project: <span className="text-foreground/80 font-medium">{task.projectName}</span>
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-border/50 pt-2 text-[11px]">
              <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                <User className="size-3 shrink-0" />
                <span className="truncate text-foreground font-medium">{task.assigneeName}</span>
                <span className="text-[10px] text-muted-foreground">
                  ({task.assigneeRole === "GRAPHIC_DESIGNER" ? "Designer" : "Editor"})
                </span>
              </div>

              <Link
                href={`/projects/${task.projectId}?tab=tasks`}
                className="inline-flex items-center gap-1 text-primary hover:underline shrink-0 font-medium ml-2"
              >
                <span>Lihat</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
