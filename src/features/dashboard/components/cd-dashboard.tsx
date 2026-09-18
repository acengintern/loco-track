import * as React from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  RotateCcw,
  Layers,
  Clock,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { MetricCard } from "./metric-card";
import type { CreativeDirectorDashboardData } from "../types";

interface CreativeDirectorDashboardProps {
  data: CreativeDirectorDashboardData;
}

export function CreativeDirectorDashboard({ data }: CreativeDirectorDashboardProps) {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Menunggu Review QC"
          value={data.tasksWaitingQcCount}
          description="Tugas selesai yang memerlukan persetujuan Creative Director"
          variant={data.tasksWaitingQcCount > 0 ? "warning" : "default"}
          icon={<ClipboardCheck className="size-5" />}
        />
        <MetricCard
          label="Tugas Dalam Revisi"
          value={data.tasksInRevisionCount}
          description="Tugas yang sedang dikerjakan ulang oleh tim kreatif"
          variant="default"
          icon={<RotateCcw className="size-5" />}
        />
        <MetricCard
          label="Project di QC Internal"
          value={data.projectsInQcCount}
          description="Project dalam fase quality control internal"
          variant="default"
          icon={<Layers className="size-5" />}
        />
        <MetricCard
          label="Deadline 7 Hari Mendatang"
          value={data.upcomingDeadlinesCount}
          description="Project aktif dengan tenggat waktu dalam pekan ini"
          variant={data.upcomingDeadlinesCount > 0 ? "warning" : "default"}
          icon={<Clock className="size-5" />}
        />
      </div>

      {/* QC Queue Section */}
      <section
        aria-labelledby="qc-queue-heading"
        className="rounded-lg border border-border bg-card p-6 sm:p-7 shadow-2xs"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4 sm:pb-5">
          <div>
            <h2
              id="qc-queue-heading"
              className="text-lg sm:text-[19px] font-semibold text-foreground"
            >
              Antrean Review Quality Control (QC)
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Deliverable yang siap ditinjau dan diverifikasi untuk approval internal
            </p>
          </div>
          <Link
            href="/approvals"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-2xs hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring shrink-0"
          >
            Buka Halaman Persetujuan <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="mt-5 overflow-x-auto">
          {data.qcQueue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ClipboardCheck className="size-10 text-muted-foreground/60 mb-2.5" />
              <p className="text-sm font-medium text-foreground">
                Tidak ada antrean QC yang menunggu.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Semua deliverable yang diserahkan telah selesai ditinjau.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/80 text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="pb-3.5 pr-4">Tugas</th>
                  <th className="pb-3.5 pr-4">Project</th>
                  <th className="pb-3.5 pr-4">Kreatif</th>
                  <th className="pb-3.5 pr-4">Versi</th>
                  <th className="pb-3.5 pr-4">Deadline</th>
                  <th className="pb-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data.qcQueue.map((item) => (
                  <tr key={item.taskId} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 pr-4 font-medium text-foreground">
                      {item.taskTitle}
                    </td>
                    <td className="py-3.5 pr-4 text-muted-foreground">
                      {item.projectName}
                    </td>
                    <td className="py-3.5 pr-4 text-foreground/90 font-medium">
                      {item.assigneeName}
                    </td>
                    <td className="py-3.5 pr-4">
                      <span className="inline-flex items-center rounded-md bg-muted px-2.5 py-0.5 text-xs font-mono font-medium">
                        v{item.version}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 text-sm tabular-nums text-muted-foreground">
                      {item.deadline}
                    </td>
                    <td className="py-3.5 text-right">
                      <Link
                        href="/approvals"
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Review <ExternalLink className="size-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Two Column: Revision Queue & Workload Summary */}
      <div className="grid grid-cols-1 gap-6 sm:gap-7 lg:grid-cols-12">
        {/* Revision Queue */}
        <section
          aria-labelledby="revision-queue-heading"
          className="rounded-lg border border-border bg-card p-6 sm:p-7 shadow-2xs lg:col-span-6"
        >
          <div className="flex items-center justify-between border-b border-border pb-4 sm:pb-5">
            <div>
              <h2
                id="revision-queue-heading"
                className="text-lg sm:text-[19px] font-semibold text-foreground"
              >
                Pantauan Revisi Aktif
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Tugas yang sedang dalam pengerjaan catatan perbaikan
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3.5">
            {data.revisionQueue.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Tidak ada tugas yang sedang dalam revisi aktif.
              </p>
            ) : (
              data.revisionQueue.map((item) => (
                <div
                  key={item.taskId}
                  className="rounded-md border border-border/60 bg-background/50 p-4 text-sm space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground truncate">
                      {item.taskTitle}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400 shrink-0">
                      Putaran {item.roundNumber}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <span>{item.projectName}</span>
                    <span>&bull;</span>
                    <span className="font-medium text-foreground/80">
                      {item.assigneeName}
                    </span>
                  </div>
                  <p className="text-muted-foreground/90 line-clamp-2 italic bg-muted/40 p-2.5 rounded text-xs sm:text-sm">
                    &quot;{item.notes}&quot;
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Creative Workload Summary */}
        <section
          aria-labelledby="workload-summary-heading"
          className="rounded-lg border border-border bg-card p-6 sm:p-7 shadow-2xs lg:col-span-6"
        >
          <div className="flex items-center justify-between border-b border-border pb-4 sm:pb-5">
            <div>
              <h2
                id="workload-summary-heading"
                className="text-lg sm:text-[19px] font-semibold text-foreground"
              >
                Beban Kerja Tim Kreatif
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Jumlah tugas aktif faktual per desainer dan editor
              </p>
            </div>
            <Link
              href="/team"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-sm shrink-0"
            >
              Matriks Lengkap <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="mt-5 divide-y divide-border/60">
            {data.creativeWorkloadSummary.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Tidak ada personel kreatif aktif yang terdaftar.
              </p>
            ) : (
              data.creativeWorkloadSummary.map((creative) => (
                <div
                  key={creative.creativeId}
                  className="flex items-center justify-between py-3.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {creative.creativeName}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {creative.role}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="block text-sm font-semibold tabular-nums text-foreground">
                        {creative.activeTasksCount} Tugas
                      </span>
                      {creative.inReviewCount > 0 && (
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                          {creative.inReviewCount} di QC
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
