import * as React from "react";
import Link from "next/link";
import {
  FolderKanban,
  Eye,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Clock,
} from "lucide-react";
import { MetricCard } from "./metric-card";
import type { AccountExecutiveDashboardData } from "../types";

interface AccountExecutiveDashboardProps {
  data: AccountExecutiveDashboardData;
}

export function AccountExecutiveDashboard({ data }: AccountExecutiveDashboardProps) {
  return (
    <div className="space-y-8">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Project Aktif"
          value={data.activeProjectsCount}
          description="Total project yang sedang berjalan di agensi"
          variant="default"
          icon={<FolderKanban className="size-4" />}
        />
        <MetricCard
          label="Review Klien"
          value={data.clientReviewProjectsCount}
          description="Project yang sedang ditinjau atau menunggu respon klien"
          variant="default"
          icon={<Eye className="size-4" />}
        />
        <MetricCard
          label="Project Terlambat"
          value={data.overdueProjectsCount}
          description="Project aktif yang melewati tanggal tenggat waktu"
          variant={data.overdueProjectsCount > 0 ? "destructive" : "default"}
          icon={<AlertTriangle className="size-4" />}
        />
        <MetricCard
          label="Project Dipublikasikan"
          value={data.publishedProjectsCount}
          description="Project yang telah selesai dipublikasikan"
          variant="success"
          icon={<CheckCircle2 className="size-4" />}
        />
      </div>

      {/* Two-Column Operational Monitoring Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Projects in Client Review */}
        <section
          aria-labelledby="client-review-heading"
          className="rounded-lg border border-border bg-card p-6 shadow-2xs lg:col-span-6"
        >
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h2
                id="client-review-heading"
                className="text-base font-semibold text-foreground"
              >
                Project Dalam Review Klien
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pemantauan putaran review dan PIC SMS yang bertanggung jawab
              </p>
            </div>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              Semua Project <ArrowRight className="size-3" />
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {data.clientReviewProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Eye className="size-8 text-muted-foreground/60 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">
                  Tidak ada project dalam review klien saat ini.
                </p>
              </div>
            ) : (
              data.clientReviewProjects.map((p) => (
                <div
                  key={p.projectId}
                  className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/50 p-3.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground truncate">
                      {p.projectName}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary shrink-0">
                      Putaran {p.roundNumber}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="font-medium text-foreground/80">
                      {p.brandName}
                    </span>
                    <span className="text-[11px]">
                      PIC: {p.smsOwnerName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                    <Clock className="size-3" />
                    <span>Tenggat: {p.deadline}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Upcoming Deadlines (Read-Only) */}
        <section
          aria-labelledby="upcoming-deadlines-heading"
          className="rounded-lg border border-border bg-card p-6 shadow-2xs lg:col-span-6"
        >
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h2
                id="upcoming-deadlines-heading"
                className="text-base font-semibold text-foreground"
              >
                Jadwal &amp; Tenggat Waktu Terdekat
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Urutan project aktif berdasarkan kedekatan tanggal deadline
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {data.upcomingDeadlines.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Tidak ada project aktif yang tercatat.
              </p>
            ) : (
              data.upcomingDeadlines.map((p) => (
                <div
                  key={p.projectId}
                  className="flex items-center justify-between rounded-md border border-border/60 bg-background/50 p-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {p.projectName}
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      {p.brandName} &bull; {p.status}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="block font-mono text-xs tabular-nums text-foreground">
                      {p.deadline}
                    </span>
                    {p.isOverdue ? (
                      <span className="inline-flex items-center rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                        Terlewat
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        Aktif
                      </span>
                    )}
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
