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
    <div className="space-y-8">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Menunggu Review QC"
          value={data.tasksWaitingQcCount}
          description="Tugas selesai yang memerlukan persetujuan Creative Director"
          variant={data.tasksWaitingQcCount > 0 ? "warning" : "default"}
          icon={<ClipboardCheck className="size-4" />}
        />
        <MetricCard
          label="Tugas Dalam Revisi"
          value={data.tasksInRevisionCount}
          description="Tugas yang sedang dikerjakan ulang oleh tim kreatif"
          variant="default"
          icon={<RotateCcw className="size-4" />}
        />
        <MetricCard
          label="Project di QC Internal"
          value={data.projectsInQcCount}
          description="Project dalam fase quality control internal"
          variant="default"
          icon={<Layers className="size-4" />}
        />
        <MetricCard
          label="Deadline 7 Hari Mendatang"
          value={data.upcomingDeadlinesCount}
          description="Project aktif dengan tenggat waktu dalam pekan ini"
          variant={data.upcomingDeadlinesCount > 0 ? "warning" : "default"}
          icon={<Clock className="size-4" />}
        />
      </div>

      {/* QC Queue Section */}
      <section
        aria-labelledby="qc-queue-heading"
        className="rounded-lg border border-border bg-card p-6 shadow-2xs"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
          <div>
            <h2
              id="qc-queue-heading"
              className="text-base font-semibold text-foreground"
            >
              Antrean Review Quality Control (QC)
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Deliverable yang siap ditinjau dan diverifikasi untuk approval internal
            </p>
          </div>
          <Link
            href="/approvals"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-2xs hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            Buka Halaman Persetujuan <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <div className="mt-4 overflow-x-auto">
          {data.qcQueue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ClipboardCheck className="size-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium text-foreground">
                Tidak ada antrean QC yang menunggu.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Semua deliverable yang diserahkan telah selesai ditinjau.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/80 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="pb-3 pr-4">Tugas</th>
                  <th className="pb-3 pr-4">Project</th>
                  <th className="pb-3 pr-4">Kreatif</th>
                  <th className="pb-3 pr-4">Versi</th>
                  <th className="pb-3 pr-4">Deadline</th>
                  <th className="pb-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data.qcQueue.map((item) => (
                  <tr key={item.taskId} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 pr-4 font-medium text-foreground">
                      {item.taskTitle}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {item.projectName}
                    </td>
                    <td className="py-3 pr-4 text-foreground/90">
                      {item.assigneeName}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-mono font-medium">
                        v{item.version}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-xs tabular-nums text-muted-foreground">
                      {item.deadline}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href="/approvals"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Review <ExternalLink className="size-3" />
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Revision Queue */}
        <section
          aria-labelledby="revision-queue-heading"
          className="rounded-lg border border-border bg-card p-6 shadow-2xs lg:col-span-6"
        >
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h2
                id="revision-queue-heading"
                className="text-base font-semibold text-foreground"
              >
                Pantauan Revisi Aktif
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tugas yang sedang dalam pengerjaan catatan perbaikan
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {data.revisionQueue.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Tidak ada tugas yang sedang dalam revisi aktif.
              </p>
            ) : (
              data.revisionQueue.map((item) => (
                <div
                  key={item.taskId}
                  className="rounded-md border border-border/60 bg-background/50 p-3.5 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground truncate">
                      {item.taskTitle}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 shrink-0">
                      Putaran {item.roundNumber}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{item.projectName}</span>
                    <span>&bull;</span>
                    <span className="font-medium text-foreground/80">
                      {item.assigneeName}
                    </span>
                  </div>
                  <p className="text-muted-foreground/90 line-clamp-2 italic bg-muted/40 p-2 rounded text-[11px]">
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
          className="rounded-lg border border-border bg-card p-6 shadow-2xs lg:col-span-6"
        >
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h2
                id="workload-summary-heading"
                className="text-base font-semibold text-foreground"
              >
                Beban Kerja Tim Kreatif
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Jumlah tugas aktif faktual per desainer dan editor
              </p>
            </div>
            <Link
              href="/team"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              Matriks Lengkap <ArrowRight className="size-3" />
            </Link>
          </div>

          <div className="mt-4 divide-y divide-border/60">
            {data.creativeWorkloadSummary.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Tidak ada personel kreatif aktif yang terdaftar.
              </p>
            ) : (
              data.creativeWorkloadSummary.map((creative) => (
                <div
                  key={creative.creativeId}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {creative.creativeName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {creative.role}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="block text-xs font-semibold tabular-nums text-foreground">
                        {creative.activeTasksCount} Tugas
                      </span>
                      {creative.inReviewCount > 0 && (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400">
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
