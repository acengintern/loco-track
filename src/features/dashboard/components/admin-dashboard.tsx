import * as React from "react";
import Link from "next/link";
import {
  FolderKanban,
  AlertTriangle,
  Users,
  Activity,
  ArrowRight,
  Plus,
  Building2,
  Shield,
  Settings,
  UserCheck,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { MetricCard } from "./metric-card";
import type { AdminDashboardData } from "../types";

interface AdminDashboardProps {
  data: AdminDashboardData;
}

export function AdminDashboard({ data }: AdminDashboardProps) {
  // Compute maximum user count across roles for proportionate horizontal bars
  const maxRoleCount = Math.max(
    1,
    ...data.userDistribution.map((item) => item.count)
  );

  // Compute maximum workflow count across statuses for proportionate horizontal bars
  const maxWorkflowCount = Math.max(
    1,
    ...data.workflowDistribution.map((item) => item.count)
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 1. Metric Cards Grid (Prioritizing Governance) */}
      <div className="grid grid-cols-1 gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: Pengguna Aktif */}
        <Link
          href="/users"
          className="group block h-full rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MetricCard
            label="Pengguna Aktif"
            value={data.activeUsersCount}
            description={
              data.inactiveUsersCount > 0
                ? `${data.activeUsersCount} personel aktif, ${data.inactiveUsersCount} nonaktif`
                : "Akun personel aktif dengan akses operasional"
            }
            variant="default"
            icon={<Users className="size-5" />}
            className="group-hover:border-primary/40"
          />
        </Link>

        {/* Metric 2: Project Aktif */}
        <Link
          href="/projects"
          className="group block h-full rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MetricCard
            label="Project Aktif"
            value={data.activeProjectsCount}
            description="Total project operasional yang sedang berjalan"
            variant="default"
            icon={<FolderKanban className="size-5" />}
            className="group-hover:border-primary/40"
          />
        </Link>

        {/* Metric 3: Aktivitas Audit 7 Hari */}
        <Link
          href="/activity"
          className="group block h-full rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MetricCard
            label="Aktivitas Audit 7 Hari"
            value={data.auditActivity7DaysCount}
            description="Total catatan log sistem dalam 7 hari terakhir"
            variant="default"
            icon={<Activity className="size-5" />}
            className="group-hover:border-primary/40"
          />
        </Link>

        {/* Metric 4: Project Terlambat */}
        <Link
          href="/projects"
          className="group block h-full rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MetricCard
            label="Project Terlambat"
            value={data.overdueProjectsCount}
            description="Project aktif yang melewati tanggal deadline"
            variant={data.overdueProjectsCount > 0 ? "destructive" : "default"}
            icon={<AlertTriangle className="size-5" />}
            className="group-hover:border-primary/40"
          />
        </Link>
      </div>

      {/* 2. Pusat Kendali Administrasi (Standardized Action Hub Card) */}
      <Card>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 p-6 sm:p-7">
          <div className="flex items-center gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Shield className="size-5" />
            </div>
            <div>
              <CardTitle>Pusat Kendali Administrasi</CardTitle>
              <CardDescription className="mt-1">
                Akses cepat tata kelola pengguna, entitas bisnis, log audit, dan pengaturan
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/users"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Users className="size-4 text-muted-foreground" />
              <span>Kelola Pengguna</span>
            </Link>

            <Link
              href="/clients"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Building2 className="size-4 text-muted-foreground" />
              <span>Client & Brand</span>
            </Link>

            <Link
              href="/activity"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Activity className="size-4 text-muted-foreground" />
              <span>Audit Log</span>
            </Link>

            <Link
              href="/settings"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Settings className="size-4 text-muted-foreground" />
              <span>Settings</span>
            </Link>

            <Link
              href="/projects?create=true"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="size-4 text-muted-foreground" />
              <span>Buat Project</span>
            </Link>
          </div>
        </div>
      </Card>

      {/* 3. Governance Row (2 Columns: Distribusi Pengguna & Perubahan Akses Terbaru) */}
      <div className="grid grid-cols-1 gap-6 sm:gap-7 lg:grid-cols-12">
        {/* Governance Column 1: Distribusi Pengguna */}
        <Card className="flex flex-col h-full lg:col-span-6">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border p-6 sm:p-7 min-h-[72px]">
            <div>
              <CardTitle>Distribusi Pengguna</CardTitle>
              <CardDescription className="mt-1">
                Sebaran akun personel berdasarkan peran akses operasional
              </CardDescription>
            </div>
            <Link
              href="/users"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-xs shrink-0"
            >
              <span>Kelola Pengguna</span>
              <ArrowRight className="size-4" />
            </Link>
          </CardHeader>

          <CardContent className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
            {data.userDistribution.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Belum ada data pengguna yang terdaftar.
              </p>
            ) : (
              <div className="space-y-3">
                {data.userDistribution.map((item) => {
                  const percentage =
                    item.count > 0
                      ? Math.max(6, Math.round((item.count / maxRoleCount) * 100))
                      : 0;

                  return (
                    <Link
                      key={item.role}
                      href={`/users?role=${item.role}`}
                      className="group block rounded-md p-2 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {item.label}
                        </span>
                        <span className="inline-flex items-center rounded-sm bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground">
                          {item.count}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/70 group-hover:bg-primary transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Governance Column 2: Perubahan Akses Terbaru */}
        <Card className="flex flex-col h-full lg:col-span-6">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border p-6 sm:p-7 min-h-[72px]">
            <div>
              <CardTitle>Perubahan Akses Terbaru</CardTitle>
              <CardDescription className="mt-1">
                Catatan penambahan, pencabutan, dan penetapan akses personel
              </CardDescription>
            </div>
            <Link
              href="/activity"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-xs shrink-0"
            >
              <span>Buka Audit Log</span>
              <ArrowRight className="size-4" />
            </Link>
          </CardHeader>

          <CardContent className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
            {data.recentAccessChanges.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <UserCheck className="size-10 text-muted-foreground/50 mb-2.5" />
                <p className="text-sm text-muted-foreground">
                  Belum ada perubahan akses terbaru.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.recentAccessChanges.map((event) => (
                  <div
                    key={event.id}
                    className="flex flex-col gap-1.5 rounded-md border border-border/50 bg-background/50 p-3.5 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-semibold text-foreground truncate">
                          {event.targetUserName}
                        </span>
                        {event.targetUserRole && (
                          <span className="inline-flex items-center rounded-xs bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground shrink-0">
                            {event.targetUserRole}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                        {new Date(event.createdAt).toLocaleString("id-ID", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-foreground/90 font-medium text-sm">
                        {event.actionLabel}
                      </span>
                      {event.contextName && (
                        <span className="truncate max-w-[200px] text-muted-foreground">
                          {event.contextName}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. Operational Row (2 Columns: Distribusi Status Workflow & Aktivitas Operasional) */}
      <div className="grid grid-cols-1 gap-6 sm:gap-7 lg:grid-cols-12">
        {/* Operational Column 1: Distribusi Status Workflow */}
        <Card className="flex flex-col h-full lg:col-span-6">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border p-6 sm:p-7 min-h-[72px]">
            <div>
              <CardTitle>Distribusi Status Workflow</CardTitle>
              <CardDescription className="mt-1">
                Sebaran tahapan seluruh project dalam sistem
              </CardDescription>
            </div>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-xs shrink-0"
            >
              <span>Lihat Project</span>
              <ArrowRight className="size-4" />
            </Link>
          </CardHeader>

          <CardContent className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
            {data.workflowDistribution.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Belum ada data project dalam workflow.
              </p>
            ) : (
              <div className="space-y-3">
                {data.workflowDistribution.map((item) => {
                  const percentage =
                    item.count > 0
                      ? Math.max(6, Math.round((item.count / maxWorkflowCount) * 100))
                      : 0;

                  return (
                    <div key={item.status} className="p-1">
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="size-2 rounded-full bg-primary/70 shrink-0" />
                          <span className="font-medium text-foreground">
                            {item.label}
                          </span>
                        </div>
                        <span className="inline-flex items-center rounded-sm bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground">
                          {item.count}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/60"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Operational Column 2: Aktivitas Operasional Terkini */}
        <Card className="flex flex-col h-full lg:col-span-6">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border p-6 sm:p-7 min-h-[72px]">
            <div>
              <CardTitle>Aktivitas Operasional Terkini</CardTitle>
              <CardDescription className="mt-1">
                10 catatan riwayat aksi operasional terbaru dari seluruh project
              </CardDescription>
            </div>
            <Link
              href="/activity"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-xs shrink-0"
            >
              <span>Buka Audit Log</span>
              <ArrowRight className="size-4" />
            </Link>
          </CardHeader>

          <CardContent className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
            {data.recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Activity className="size-10 text-muted-foreground/50 mb-2.5" />
                <p className="text-sm text-muted-foreground">
                  Belum ada aktivitas operasional yang tercatat.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.recentActivity.map((act) => (
                  <div
                    key={act.id}
                    className="flex flex-col gap-1.5 rounded-md border border-border/50 bg-background/50 p-3.5 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground truncate">
                        {act.projectName}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                        {new Date(act.createdAt).toLocaleString("id-ID", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <span className="font-medium text-foreground/90 text-sm">
                        {act.actorName}
                      </span>
                      <span>{act.actionPhrase}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
