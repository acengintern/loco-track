"use client";

import * as React from "react";
import type { QcReviewWithRelations, RevisionRequestWithRelations } from "../types";
import { CheckCircle2, AlertTriangle, Clock, User, FileText } from "lucide-react";

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (diffInSeconds < 60) return "baru saja";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} menit lalu`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} jam lalu`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays} hari lalu`;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

interface QcHistoryTimelineProps {
  reviews: QcReviewWithRelations[];
  revisions?: RevisionRequestWithRelations[];
  className?: string;
}

export function QcHistoryTimeline({ reviews, revisions = [], className = "" }: QcHistoryTimelineProps) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-md border border-border/60 bg-muted/20 p-4 text-center text-xs text-muted-foreground">
        Belum ada riwayat review QC untuk tugas ini.
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <h4 className="text-xs font-semibold text-foreground tracking-wide uppercase">
        Riwayat Review QC ({reviews.length} Ronde)
      </h4>

      <div className="relative pl-4 border-l border-border/70 space-y-4">
        {reviews.map((rev) => {
          const isApproved = rev.result === "APPROVED";
          const matchingRevision = revisions.find((r) => r.qc_review_id === rev.id || r.round_number === rev.round_number);

          return (
            <div key={rev.id} className="relative space-y-1.5 text-xs">
              {/* Dot indicator */}
              <div
                className={`absolute -left-[21px] top-0.5 size-3 rounded-full border-2 border-background ${
                  isApproved
                    ? "bg-emerald-600 dark:bg-emerald-500 ring-2 ring-emerald-500/20"
                    : "bg-amber-600 dark:bg-amber-500 ring-2 ring-amber-500/20"
                }`}
              />

              {/* Header row */}
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                      isApproved
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    {isApproved ? (
                      <CheckCircle2 className="size-3 shrink-0" />
                    ) : (
                      <AlertTriangle className="size-3 shrink-0" />
                    )}
                    <span>{isApproved ? "Disetujui" : "Perlu Revisi"}</span>
                  </span>

                  <span className="font-medium text-foreground">
                    Ronde {rev.round_number}
                  </span>

                  {rev.file && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-mono bg-muted/40 px-1.5 py-0.5 rounded">
                      <FileText className="size-3 text-muted-foreground" />
                      <span>v{rev.file.version}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="size-3" />
                  <time dateTime={rev.reviewed_at}>
                    {formatRelativeTime(rev.reviewed_at)}
                  </time>
                </div>
              </div>

              {/* Reviewer info */}
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <User className="size-3" />
                <span>Reviewer: </span>
                <span className="font-medium text-foreground">
                  {rev.reviewer?.full_name || "Creative Director"}
                </span>
              </div>

              {/* Review critique notes */}
              {rev.notes && (
                <div className="mt-1 rounded border border-border/50 bg-card p-2.5 text-[11px] leading-relaxed text-foreground whitespace-pre-wrap break-words">
                  {rev.notes}
                </div>
              )}

              {/* Revision request status tag if applicable */}
              {matchingRevision && (
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>Status Tiket Revisi:</span>
                  <span
                    className={`font-medium px-1 rounded ${
                      matchingRevision.status === "RESOLVED"
                        ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                        : matchingRevision.status === "IN_PROGRESS"
                        ? "text-sky-600 dark:text-sky-400 bg-sky-500/10"
                        : "text-amber-600 dark:text-amber-400 bg-amber-500/10"
                    }`}
                  >
                    {matchingRevision.status === "RESOLVED"
                      ? "Selesai Direvisi"
                      : matchingRevision.status === "IN_PROGRESS"
                      ? "Sedang Dikerjakan"
                      : "Menunggu Dikerjakan"}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
