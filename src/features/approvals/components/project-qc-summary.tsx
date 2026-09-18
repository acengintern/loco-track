"use client";

import * as React from "react";
import Link from "next/link";
import type { ProjectQcCompleteness } from "../types";
import { CheckCircle2, Clock, AlertTriangle, ShieldCheck, ArrowRight } from "lucide-react";

interface ProjectQcSummaryProps {
  summary: ProjectQcCompleteness;
  className?: string;
}

export function ProjectQcSummary({ summary, className = "" }: ProjectQcSummaryProps) {
  if (summary.totalQcTasks === 0) {
    return null;
  }

  const remaining = summary.totalQcTasks - summary.approvedTasks;

  return (
    <div
      className={`rounded-lg border p-3.5 text-xs ${
        summary.isComplete
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
          : summary.revisionTasks > 0
          ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
          : "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300"
      } ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 font-medium">
            {summary.isComplete ? (
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : summary.revisionTasks > 0 ? (
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : (
              <Clock className="size-4 text-sky-600 dark:text-sky-400 shrink-0" />
            )}
            <span>{summary.statusText}</span>
          </div>
          {!summary.isComplete && remaining > 0 && (
            <p className="text-[11px] opacity-80 pl-6">
              {remaining} tugas lagi harus diselesaikan & lolos QC agar tombol pengajuan ke klien aktif di tab &quot;Review & Publikasi&quot;.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <span className="opacity-90">
            {summary.approvedTasks} disetujui / {summary.totalQcTasks} total
          </span>

          {summary.isComplete && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 font-semibold rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                <ShieldCheck className="size-3" />
                <span>QC Lengkap</span>
              </span>
              <Link
                href="?tab=client-review"
                className="inline-flex items-center gap-1 font-semibold rounded bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-xs transition-colors shadow-2xs"
              >
                <span>Lanjut ke Review Klien</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
