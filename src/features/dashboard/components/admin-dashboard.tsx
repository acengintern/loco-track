import * as React from "react";
import Link from "next/link";
import {
  FolderKanban,
  AlertTriangle,
  Users,
  CheckCircle2,
  Activity,
  ArrowRight,
  Plus,
  Building2,
  Shield,
} from "lucide-react";
import { MetricCard } from "./metric-card";
import type { AdminDashboardData } from "../types";

interface AdminDashboardProps {
  data: AdminDashboardData;
}

export function AdminDashboard({ data }: AdminDashboardProps) {
  return (
    <div className="space-y-8">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/projects"
          className="block rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring group"
        >
          <MetricCard
            label="Project Aktif"
            value={data.activeProjectsCount}
            description="Total project operasional yang sedang berjalan"
            variant="default"
            icon={<FolderKanban className="size-4" />}
            className="group-hover:border-primary/40 transition-colors"
          />
        </Link>

        <Link
          href="/projects"
          className="block rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring group"
        >
          <MetricCard
            label="Project Terlambat"
            value={data.overdueProjectsCount}
            description="Project aktif yang melewati tanggal deadline"
            variant={data.overdueProjectsCount > 0 ? "destructive" : "default"}
            icon={<AlertTriangle className="size-4" />}
            className="group-hover:border-primary/40 transition-colors"
          />
        </Link>

        <Link
          href="/users"
          className="block rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring group"
        >
          <MetricCard
            label="Pengguna Aktif"
            value={data.activeUsersCount}
            description="Akun personel aktif dengan hak akses operasional"
            variant="default"
            icon={<Users className="size-4" />}
            className="group-hover:border-primary/40 transition-colors"
          />
        </Link>

        <Link
          href="/projects"
          className="block rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring group"
        >
          <MetricCard
            label="Project Dipublikasikan"
            value={data.publishedProjectsCount}
            description="Total siklus project yang telah selesai dipublikasikan"
            variant="success"
            icon={<CheckCircle2 className="size-4" />}
            className="group-hover:border-primary/40 transition-colors"
          />
        </Link>
      </div>

      {/* Admin Quick Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Shield className="size-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-foreground">
              Pusat Kendali Administrasi
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Akses cepat tata kelola pengguna, entitas bisnis, dan pencatatan audit
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/users"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-2xs"
          >
            <Users className="size-3.5 text-primary" />
            <span>Kelola Personel</span>
          </Link>

          <Link
            href="/clients"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-2xs"
          >
            <Building2 className="size-3.5 text-primary" />
            <span>Client & Brand</span>
          </Link>

          <Link
            href="/activity"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-2xs"
          >
            <Activity className="size-3.5 text-primary" />
            <span>Audit Log</span>
          </Link>

          <Link
            href="/projects?create=true"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs"
          >
            <Plus className="size-3.5" />
            <span>Buat Project</span>
          </Link>
        </div>
      </div>

      {/* Two-Column Operational Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Workflow Distribution */}
        <section
          aria-labelledby="workflow-distribution-heading"
          className="rounded-lg border border-border bg-card p-6 shadow-2xs lg:col-span-6"
        >
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h2
                id="workflow-distribution-heading"
                className="text-base font-semibold text-foreground"
              >
                Distribusi Status Workflow
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sebaran tahapan seluruh project dalam sistem
              </p>
            </div>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              Lihat Project <ArrowRight className="size-3" />
            </Link>
          </div>

          <div className="mt-4 divide-y divide-border/60">
            {data.workflowDistribution.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Belum ada data distribusi workflow.
              </p>
            ) : (
              data.workflowDistribution.map((item) => (
                <div
                  key={item.status}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="size-2 rounded-full bg-primary/70" />
                    <span className="font-medium text-foreground">{item.label}</span>
                  </div>
                  <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground">
                    {item.count || 0}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Recent Activity Log */}
        <section
          aria-labelledby="recent-activity-heading"
          className="rounded-lg border border-border bg-card p-6 shadow-2xs lg:col-span-6"
        >
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h2
                id="recent-activity-heading"
                className="text-base font-semibold text-foreground"
              >
                Aktivitas Operasional Terkini
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                10 catatan audit terakhir dari sistem
              </p>
            </div>
            <Link
              href="/activity"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              Buka Audit Log <ArrowRight className="size-3" />
            </Link>
          </div>

          <div className="mt-4">
            {data.recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Activity className="size-8 text-muted-foreground/60 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">
                  Belum ada catatan aktivitas sistem.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.recentActivity.map((act) => (
                  <div
                    key={act.id}
                    className="flex flex-col gap-1 rounded-md border border-border/50 bg-background/50 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground truncate">
                        {act.projectName}
                      </span>
                      <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                        {new Date(act.createdAt).toLocaleString("id-ID", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="font-medium text-foreground/80">
                        {act.actorName}
                      </span>
                      <span>&bull;</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {act.eventType}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
