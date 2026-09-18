import * as React from "react";
import Link from "next/link";
import {
  FolderKanban,
  Send,
  UploadCloud,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Plus,
} from "lucide-react";
import { MetricCard } from "./metric-card";
import type { SmsDashboardData } from "../types";

interface SmsDashboardProps {
  data: SmsDashboardData;
}

export function SmsDashboard({ data }: SmsDashboardProps) {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Project Saya Aktif"
          value={data.myActiveProjectsCount}
          description="Total project di bawah kepemilikan Anda yang sedang aktif"
          variant="default"
          icon={<FolderKanban className="size-5" />}
        />
        <MetricCard
          label="Menunggu Respon Klien"
          value={data.awaitingClientProjectsCount}
          description="Project yang sedang diajukan dalam tahap review klien"
          variant="default"
          icon={<Send className="size-5" />}
        />
        <MetricCard
          label="Siap Dipublikasikan"
          value={data.readyToPublishProjectsCount}
          description="Project telah disetujui klien dan siap tayang"
          variant="success"
          icon={<UploadCloud className="size-5" />}
        />
        <MetricCard
          label="Project Saya Terlambat"
          value={data.overdueOwnedProjectsCount}
          description="Project milik Anda yang melewati tanggal tenggat waktu"
          variant={data.overdueOwnedProjectsCount > 0 ? "destructive" : "default"}
          icon={<AlertTriangle className="size-5" />}
        />
      </div>

      {/* Operational Action Banners */}
      <div className="grid grid-cols-1 gap-6 sm:gap-7 lg:grid-cols-12">
        {/* Ready for Client Presentation */}
        <section
          aria-labelledby="ready-for-client-heading"
          className="rounded-lg border border-border bg-card p-6 sm:p-7 shadow-2xs lg:col-span-6"
        >
          <div className="flex items-center justify-between border-b border-border pb-4 sm:pb-5">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                <h2
                  id="ready-for-client-heading"
                  className="text-lg sm:text-[19px] font-semibold text-foreground"
                >
                  Siap Dipresentasikan ke Klien
                </h2>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                QC internal selesai. Buka putaran review klien sekarang
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3.5">
            {data.readyForClient.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Tidak ada project yang menunggu presentasi klien.
              </p>
            ) : (
              data.readyForClient.map((p) => (
                <div
                  key={p.projectId}
                  className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 p-4 text-sm"
                >
                  <div>
                    <p className="font-semibold text-foreground">{p.projectName}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{p.brandName}</p>
                  </div>
                  <Link
                    href={`/projects/${p.projectId}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                  >
                    Buka Review <ArrowRight className="size-4" />
                  </Link>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Ready to Publish */}
        <section
          aria-labelledby="ready-to-publish-heading"
          className="rounded-lg border border-border bg-card p-6 sm:p-7 shadow-2xs lg:col-span-6"
        >
          <div className="flex items-center justify-between border-b border-border pb-4 sm:pb-5">
            <div>
              <div className="flex items-center gap-2">
                <UploadCloud className="size-5 text-emerald-600 dark:text-emerald-400" />
                <h2
                  id="ready-to-publish-heading"
                  className="text-lg sm:text-[19px] font-semibold text-foreground"
                >
                  Siap Dipublikasikan
                </h2>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Persetujuan klien telah lengkap. Catat rilis publikasi project
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3.5">
            {data.readyToPublish.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Tidak ada project yang menunggu publikasi saat ini.
              </p>
            ) : (
              data.readyToPublish.map((p) => (
                <div
                  key={p.projectId}
                  className="flex items-center justify-between rounded-md border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm"
                >
                  <div>
                    <p className="font-semibold text-foreground">{p.projectName}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{p.brandName}</p>
                  </div>
                  <Link
                    href={`/projects/${p.projectId}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                  >
                    Publikasi <ArrowRight className="size-4" />
                  </Link>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Active Client Revisions & Owned Projects */}
      <div className="grid grid-cols-1 gap-6 sm:gap-7 lg:grid-cols-12">
        {/* Active Client Revisions */}
        <section
          aria-labelledby="active-client-revisions-heading"
          className="rounded-lg border border-border bg-card p-6 sm:p-7 shadow-2xs lg:col-span-6"
        >
          <div className="border-b border-border pb-4 sm:pb-5">
            <h2
              id="active-client-revisions-heading"
              className="text-lg sm:text-[19px] font-semibold text-foreground"
            >
              Revisi Klien Sedang Berjalan
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Catatan perbaikan dari klien yang sedang dikerjakan tim kreatif
            </p>
          </div>

          <div className="mt-5 space-y-3.5">
            {data.activeClientRevisions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Tidak ada revisi klien aktif pada project yang Anda kelola.
              </p>
            ) : (
              data.activeClientRevisions.map((rev) => (
                <div
                  key={rev.taskId}
                  className="rounded-md border border-border/60 bg-background/50 p-4 text-sm space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground truncate">
                      {rev.taskTitle}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {rev.creativeName}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">{rev.projectName}</p>
                  <p className="text-muted-foreground/90 line-clamp-2 italic bg-muted/40 p-2.5 rounded text-xs sm:text-sm">
                    &quot;{rev.notes}&quot;
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Owned Projects Table */}
        <section
          aria-labelledby="owned-projects-heading"
          className="rounded-lg border border-border bg-card p-6 sm:p-7 shadow-2xs lg:col-span-6"
        >
          <div className="flex items-center justify-between border-b border-border pb-4 sm:pb-5">
            <div>
              <h2
                id="owned-projects-heading"
                className="text-lg sm:text-[19px] font-semibold text-foreground"
              >
                Project yang Anda Kelola
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Daftar project aktif dengan Anda sebagai penanggung jawab
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <Link
                href="/projects?create=true"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs"
              >
                <Plus className="size-4" />
                <span>Buat Project</span>
              </Link>
              <Link
                href="/projects"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-sm pl-1"
              >
                Semua <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {data.ownedProjects.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground space-y-3">
                <p>Belum ada project yang ditugaskan ke Anda.</p>
                <Link
                  href="/projects?create=true"
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs"
                >
                  <Plus className="size-4" />
                  <span>Buat Project Pertama</span>
                </Link>
              </div>
            ) : (
              data.ownedProjects.map((p) => (
                <div
                  key={p.projectId}
                  className="flex items-center justify-between rounded-md border border-border/60 bg-background/50 p-4 text-sm"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/projects/${p.projectId}`}
                      className="font-semibold text-foreground hover:text-primary transition-colors truncate block"
                    >
                      {p.projectName}
                    </Link>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {p.brandName} &bull; {p.status}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="block font-mono text-sm tabular-nums text-foreground">
                      {p.deadline}
                    </span>
                    {p.isOverdue && (
                      <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                        Terlewat
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
