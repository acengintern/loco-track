"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckSquare,
  AlertCircle,
  Clock,
  ArrowRight,
  RotateCcw,
  ExternalLink,
  Eye,
  FolderKanban,
  CheckCircle2,
  MessageSquareQuote,
  Sparkles,
} from "lucide-react";
import { MetricCard } from "./metric-card";
import type { CreativeDashboardData } from "../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CreativeDashboardProps {
  data: CreativeDashboardData;
}

function formatHumanDeadline(deadlineStr: string | null) {
  if (!deadlineStr) {
    return {
      text: "Tidak ada tenggat",
      isOverdue: false,
      isUrgent: false,
      isToday: false,
      formattedDate: "-",
    };
  }

  const deadline = new Date(deadlineStr);
  const now = new Date();
  const dDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  const nDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((dDate.getTime() - nDate.getTime()) / (1000 * 60 * 60 * 24));

  const formattedDate = deadline.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (diffDays < 0) {
    return {
      text: `Terlambat ${Math.abs(diffDays)} hari`,
      isOverdue: true,
      isUrgent: true,
      isToday: false,
      formattedDate,
    };
  }
  if (diffDays === 0) {
    return {
      text: "Hari ini",
      isOverdue: false,
      isUrgent: true,
      isToday: true,
      formattedDate,
    };
  }
  if (diffDays === 1) {
    return {
      text: "Besok",
      isOverdue: false,
      isUrgent: true,
      isToday: false,
      formattedDate,
    };
  }
  if (diffDays <= 7) {
    return {
      text: `${diffDays} hari lagi`,
      isOverdue: false,
      isUrgent: false,
      isToday: false,
      formattedDate,
    };
  }

  return {
    text: formattedDate,
    isOverdue: false,
    isUrgent: false,
    isToday: false,
    formattedDate,
  };
}

function formatRelativeTimestamp(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMinutes = Math.round((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffMinutes < 1) return "Baru saja";
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} jam lalu`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return "Kemarin";
  if (diffDays <= 7) return `${diffDays} hari lalu`;

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function CreativeDashboard({ data }: CreativeDashboardProps) {
  const hasActiveTasks = data.myActiveTasksCount > 0;
  const hasNeverHadTasks = data.totalAssignedTasksCount === 0;

  return (
    <div className="space-y-8">
      {/* 1. REVISED 4 METRIC CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Card 1: Tugas Aktif Saya */}
        <MetricCard
          label="Tugas Aktif Saya"
          value={data.myActiveTasksCount}
          description="Tugas dalam alur produksi Anda"
          variant="default"
          icon={<CheckSquare className="size-4" />}
        />

        {/* Card 2: Perlu Revisi */}
        <MetricCard
          label="Perlu Revisi"
          value={data.revisionRequestedCount}
          description="Perbaikan yang perlu ditindaklanjuti"
          variant={data.revisionRequestedCount > 0 ? "warning" : "default"}
          icon={<RotateCcw className="size-4" />}
        />

        {/* Card 3: Deadline Dekat / Terlambat */}
        <MetricCard
          label="Deadline Dekat / Terlambat"
          value={data.urgentOrOverdueCount}
          description={
            data.overdueCount > 0
              ? `${data.overdueCount} tugas melewati tenggat`
              : "Tenggat dalam 7 hari ke depan"
          }
          variant={
            data.overdueCount > 0
              ? "destructive"
              : data.urgentOrOverdueCount > 0
                ? "warning"
                : "default"
          }
          icon={<Clock className="size-4" />}
        />

        {/* Card 4: Menunggu Review QC */}
        <MetricCard
          label="Menunggu Review QC"
          value={data.inReviewCount}
          description="Deliverable sedang direview QC"
          variant="default"
          icon={<Eye className="size-4" />}
        />
      </div>

      {/* 2. PRIORITAS SAYA HARI INI (Main Actionable Section) */}
      <section
        aria-labelledby="priority-tasks-heading"
        className="rounded-lg border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-4"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3.5">
          <div>
            <h2
              id="priority-tasks-heading"
              className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2"
            >
              <span>Prioritas Saya Hari Ini</span>
              {data.priorityTasks.length > 0 && (
                <Badge variant="secondary" className="font-mono text-xs">
                  {data.priorityTasks.length} antrean
                </Badge>
              )}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fokus pengerjaan dengan urgensi tertinggi berdasarkan instruksi revisi dan tenggat waktu
            </p>
          </div>

          <Link
            href="/tasks"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground shrink-0 transition-colors"
          >
            <span>Semua Tugas Saya</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {/* Priority Task List or Accurate Empty State */}
        {data.priorityTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4 rounded-md border border-dashed border-border/70 bg-muted/20">
            {hasNeverHadTasks ? (
              <>
                <Sparkles className="size-7 text-muted-foreground/60 mb-2" />
                <h3 className="text-sm font-semibold text-foreground">
                  Belum ada tugas yang ditugaskan.
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
                  Tugas produksi yang diberikan kepada Anda akan muncul di sini. Hubungi Social Media Specialist untuk penugasan project.
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 className="size-7 text-emerald-600 dark:text-emerald-400 mb-2" />
                <h3 className="text-sm font-semibold text-foreground">
                  Semua tugas Anda sudah selesai.
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
                  Tidak ada pekerjaan aktif yang perlu ditindaklanjuti saat ini. Anda dapat melihat riwayat tugas atau memeriksa project terkait di bawah.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {data.priorityTasks.map((task) => {
              const deadlineInfo = formatHumanDeadline(task.deadline);
              const isRevision = task.status === "REVISION_REQUESTED";

              return (
                <div
                  key={task.taskId}
                  className="py-3.5 first:pt-0 last:pb-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-accent/20 rounded-md sm:px-2 -mx-2"
                >
                  {/* Task & Project Context */}
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
                        {task.taskTitle}
                      </span>

                      {/* Revision Source Badge */}
                      {isRevision && task.revisionSourceLabel && (
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold shrink-0 ${
                            task.revisionSource === "CLIENT"
                              ? "bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                          }`}
                        >
                          <AlertCircle className="size-3" />
                          <span>{task.revisionSourceLabel}</span>
                        </span>
                      )}

                      {/* Status Badge */}
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/80 shrink-0">
                        {task.status === "TODO"
                          ? "Todo"
                          : task.status === "IN_PROGRESS"
                            ? "Sedang Dikerjakan"
                            : task.status === "REVISION_REQUESTED"
                              ? "Perlu Revisi"
                              : task.status === "IN_REVIEW"
                                ? "Review QC"
                                : task.status}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground truncate">
                      Project: <span className="text-foreground/80 font-medium">{task.projectName}</span>
                    </p>
                  </div>

                  {/* Deadline & Contextual CTA */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-border/40">
                    {/* Deadline Display */}
                    <div className="flex items-center gap-1.5 text-xs">
                      <Clock className="size-3.5 text-muted-foreground shrink-0" />
                      <span
                        className={
                          deadlineInfo.isOverdue
                            ? "font-semibold text-destructive"
                            : deadlineInfo.isUrgent
                              ? "font-semibold text-amber-600 dark:text-amber-400"
                              : "text-muted-foreground"
                        }
                      >
                        {deadlineInfo.text}
                      </span>
                    </div>

                    {/* Contextual CTA Button */}
                    {task.ctaText ? (
                      <Button
                        nativeButton={false}
                        size="sm"
                        className={`h-7 text-xs font-medium gap-1.5 ${
                          task.status === "REVISION_REQUESTED"
                            ? "bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500"
                            : ""
                        }`}
                        render={<Link href={task.ctaHref} />}
                      >
                        <span>{task.ctaText}</span>
                        <ArrowRight className="size-3" />
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic px-2">
                        Menunggu QC
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3 & 4. FEEDBACK TERBARU (Internal QC & Client Revisions) */}
      {data.recentFeedbacks.length > 0 && (
        <section
          aria-labelledby="recent-feedback-heading"
          className="rounded-lg border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-4"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3.5">
            <div>
              <h2
                id="recent-feedback-heading"
                className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2"
              >
                <MessageSquareQuote className="size-4 text-muted-foreground" />
                <span>Feedback Terbaru</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Catatan perbaikan resmi dari Creative Director dan Klien untuk tugas Anda
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.recentFeedbacks.map((fb) => (
              <div
                key={fb.id}
                className="flex flex-col justify-between rounded-md border border-border bg-background/60 p-4 text-xs space-y-3 shadow-2xs hover:border-border/80 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-foreground block truncate">
                        {fb.taskTitle}
                      </span>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {fb.projectName} {fb.version ? `(v${fb.version})` : ""}
                      </p>
                    </div>

                    {/* Differentiated Source Label */}
                    <span
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold shrink-0 ${
                        fb.source === "CLIENT"
                          ? "bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      <span>{fb.sourceLabel}</span>
                    </span>
                  </div>

                  {/* Feedback Preview notes (capped at 2 lines) */}
                  <p className="text-[11px] text-foreground/90 bg-muted/40 p-2.5 rounded border border-border/40 line-clamp-2 leading-relaxed">
                    &quot;{fb.notes}&quot;
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px]">
                  <span className="text-muted-foreground">
                    {formatRelativeTimestamp(fb.createdAt)}
                  </span>
                  <Link
                    href={`/projects/${fb.projectId}?tab=tasks`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <span>Buka Tugas</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. PROJECT SAYA (Compact Creative Project Cards) */}
      {data.myProjects.length > 0 && (
        <section
          aria-labelledby="my-projects-heading"
          className="rounded-lg border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-4"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3.5">
            <div>
              <h2
                id="my-projects-heading"
                className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2"
              >
                <FolderKanban className="size-4 text-muted-foreground" />
                <span>Project Saya</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Daftar project aktif yang menugaskan Anda dalam tim produksi
              </p>
            </div>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            >
              <span>Lihat Semua Project</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.myProjects.map((proj) => {
              const deadlineInfo = formatHumanDeadline(proj.myNearestDeadline);

              return (
                <div
                  key={proj.id}
                  className="rounded-md border border-border bg-background/50 p-3.5 space-y-2.5 flex flex-col justify-between shadow-2xs hover:bg-background transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.2 rounded border border-border">
                        {proj.projectCode}
                      </span>
                      {proj.hasActiveRevision && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                          <AlertCircle className="size-2.5" />
                          <span>Revisi</span>
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-xs text-foreground truncate">
                      {proj.name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {proj.clientName} • {proj.brandName}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-border/50 text-[11px]">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Tugas saya:</span>
                      <span className="font-medium text-foreground">
                        {proj.myActiveTasksCount} aktif
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Tenggat:</span>
                      <span
                        className={
                          deadlineInfo.isOverdue
                            ? "font-semibold text-destructive"
                            : deadlineInfo.isUrgent
                              ? "font-semibold text-amber-600 dark:text-amber-400"
                              : "font-medium text-foreground"
                        }
                      >
                        {deadlineInfo.text}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border flex items-center gap-1.5">
                    <Button
                      nativeButton={false}
                      size="sm"
                      className="w-full h-7 text-xs"
                      render={<Link href={`/projects/${proj.id}?tab=tasks`} />}
                    >
                      <span>Lihat Task</span>
                    </Button>
                    <Button
                      nativeButton={false}
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground px-2"
                      render={<Link href={`/projects/${proj.id}`} />}
                      aria-label={`Buka project ${proj.name}`}
                    >
                      <ExternalLink className="size-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 6. DAFTAR TUGAS AKTIF SAYA (Comprehensive Active Tasks Queue) */}
      {hasActiveTasks ? (
        <section
          aria-labelledby="active-tasks-heading"
          className="rounded-lg border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-4"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3.5">
            <div>
              <h2
                id="active-tasks-heading"
                className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2"
              >
                <CheckSquare className="size-4 text-muted-foreground" />
                <span>Daftar Tugas Aktif Saya</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Semua tugas produksi Anda yang sedang berjalan dalam alur kerja
              </p>
            </div>
            <Link
              href="/tasks"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground shrink-0 transition-colors"
            >
              <span>Kelola di Halaman Tugas</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full min-w-[620px] text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/80 text-muted-foreground">
                  <th className="py-2.5 pr-4 font-medium">Judul Tugas</th>
                  <th className="py-2.5 pr-4 font-medium">Project</th>
                  <th className="py-2.5 pr-4 font-medium">Status</th>
                  <th className="py-2.5 pr-4 font-medium">Tenggat</th>
                  <th className="py-2.5 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data.activeTasks.map((t) => {
                  const deadlineInfo = formatHumanDeadline(t.deadline);

                  return (
                    <tr key={t.taskId} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 pr-4 font-medium text-foreground">
                        {t.taskTitle}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {t.projectName}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/80">
                          {t.status === "TODO"
                            ? "Todo"
                            : t.status === "IN_PROGRESS"
                              ? "Sedang Dikerjakan"
                              : t.status === "REVISION_REQUESTED"
                                ? "Perlu Revisi"
                                : t.status === "IN_REVIEW"
                                  ? "Review QC"
                                  : t.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={
                            deadlineInfo.isOverdue
                              ? "font-semibold text-destructive"
                              : deadlineInfo.isUrgent
                                ? "font-semibold text-amber-600 dark:text-amber-400"
                                : "text-muted-foreground"
                          }
                        >
                          {deadlineInfo.text}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          href={`/projects/${t.projectId}?tab=tasks`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          <span>Buka</span>
                          <ExternalLink className="size-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        /* Useful Empty Dashboard Section when active tasks = 0 */
        data.recentCompletedTasks.length > 0 && (
          <section
            aria-labelledby="recent-completed-heading"
            className="rounded-lg border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-3"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2
                  id="recent-completed-heading"
                  className="text-sm font-semibold text-foreground flex items-center gap-2"
                >
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Tugas yang Baru Selesai</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Riwayat pengerjaan terakhir yang telah Anda selesaikan
                </p>
              </div>
            </div>

            <div className="divide-y divide-border/50">
              {data.recentCompletedTasks.map((t) => (
                <div
                  key={t.taskId}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-medium text-foreground">{t.taskTitle}</span>
                    <span className="text-muted-foreground ml-2">({t.projectName})</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Selesai {formatRelativeTimestamp(t.completedAt)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )
      )}
    </div>
  );
}
