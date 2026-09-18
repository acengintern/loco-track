"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FolderKanban,
  ExternalLink,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Kanban,
  CheckCircle2,
} from "lucide-react";
import type { PaginatedCreativeProjects, CreativeProjectItem } from "../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface CreativeProjectListProps {
  data: PaginatedCreativeProjects;
  hasFilters: boolean;
}

function formatDeadlineInfo(deadlineStr: string | null, isTaskDeadline: boolean) {
  if (!deadlineStr) {
    return {
      formattedDate: "Tidak ditentukan",
      badgeText: null,
      badgeVariant: "muted" as const,
      isTaskDeadline,
    };
  }

  const deadline = new Date(deadlineStr);
  const now = new Date();

  // Pure calendar day difference
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
      formattedDate,
      badgeText: `Terlambat ${Math.abs(diffDays)} hari`,
      badgeVariant: "destructive" as const,
      isTaskDeadline,
    };
  }
  if (diffDays === 0) {
    return {
      formattedDate,
      badgeText: "Hari ini",
      badgeVariant: "urgent" as const,
      isTaskDeadline,
    };
  }
  if (diffDays === 1) {
    return {
      formattedDate,
      badgeText: "Besok",
      badgeVariant: "warning" as const,
      isTaskDeadline,
    };
  }
  if (diffDays <= 3) {
    return {
      formattedDate,
      badgeText: `${diffDays} hari lagi`,
      badgeVariant: "warning" as const,
      isTaskDeadline,
    };
  }

  return {
    formattedDate,
    badgeText: `${diffDays} hari lagi`,
    badgeVariant: "normal" as const,
    isTaskDeadline,
  };
}

function CreativeDeadlineCell({
  deadline,
  isTaskDeadline,
}: {
  deadline: string | null;
  isTaskDeadline: boolean;
}) {
  const info = formatDeadlineInfo(deadline, isTaskDeadline);

  if (!deadline) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5">
        <Calendar className="size-3 text-muted-foreground shrink-0" />
        <span className="text-xs text-foreground font-medium">{info.formattedDate}</span>
      </div>
      <div className="flex items-center gap-1">
        {info.badgeVariant === "destructive" && (
          <span className="inline-flex items-center text-[10px] font-semibold text-destructive bg-destructive/10 border border-destructive/20 px-1.5 py-0.2 rounded">
            {info.badgeText}
          </span>
        )}
        {info.badgeVariant === "urgent" && (
          <span className="inline-flex items-center text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded">
            {info.badgeText}
          </span>
        )}
        {info.badgeVariant === "warning" && (
          <span className="inline-flex items-center text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded">
            {info.badgeText}
          </span>
        )}
        {info.badgeVariant === "normal" && (
          <span className="inline-flex items-center text-[10px] text-muted-foreground">
            {info.badgeText}
          </span>
        )}
        {!isTaskDeadline && (
          <span className="text-[10px] text-muted-foreground/80">(Project)</span>
        )}
      </div>
    </div>
  );
}

function TaskStatusSummaryBadges({ project }: { project: CreativeProjectItem }) {
  const { statusSummary, myTasksCount } = project;

  if (myTasksCount === 0) {
    return <span className="text-xs text-muted-foreground italic">Menunggu penugasan</span>;
  }

  const items: Array<{
    label: string;
    count: number;
    colorClass: string;
    dotClass: string;
  }> = [];

  if (statusSummary.todo > 0) {
    items.push({
      label: "Todo",
      count: statusSummary.todo,
      colorClass: "text-muted-foreground",
      dotClass: "bg-muted-foreground/60",
    });
  }
  if (statusSummary.in_progress > 0) {
    items.push({
      label: "Proses",
      count: statusSummary.in_progress,
      colorClass: "text-blue-600 dark:text-blue-400 font-medium",
      dotClass: "bg-blue-500",
    });
  }
  if (statusSummary.in_review > 0) {
    items.push({
      label: "Review",
      count: statusSummary.in_review,
      colorClass: "text-purple-600 dark:text-purple-400 font-medium",
      dotClass: "bg-purple-500",
    });
  }
  if (statusSummary.approved > 0) {
    items.push({
      label: "Disetujui",
      count: statusSummary.approved,
      colorClass: "text-emerald-600 dark:text-emerald-400 font-medium",
      dotClass: "bg-emerald-500",
    });
  }
  if (statusSummary.completed > 0) {
    items.push({
      label: "Selesai",
      count: statusSummary.completed,
      colorClass: "text-zinc-500 dark:text-zinc-400",
      dotClass: "bg-zinc-400",
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {items.map((item) => (
        <span
          key={item.label}
          className={`inline-flex items-center gap-1 text-[11px] ${item.colorClass}`}
        >
          <span className={`size-1.5 rounded-full ${item.dotClass}`} />
          <span>
            {item.count} {item.label}
          </span>
        </span>
      ))}
    </div>
  );
}

export function CreativeProjectList({
  data,
  hasFilters,
}: CreativeProjectListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const goToPage = (pageNumber: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(pageNumber));
    router.push(`/projects?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      {/* Empty State */}
      {data.projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 p-12 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground mb-3">
            <FolderKanban className="size-5" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            {hasFilters ? "Project tidak ditemukan" : "Belum ada penugasan project"}
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
            {hasFilters
              ? "Tidak ada project yang sesuai dengan filter pencarian yang diterapkan."
              : "Daftar project operasional yang menugaskan Anda akan muncul di sini. Hubungi Social Media Specialist atau Creative Director untuk penugasan."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-hidden rounded-lg border border-border bg-card shadow-2xs">
            <div className="overflow-x-auto w-full no-scrollbar">
              <table className="w-full text-left text-xs border-collapse min-w-[960px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                    <th className="py-2.5 px-4 font-medium w-[280px]">Project & Klien</th>
                    <th className="py-2.5 px-4 font-medium text-center w-[130px] whitespace-nowrap">
                      Tugas Saya
                    </th>
                    <th className="py-2.5 px-4 font-medium w-[240px]">Status Pengerjaan</th>
                    <th className="py-2.5 px-4 font-medium text-center w-[130px] whitespace-nowrap">
                      Revisi
                    </th>
                    <th className="py-2.5 px-4 font-medium w-[170px] whitespace-nowrap">
                      Deadline Terdekat
                    </th>
                    <th className="py-2.5 px-4 font-medium text-right w-[150px] whitespace-nowrap">
                      Aksi Cepat
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {data.projects.map((project) => {
                    const hasRevision = project.hasActiveRevision;
                    const isTaskDeadline = Boolean(project.myNearestDeadline);
                    const effectiveDeadline = project.myNearestDeadline || project.deadline;

                    return (
                      <tr
                        key={project.id}
                        className="hover:bg-accent/30 transition-colors"
                      >
                        {/* Project & Client */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/80">
                              {project.project_code}
                            </span>
                          </div>
                          <div className="font-semibold text-foreground mt-1">
                            <Link
                              href={`/projects/${project.id}?tab=tasks`}
                              className="hover:underline flex items-center gap-1.5"
                            >
                              <span className="truncate">{project.name}</span>
                            </Link>
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                            <span>{project.brand.client.name}</span>
                            <span className="mx-1">•</span>
                            <span className="font-medium text-foreground/80">
                              {project.brand.name}
                            </span>
                          </div>
                        </td>

                        {/* My Active Tasks Count */}
                        <td className="py-3 px-4 text-center">
                          {project.myTasksCount === 0 ? (
                            <span className="text-xs text-muted-foreground">0 tugas</span>
                          ) : project.myActiveTasksCount > 0 ? (
                            <div className="inline-flex flex-col items-center">
                              <Badge
                                variant="secondary"
                                className="font-mono text-xs font-semibold px-2 py-0.5"
                              >
                                {project.myActiveTasksCount} aktif
                              </Badge>
                              {project.myTasksCount > project.myActiveTasksCount && (
                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                  dari {project.myTasksCount} total
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              <CheckCircle2 className="size-3" />
                              <span>Selesai ({project.myTasksCount})</span>
                            </span>
                          )}
                        </td>

                        {/* Task Status Summary */}
                        <td className="py-3 px-4">
                          <TaskStatusSummaryBadges project={project} />
                        </td>

                        {/* Active Revision Indicator */}
                        <td className="py-3 px-4 text-center">
                          {hasRevision ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 whitespace-nowrap">
                              <AlertCircle className="size-3 shrink-0" />
                              <span>{project.statusSummary.revision_requested} Perlu Revisi</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Aman</span>
                          )}
                        </td>

                        {/* Nearest Deadline */}
                        <td className="py-3 px-4">
                          <CreativeDeadlineCell
                            deadline={effectiveDeadline}
                            isTaskDeadline={isTaskDeadline}
                          />
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              nativeButton={false}
                              size="sm"
                              className="h-7 text-xs gap-1.5"
                              render={<Link href={`/projects/${project.id}?tab=tasks`} />}
                            >
                              <Kanban className="size-3" />
                              <span>Lihat Tugas</span>
                            </Button>
                            <Button
                              nativeButton={false}
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                              render={<Link href={`/projects/${project.id}`} />}
                              aria-label={`Buka brief ${project.name}`}
                            >
                              <ExternalLink className="size-3" />
                              <span>Brief</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Reflow Stack (<768px) */}
          <div className="space-y-3 md:hidden">
            {data.projects.map((project) => {
              const hasRevision = project.hasActiveRevision;
              const isTaskDeadline = Boolean(project.myNearestDeadline);
              const effectiveDeadline = project.myNearestDeadline || project.deadline;

              return (
                <div
                  key={project.id}
                  className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/80">
                        {project.project_code}
                      </span>
                      <h4 className="font-semibold text-sm text-foreground mt-1 leading-snug">
                        <Link
                          href={`/projects/${project.id}?tab=tasks`}
                          className="hover:underline"
                        >
                          {project.name}
                        </Link>
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span>{project.brand.client.name}</span>
                        <span className="mx-1">•</span>
                        <span className="font-medium text-foreground/80">
                          {project.brand.name}
                        </span>
                      </p>
                    </div>

                    {hasRevision && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                        <AlertCircle className="size-3 shrink-0" />
                        <span>Revisi</span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50 text-xs">
                    <div>
                      <span className="text-[11px] text-muted-foreground block mb-1">
                        Tugas Saya:
                      </span>
                      {project.myTasksCount === 0 ? (
                        <span className="text-muted-foreground text-xs">Belum ada tugas</span>
                      ) : project.myActiveTasksCount > 0 ? (
                        <span className="font-mono font-medium text-foreground text-xs">
                          {project.myActiveTasksCount} aktif ({project.myTasksCount} total)
                        </span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium text-xs">
                          Semua selesai ({project.myTasksCount})
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[11px] text-muted-foreground block mb-1">
                        Deadline:
                      </span>
                      <CreativeDeadlineCell
                        deadline={effectiveDeadline}
                        isTaskDeadline={isTaskDeadline}
                      />
                    </div>
                  </div>

                  {project.myTasksCount > 0 && (
                    <div className="pt-2 border-t border-border/50">
                      <span className="text-[11px] text-muted-foreground block mb-1">
                        Status Pengerjaan:
                      </span>
                      <TaskStatusSummaryBadges project={project} />
                    </div>
                  )}

                  <div className="pt-2 border-t border-border flex items-center gap-2">
                    <Button
                      nativeButton={false}
                      size="sm"
                      className="w-full text-xs gap-1.5"
                      render={<Link href={`/projects/${project.id}?tab=tasks`} />}
                    >
                      <Kanban className="size-3.5" />
                      <span>Lihat Tugas</span>
                    </Button>
                    <Button
                      nativeButton={false}
                      variant="outline"
                      size="sm"
                      className="w-full text-xs gap-1.5"
                      render={<Link href={`/projects/${project.id}`} />}
                    >
                      <ExternalLink className="size-3.5" />
                      <span>Buka Proyek</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {data.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <p className="text-xs text-muted-foreground">
                Menampilkan halaman {data.currentPage} dari {data.totalPages} ({data.totalCount} total project)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(data.currentPage - 1)}
                  disabled={data.currentPage <= 1}
                  className="gap-1 text-xs h-8"
                >
                  <ChevronLeft className="size-3.5" />
                  <span>Sebelumnya</span>
                </Button>
                <div className="text-xs font-medium px-2">
                  {data.currentPage} / {data.totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(data.currentPage + 1)}
                  disabled={data.currentPage >= data.totalPages}
                  className="gap-1 text-xs h-8"
                >
                  <span>Berikutnya</span>
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
