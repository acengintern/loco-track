"use client";

import * as React from "react";
import { Users, BarChart3, Clock, CheckCircle2 } from "lucide-react";
import type { TeamWorkloadData, CreativeWorkloadMember } from "../types";
import { Badge } from "@/components/ui/badge";

interface TeamWorkloadSnapshotProps {
  data: TeamWorkloadData;
  onSelectMember: (member: CreativeWorkloadMember) => void;
}

export function TeamWorkloadSnapshot({ data, onSelectMember }: TeamWorkloadSnapshotProps) {
  const { totalActiveTasks, members, statusDistribution, deadlineRisk } = data;

  // 1. Empty State when there are zero active tasks
  if (totalActiveTasks === 0) {
    return (
      <section
        aria-labelledby="team-snapshot-heading"
        className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-8 text-center"
      >
        <div className="mx-auto flex max-w-md flex-col items-center justify-center space-y-2">
          <div className="flex size-10 items-center justify-center rounded-full bg-muted">
            <CheckCircle2 className="size-5 text-muted-foreground" />
          </div>
          <h3 id="team-snapshot-heading" className="text-sm font-semibold text-foreground">
            Belum ada tugas aktif untuk divisualisasikan.
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Distribusi beban kerja akan muncul setelah tugas produksi ditugaskan kepada tim kreatif.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="team-snapshot-heading" className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="team-snapshot-heading"
            className="text-base font-semibold text-foreground flex items-center gap-2"
          >
            <BarChart3 className="size-4 text-muted-foreground" />
            <span>Snapshot Beban Tim</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Visualisasi operasional beban per individu dan pemetaan risiko tenggat waktu tim produksi
          </p>
        </div>
      </div>

      {/* 2-Column Desktop Grid, 1-Column Stack on Tablet/Mobile */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ========================================================================= */}
        {/* VISUAL A: BEBAN PER PERSONEL (Left Column)                                */}
        {/* ========================================================================= */}
        <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-5 shadow-2xs space-y-4">
          <div className="space-y-1 border-b border-border/70 pb-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Users className="size-3.5 text-muted-foreground" />
                <span>Beban per Personel</span>
              </h3>
              <span className="text-[11px] text-muted-foreground">
                Klik kartu untuk melihat rincian
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Komposisi status tugas aktif yang sedang dikerjakan masing-masing personel
            </p>
          </div>

          <div className="space-y-3.5 flex-1">
            {members.map((member) => {
              const total = member.totalActiveTasks;
              const hasTasks = total > 0;

              const todoPct = hasTasks ? (member.todoCount / total) * 100 : 0;
              const progPct = hasTasks ? (member.inProgressCount / total) * 100 : 0;
              const revPct = hasTasks ? (member.revisionCount / total) * 100 : 0;
              const qcPct = hasTasks ? (member.inReviewCount / total) * 100 : 0;

              return (
                <div
                  key={member.id}
                  onClick={() => onSelectMember(member)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectMember(member);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${member.fullName}, ${
                    member.role === "GRAPHIC_DESIGNER" ? "Graphic Designer" : "Video Editor"
                  }: ${total} tugas aktif. Klik untuk rincian.`}
                  className="group rounded-md border border-transparent p-2 transition-colors hover:border-border hover:bg-muted/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {member.fullName}
                      </span>
                      <span className="text-[10px] text-muted-foreground border border-border/60 rounded px-1.5 py-0.2 shrink-0">
                        {member.role === "GRAPHIC_DESIGNER" ? "Designer" : "Editor"}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-medium text-foreground shrink-0">
                      {total} tugas
                    </span>
                  </div>

                  {/* Horizontal Segmented Bar (role="group", not role="progressbar") */}
                  <div
                    role="group"
                    aria-label={`Distribusi beban kerja ${member.fullName}`}
                    className="flex h-6 w-full overflow-hidden rounded bg-muted/60 text-[11px] font-mono font-semibold"
                  >
                    {!hasTasks ? (
                      <div className="flex h-full w-full items-center justify-center text-[11px] text-muted-foreground italic font-sans">
                        Tidak ada tugas aktif
                      </div>
                    ) : (
                      <>
                        {/* Belum Dikerjakan (TODO) */}
                        {member.todoCount > 0 && (
                          <div
                            style={{ width: `${todoPct}%` }}
                            title={`Belum Dikerjakan: ${member.todoCount} tugas`}
                            className="flex h-full items-center justify-center bg-slate-500/25 dark:bg-slate-500/35 text-slate-800 dark:text-slate-200 border-r border-background/60 transition-all hover:opacity-90"
                          >
                            {todoPct >= 12 && <span>{member.todoCount}</span>}
                          </div>
                        )}

                        {/* Proses (IN_PROGRESS) */}
                        {member.inProgressCount > 0 && (
                          <div
                            style={{ width: `${progPct}%` }}
                            title={`Proses: ${member.inProgressCount} tugas`}
                            className="flex h-full items-center justify-center bg-blue-500/30 dark:bg-blue-500/40 text-blue-900 dark:text-blue-100 border-r border-background/60 transition-all hover:opacity-90"
                          >
                            {progPct >= 12 && <span>{member.inProgressCount}</span>}
                          </div>
                        )}

                        {/* Revisi (REVISION_REQUESTED) */}
                        {member.revisionCount > 0 && (
                          <div
                            style={{ width: `${revPct}%` }}
                            title={`Revisi: ${member.revisionCount} tugas`}
                            className="flex h-full items-center justify-center bg-amber-500/35 dark:bg-amber-500/45 text-amber-950 dark:text-amber-100 border-r border-background/60 transition-all hover:opacity-90"
                          >
                            {revPct >= 12 && <span>{member.revisionCount}</span>}
                          </div>
                        )}

                        {/* QC (IN_REVIEW) */}
                        {member.inReviewCount > 0 && (
                          <div
                            style={{ width: `${qcPct}%` }}
                            title={`QC: ${member.inReviewCount} tugas`}
                            className="flex h-full items-center justify-center bg-purple-500/30 dark:bg-purple-500/40 text-purple-900 dark:text-purple-100 transition-all hover:opacity-90"
                          >
                            {qcPct >= 12 && <span>{member.inReviewCount}</span>}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Visual A Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-xs bg-slate-500/30 dark:bg-slate-500/40 border border-slate-500/50" />
              <span>Belum Dikerjakan</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-xs bg-blue-500/35 dark:bg-blue-500/45 border border-blue-500/50" />
              <span>Proses</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-xs bg-amber-500/40 dark:bg-amber-500/50 border border-amber-500/50" />
              <span>Revisi</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-xs bg-purple-500/35 dark:bg-purple-500/45 border border-purple-500/50" />
              <span>QC</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VISUAL B & C: DISTRIBUSI STATUS & RISIKO DEADLINE (Right Column)          */}
        {/* ========================================================================= */}
        <div className="flex flex-col justify-between space-y-6">
          {/* Visual B: Distribusi Status Tugas */}
          <div className="rounded-lg border border-border bg-card p-5 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Distribusi Status Tugas
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Agregasi tahapan produksi seluruh tim kreatif
                </p>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {statusDistribution.total} Total Tugas
              </Badge>
            </div>

            {/* Segmented Summary Bar */}
            <div
              role="group"
              aria-label="Distribusi status tugas kreatif keseluruhan"
              className="flex h-5 w-full overflow-hidden rounded bg-muted/60 text-[11px] font-mono font-semibold"
            >
              {statusDistribution.total > 0 ? (
                <>
                  {statusDistribution.todo > 0 && (
                    <div
                      style={{ width: `${(statusDistribution.todo / statusDistribution.total) * 100}%` }}
                      title={`Belum Dikerjakan: ${statusDistribution.todo} tugas`}
                      className="h-full bg-slate-500/25 dark:bg-slate-500/35 border-r border-background/60"
                    />
                  )}
                  {statusDistribution.inProgress > 0 && (
                    <div
                      style={{ width: `${(statusDistribution.inProgress / statusDistribution.total) * 100}%` }}
                      title={`Proses: ${statusDistribution.inProgress} tugas`}
                      className="h-full bg-blue-500/30 dark:bg-blue-500/40 border-r border-background/60"
                    />
                  )}
                  {statusDistribution.revision > 0 && (
                    <div
                      style={{ width: `${(statusDistribution.revision / statusDistribution.total) * 100}%` }}
                      title={`Revisi: ${statusDistribution.revision} tugas`}
                      className="h-full bg-amber-500/35 dark:bg-amber-500/45 border-r border-background/60"
                    />
                  )}
                  {statusDistribution.inReview > 0 && (
                    <div
                      style={{ width: `${(statusDistribution.inReview / statusDistribution.total) * 100}%` }}
                      title={`Menunggu QC: ${statusDistribution.inReview} tugas`}
                      className="h-full bg-purple-500/30 dark:bg-purple-500/40"
                    />
                  )}
                </>
              ) : null}
            </div>

            {/* Status Breakdown Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 pt-1">
              <div className="rounded border border-border/60 bg-muted/20 p-2 text-center">
                <span className="text-[11px] text-muted-foreground block">Belum Dikerjakan</span>
                <span className="text-sm font-bold font-mono text-foreground mt-0.5 block">
                  {statusDistribution.todo}
                </span>
              </div>
              <div className="rounded border border-blue-500/20 bg-blue-500/5 p-2 text-center">
                <span className="text-[11px] text-blue-700 dark:text-blue-300 block">Proses</span>
                <span className="text-sm font-bold font-mono text-blue-800 dark:text-blue-200 mt-0.5 block">
                  {statusDistribution.inProgress}
                </span>
              </div>
              <div className="rounded border border-amber-500/20 bg-amber-500/5 p-2 text-center">
                <span className="text-[11px] text-amber-700 dark:text-amber-300 block">Revisi</span>
                <span className="text-sm font-bold font-mono text-amber-800 dark:text-amber-200 mt-0.5 block">
                  {statusDistribution.revision}
                </span>
              </div>
              <div className="rounded border border-purple-500/20 bg-purple-500/5 p-2 text-center">
                <span className="text-[11px] text-purple-700 dark:text-purple-300 block">Menunggu QC</span>
                <span className="text-sm font-bold font-mono text-purple-800 dark:text-purple-200 mt-0.5 block">
                  {statusDistribution.inReview}
                </span>
              </div>
            </div>
          </div>

          {/* Visual C: Risiko Deadline */}
          <div className="rounded-lg border border-border bg-card p-5 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="size-3.5 text-muted-foreground" />
                  <span>Risiko Deadline</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Distribusi urgensi batas waktu penyelesaian tugas aktif
                </p>
              </div>
            </div>

            {/* Segmented Risk Bar */}
            <div
              role="group"
              aria-label="Distribusi risiko batas waktu tugas"
              className="flex h-5 w-full overflow-hidden rounded bg-muted/60 text-[11px] font-mono font-semibold"
            >
              {deadlineRisk.total > 0 ? (
                <>
                  {/* Terlambat */}
                  {deadlineRisk.overdue > 0 && (
                    <div
                      style={{ width: `${(deadlineRisk.overdue / deadlineRisk.total) * 100}%` }}
                      title={`Terlambat: ${deadlineRisk.overdue} tugas`}
                      className="h-full bg-destructive/70 text-destructive-foreground border-r border-background/60"
                    />
                  )}

                  {/* Mendekati Deadline (<= 7 hari) */}
                  {deadlineRisk.dueSoon > 0 && (
                    <div
                      style={{ width: `${(deadlineRisk.dueSoon / deadlineRisk.total) * 100}%` }}
                      title={`Mendekati Deadline: ${deadlineRisk.dueSoon} tugas`}
                      className="h-full bg-amber-500/50 text-amber-950 dark:text-amber-100 border-r border-background/60"
                    />
                  )}

                  {/* Aman (> 7 hari) */}
                  {deadlineRisk.safe > 0 && (
                    <div
                      style={{ width: `${(deadlineRisk.safe / deadlineRisk.total) * 100}%` }}
                      title={`Aman: ${deadlineRisk.safe} tugas`}
                      className="h-full bg-emerald-500/40 text-emerald-950 dark:text-emerald-100 border-r border-background/60"
                    />
                  )}

                  {/* Tanpa Deadline (eksplisit terpisah, bukan digabung ke Aman) */}
                  {deadlineRisk.noDeadline > 0 && (
                    <div
                      style={{ width: `${(deadlineRisk.noDeadline / deadlineRisk.total) * 100}%` }}
                      title={`Tanpa Deadline: ${deadlineRisk.noDeadline} tugas`}
                      className="h-full bg-muted-foreground/30 text-muted-foreground"
                    />
                  )}
                </>
              ) : null}
            </div>

            {/* Risk Breakdown Grid */}
            <div className={`grid gap-2 text-xs pt-1 ${deadlineRisk.noDeadline > 0 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
              <div className="rounded border border-destructive/20 bg-destructive/5 p-2 text-center">
                <span className="text-[11px] text-destructive block font-medium">Terlambat</span>
                <span className="text-sm font-bold font-mono text-destructive mt-0.5 block">
                  {deadlineRisk.overdue}
                </span>
              </div>
              <div className="rounded border border-amber-500/20 bg-amber-500/5 p-2 text-center">
                <span className="text-[11px] text-amber-700 dark:text-amber-300 block font-medium">Mendekati (&le; 7 hr)</span>
                <span className="text-sm font-bold font-mono text-amber-800 dark:text-amber-200 mt-0.5 block">
                  {deadlineRisk.dueSoon}
                </span>
              </div>
              <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-2 text-center">
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block font-medium">Aman (&gt; 7 hr)</span>
                <span className="text-sm font-bold font-mono text-emerald-800 dark:text-emerald-200 mt-0.5 block">
                  {deadlineRisk.safe}
                </span>
              </div>
              {deadlineRisk.noDeadline > 0 && (
                <div className="rounded border border-border/60 bg-muted/20 p-2 text-center">
                  <span className="text-[11px] text-muted-foreground block font-medium">Tanpa Tenggat</span>
                  <span className="text-sm font-bold font-mono text-muted-foreground mt-0.5 block">
                    {deadlineRisk.noDeadline}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
