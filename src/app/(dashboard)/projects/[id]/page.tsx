import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Calendar,
  User,
  Building2,
  Tag,
  Clock,
  FileText,
  Layers,
  ArrowRight,
  CheckSquare,
} from "lucide-react";
import { requireActiveProfile } from "@/lib/supabase/auth";
import {
  getProjectById,
  getAvailableUsersForTeamRoster,
  getActiveBrandsForProjectSelection,
  getActiveSMSUsersForSelection,
} from "@/features/projects/queries";
import { ProjectDetailHeader } from "@/features/projects/components/project-detail-header";
import { ProjectTeamSection } from "@/features/projects/components/project-team-section";
import { ProjectActivityFeed } from "@/features/projects/components/project-activity-feed";
import { ProjectPlanningSummary } from "@/features/projects/components/project-planning-summary";
import {
  ProjectSubnav,
  type ProjectTabKey,
} from "@/features/projects/components/project-subnav";

import { getBriefByProjectId } from "@/features/briefs/queries";
import { BriefView } from "@/features/briefs/components/brief-view";

import { getContentPlansByProjectId } from "@/features/content-plans/queries";
import { ContentPlanList } from "@/features/content-plans/components/content-plan-list";

import { getScriptsByProjectId } from "@/features/scripts/queries";
import { ScriptList } from "@/features/scripts/components/script-list";

import {
  getTasksByProjectId,
  getAssignableCreativeUsers,
} from "@/features/tasks/queries";
import { TaskList } from "@/features/tasks/components/task-list";
import { ProductionReadinessPanel } from "@/features/tasks/components/production-readiness-panel";
import { TaskStatusBadge } from "@/features/tasks/components/task-badges";
import type { TaskStatus } from "@/features/tasks/types";
import { getProjectQcCompleteness } from "@/features/approvals/queries";
import { ProjectQcSummary } from "@/features/approvals/components/project-qc-summary";
import { getProjectClientReviewData } from "@/features/client-review/queries";
import { ClientReviewTab } from "@/features/client-review/components/client-review-tab";

interface ProjectDetailPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    tab?: string;
    view?: string;
  }>;
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: ProjectDetailPageProps) {
  const profile = await requireActiveProfile();
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const isCreativePreview = resolvedSearchParams.view === "creative";
  const isCreativeRole =
    profile.role === "GRAPHIC_DESIGNER" ||
    profile.role === "VIDEO_EDITOR" ||
    isCreativePreview;
  const defaultTab: ProjectTabKey = isCreativeRole ? "tasks" : "overview";
  const requestedTab = resolvedSearchParams.tab as ProjectTabKey;

  // Protect creatives from administrative tabs and default to tasks
  let activeTab: ProjectTabKey = requestedTab || defaultTab;
  if (
    isCreativeRole &&
    activeTab !== "tasks" &&
    activeTab !== "brief" &&
    activeTab !== "script" &&
    activeTab !== "overview"
  ) {
    activeTab = "tasks";
  }

  const project = await getProjectById(id);
  if (!project) {
    notFound();
  }

  const canManage =
    profile.role === "ADMIN" ||
    (profile.role === "SOCIAL_MEDIA_SPECIALIST" &&
      project.sms_owner_id === profile.id);

  const [brief, contentPlans, scripts, tasks] = await Promise.all([
    getBriefByProjectId(id),
    getContentPlansByProjectId(id),
    getScriptsByProjectId(id),
    getTasksByProjectId(id),
  ]);

  const [
    assignableCreatives,
    availableUsers,
    brands,
    smsUsers,
    qcCompleteness,
    clientReviewData,
  ] = await Promise.all([
    canManage ? getAssignableCreativeUsers() : Promise.resolve([]),
    canManage ? getAvailableUsersForTeamRoster(id) : Promise.resolve([]),
    canManage ? getActiveBrandsForProjectSelection() : Promise.resolve([]),
    canManage ? getActiveSMSUsersForSelection() : Promise.resolve([]),
    getProjectQcCompleteness(id),
    !isCreativeRole ? getProjectClientReviewData(id) : Promise.resolve(null),
  ]);

  const readyScriptsCount = scripts.filter((s) => s.status === "READY").length;

  let clientReviewBadge: string | undefined;
  let clientReviewBadgeColor: string | undefined;

  if (project.status === "PUBLISHED") {
    clientReviewBadge = "LIVE";
    clientReviewBadgeColor = "text-emerald-500 bg-emerald-500/10";
  } else if (project.status === "APPROVED") {
    clientReviewBadge = "APPROVED";
    clientReviewBadgeColor = "text-emerald-500 bg-emerald-500/10";
  } else if (project.status === "CLIENT_REVIEW") {
    clientReviewBadge = "REVIEW";
    clientReviewBadgeColor = "text-blue-500 bg-blue-500/10";
  } else if (project.status === "INTERNAL_QC") {
    clientReviewBadge = "QC";
    clientReviewBadgeColor = "text-amber-500 bg-amber-500/10";
  }

  // Calculate days remaining or overdue
  const deadlineDate = new Date(project.deadline);
  const now = new Date();
  const diffTime = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return (
    <div className="space-y-6">
      <ProjectDetailHeader
        project={project}
        canManage={canManage}
        isAdmin={profile.role === "ADMIN"}
        isCreativePreview={isCreativePreview}
        brands={brands}
        smsUsers={smsUsers}
      />

      {/* Planning Subnavigation Tabs */}
      <ProjectSubnav
        projectId={project.id}
        activeTab={activeTab}
        userRole={isCreativeRole ? "GRAPHIC_DESIGNER" : profile.role}
        isCreativePreview={isCreativePreview}
        counts={{
          hasBrief: !!brief,
          contentPlans: contentPlans.length,
          scripts: scripts.length,
          tasks: tasks.length,
          team: project.members.length,
          clientReviewBadge,
          clientReviewBadgeColor,
        }}
      />

      {/* Tab: Overview */}
      {activeTab === "overview" &&
        (isCreativeRole ? (
          <div className="space-y-6">
            {/* Simple Project Summary Card */}
            <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 block mb-0.5">
                    Ringkasan Proyek
                  </span>
                  <h2 className="text-base font-semibold text-foreground">
                    {project.name}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Batas Waktu:</span>
                  <span className="font-semibold text-xs text-foreground">
                    {new Date(project.deadline).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  {diffDays < 0 ? (
                    <span className="text-[10px] font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded border border-destructive/20">
                      Terlambat {Math.abs(diffDays)} hari
                    </span>
                  ) : diffDays === 0 ? (
                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Batas akhir hari ini
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {diffDays} hari lagi
                    </span>
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {project.description ||
                  "Belum ada deskripsi atau catatan khusus yang ditambahkan pada project ini."}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs border-t border-border/40">
                <div className="flex items-center gap-2">
                  <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Klien:</span>
                  <span className="font-medium text-foreground">{project.brand.client.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">SMS Penanggung Jawab:</span>
                  <span className="font-medium text-foreground">{project.sms_owner.full_name}</span>
                </div>
              </div>
            </div>

            {/* Creative Reference Quick Cards: Brief & Naskah */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Brief Card */}
              <div className="rounded-lg border border-border bg-card p-5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Brief Kreatif</h3>
                  </div>
                  <Link
                    href={`/projects/${project.id}?tab=brief`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                  >
                    <span>Buka Brief</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
                {brief ? (
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 block">
                        Objektif Utama
                      </span>
                      <p className="text-foreground line-clamp-2 mt-0.5">{brief.objective}</p>
                    </div>
                    {brief.target_audience && (
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 block">
                          Target Audiens
                        </span>
                        <p className="text-muted-foreground line-clamp-1 mt-0.5">{brief.target_audience}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Belum ada brief kreatif yang diisi.
                  </p>
                )}
              </div>

              {/* Script Card */}
              <div className="rounded-lg border border-border bg-card p-5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="size-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Naskah Konten ({scripts.length})
                    </h3>
                  </div>
                  <Link
                    href={`/projects/${project.id}?tab=script`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                  >
                    <span>Buka Naskah</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
                {scripts.length > 0 ? (
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 block">
                        Judul Naskah Utama
                      </span>
                      <p className="text-foreground font-medium line-clamp-1 mt-0.5">{scripts[0].title}</p>
                    </div>
                    {scripts[0].hook && (
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 block">
                          Visual Hook
                        </span>
                        <p className="text-muted-foreground line-clamp-2 mt-0.5">{scripts[0].hook}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    {project.script_not_required
                      ? "Naskah tidak diperlukan untuk project ini."
                      : "Belum ada naskah yang dibuat."}
                  </p>
                )}
              </div>
            </div>

            {/* My Tasks in this Project */}
            <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckSquare className="size-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Tugas Saya di Proyek Ini ({tasks.filter((t) => t.current_assignee_id === profile.id).length})
                  </h3>
                </div>
                <Link
                  href={`/projects/${project.id}?tab=tasks`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                >
                  <span>Lihat Semua Tugas Proyek</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>

              {tasks.filter((t) => t.current_assignee_id === profile.id).length > 0 ? (
                <div className="divide-y divide-border text-xs">
                  {tasks
                    .filter((t) => t.current_assignee_id === profile.id)
                    .map((task) => (
                      <div key={task.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{task.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Batas Waktu: {new Date(task.deadline).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <TaskStatusBadge status={task.status as TaskStatus} />
                          <Link
                            href={`/projects/${project.id}?tab=tasks`}
                            className="text-xs text-primary hover:underline font-medium"
                          >
                            Buka Tugas
                          </Link>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-muted-foreground bg-muted/20 rounded-md border border-border/40">
                  <p>Belum ada tugas yang ditugaskan khusus kepada Anda di proyek ini.</p>
                  <p className="text-[11px] mt-1 text-muted-foreground/80">
                    Buka tab <Link href={`/projects/${project.id}?tab=tasks`} className="text-primary underline">Tugas</Link> untuk melihat seluruh tugas produksi yang tersedia.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Main 2 Columns: Planning Status, Project Overview, Quick Glance Panels */}
            <div className="space-y-6 lg:col-span-2">
              {/* Planning Status & Transition Engine */}
              <ProjectPlanningSummary
                projectId={project.id}
                projectStatus={project.status}
                scriptNotRequired={project.script_not_required}
                hasBrief={!!brief}
                contentPlansCount={contentPlans.length}
                scriptsCount={scripts.length}
                readyScriptsCount={readyScriptsCount}
                canManage={canManage}
              />

              {/* Production Readiness & Transition (when in SCRIPT_READY) */}
              {project.status === "SCRIPT_READY" && (
                <ProductionReadinessPanel
                  projectId={project.id}
                  projectStatus={project.status}
                  projectDeadline={project.deadline}
                  tasks={tasks}
                  canManage={canManage}
                />
              )}

              {/* Overview Card */}
              <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-2xs">
                <h2 className="text-sm font-semibold text-foreground">
                  Ringkasan Project
                </h2>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {project.description ||
                    "Belum ada deskripsi atau catatan khusus yang ditambahkan pada project ini."}
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 border-t border-border/60 pt-4 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 block mb-1">
                      Periode Pelaksanaan
                    </span>
                    <div className="flex items-center gap-1.5 text-foreground font-medium">
                      <Calendar className="size-3.5 text-muted-foreground" />
                      <span>
                        {new Date(project.start_date).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        s/d{" "}
                        {new Date(project.deadline).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 block mb-1">
                      Status Sisa Waktu
                    </span>
                    <div className="flex items-center gap-1.5 font-medium">
                      <Clock className="size-3.5 text-muted-foreground" />
                      {diffDays < 0 ? (
                        <span className="text-destructive font-semibold">
                          Terlambat {Math.abs(diffDays)} hari dari batas akhir
                        </span>
                      ) : diffDays === 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          Batas akhir hari ini
                        </span>
                      ) : (
                        <span className="text-foreground">
                          Tersisa {diffDays} hari lagi
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Glance: Brief */}
              <div className="rounded-lg border border-border bg-card p-5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Project Brief
                    </h3>
                  </div>
                  <Link
                    href={`/projects/${project.id}?tab=brief`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                  >
                    <span>Buka Brief Lengkap</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>

                {brief ? (
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 block">
                        Objektif Utama
                      </span>
                      <p className="text-foreground mt-0.5 line-clamp-2">
                        {brief.objective}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 block">
                        Target Audiens
                      </span>
                      <p className="text-muted-foreground mt-0.5 line-clamp-1">
                        {brief.target_audience}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Brief belum diisi. Lengkapi brief untuk melanjutkan alur kerja.
                  </p>
                )}
              </div>

              {/* Quick Glance: Content Plan */}
              <div className="rounded-lg border border-border bg-card p-5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Content Plan ({contentPlans.length})
                    </h3>
                  </div>
                  <Link
                    href={`/projects/${project.id}?tab=content-plan`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                  >
                    <span>Buka Content Plan</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>

                {contentPlans.length > 0 ? (
                  <div className="divide-y divide-border text-xs">
                    {contentPlans.slice(0, 3).map((cp) => (
                      <div
                        key={cp.id}
                        className="py-2 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-medium text-foreground">
                            {cp.title}
                          </span>
                          <div className="text-[11px] text-muted-foreground">
                            {cp.channel} • Post: {cp.planned_post_date}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.2 rounded uppercase ${
                            cp.status === "APPROVED"
                              ? "text-emerald-500 bg-emerald-500/10"
                              : "text-amber-500 bg-amber-500/10"
                          }`}
                        >
                          {cp.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Belum ada content plan yang ditambahkan.
                  </p>
                )}
              </div>

              {/* Quick Glance: Scripts */}
              <div className="rounded-lg border border-border bg-card p-5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="size-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Naskah ({scripts.length})
                    </h3>
                  </div>
                  <Link
                    href={`/projects/${project.id}?tab=script`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                  >
                    <span>Buka Naskah</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>

                {scripts.length > 0 ? (
                  <div className="divide-y divide-border text-xs">
                    {scripts.slice(0, 3).map((script) => (
                      <div
                        key={script.id}
                        className="py-2 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-medium text-foreground">
                            {script.title}
                          </span>
                          <div className="text-[11px] text-muted-foreground line-clamp-1 max-w-[280px]">
                            Hook: {script.hook}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.2 rounded uppercase ${
                            script.status === "READY"
                              ? "text-emerald-500 bg-emerald-500/10"
                              : "text-amber-500 bg-amber-500/10"
                          }`}
                        >
                          {script.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    {project.script_not_required
                      ? "Opsi 'Script tidak diperlukan' aktif untuk project ini."
                      : "Belum ada naskah yang dibuat."}
                  </p>
                )}
              </div>

              {/* Quick Glance: Tasks */}
              <div className="rounded-lg border border-border bg-card p-5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare className="size-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Tugas Produksi ({tasks.length})
                    </h3>
                  </div>
                  <Link
                    href={`/projects/${project.id}?tab=tasks`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                  >
                    <span>Buka Tugas</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>

                {tasks.length > 0 ? (
                  <div className="divide-y divide-border text-xs">
                    {tasks.slice(0, 3).map((task) => (
                      <div
                        key={task.id}
                        className="py-2 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-medium text-foreground">
                            {task.title}
                          </span>
                          <div className="text-[11px] text-muted-foreground">
                            {task.current_assignee?.full_name || "Belum ditugaskan"} • Deadline:{" "}
                            {new Date(task.deadline).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                            })}
                          </div>
                        </div>
                        <TaskStatusBadge status={task.status as TaskStatus} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Belum ada tugas produksi yang dibuat.
                  </p>
                )}
              </div>
            </div>

            {/* Right 1 Column: Metadata Panels */}
            <div className="space-y-6">
              {/* SMS Owner Card */}
              <div className="rounded-lg border border-border bg-card p-5 space-y-3 shadow-2xs">
                <h2 className="text-xs uppercase font-semibold text-muted-foreground/80 tracking-wider">
                  Penanggung Jawab Project
                </h2>

                <div className="flex items-center gap-3 pt-1">
                  <div className="flex size-9 items-center justify-center rounded-full bg-muted font-semibold text-xs text-foreground border border-border">
                    <User className="size-4 text-muted-foreground" />
                  </div>
                  <div className="text-xs">
                    <div className="font-semibold text-foreground">
                      {project.sms_owner.full_name}
                    </div>
                    <div className="text-muted-foreground text-[11px]">
                      Social Media Specialist
                    </div>
                    <div className="text-muted-foreground/80 text-[11px] truncate max-w-[180px]">
                      {project.sms_owner.email}
                    </div>
                  </div>
                </div>
              </div>

              {/* Client & Brand Metadata */}
              <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-2xs text-xs">
                <h2 className="text-xs uppercase font-semibold text-muted-foreground/80 tracking-wider">
                  Afiliasi Klien
                </h2>

                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 block mb-0.5">
                      Perusahaan Klien
                    </span>
                    <Link
                      href={`/clients/${project.brand.client.id}`}
                      className="font-semibold text-foreground hover:underline flex items-center gap-1.5"
                    >
                      <Building2 className="size-3.5 text-muted-foreground" />
                      <span>{project.brand.client.name}</span>
                    </Link>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 block mb-0.5">
                      Brand & Kode
                    </span>
                    <Link
                      href={`/brands/${project.brand.id}`}
                      className="font-semibold text-foreground hover:underline flex items-center gap-1.5"
                    >
                      <Tag className="size-3.5 text-muted-foreground" />
                      <span>{project.brand.name}</span>
                      <span className="font-mono text-[10px] bg-muted px-1.5 py-0.2 rounded border border-border">
                        {project.brand.code}
                      </span>
                    </Link>
                  </div>

                  <div className="border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
                    Dibuat pada{" "}
                    {new Date(project.created_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

      {/* Tab: Brief */}
      {activeTab === "brief" && (
        <BriefView
          projectId={project.id}
          projectStatus={project.status}
          brief={brief}
          canManage={canManage}
        />
      )}

      {/* Tab: Content Plan */}
      {activeTab === "content-plan" && (
        <ContentPlanList
          projectId={project.id}
          projectStatus={project.status}
          contentPlans={contentPlans}
          canManage={canManage}
        />
      )}

      {/* Tab: Script */}
      {activeTab === "script" && (
        <ScriptList
          projectId={project.id}
          projectStatus={project.status}
          scripts={scripts}
          availableContentPlans={contentPlans}
          canManage={canManage}
          scriptNotRequired={project.script_not_required}
        />
      )}

      {/* Tab: Tasks */}
      {activeTab === "tasks" && (
        <div className="space-y-6">
          {!isCreativeRole &&
            (project.status === "PRODUCTION" ||
              project.status === "INTERNAL_QC") && (
              <ProjectQcSummary summary={qcCompleteness} />
            )}
          {canManage && project.status === "SCRIPT_READY" && (
            <ProductionReadinessPanel
              projectId={project.id}
              projectStatus={project.status}
              projectDeadline={project.deadline}
              tasks={tasks}
              canManage={canManage}
            />
          )}
          <TaskList
            tasks={tasks}
            projectId={project.id}
            projectDeadline={project.deadline}
            currentUserId={profile.id}
            userRole={profile.role}
            canManage={canManage}
            availableAssignees={assignableCreatives}
            availableContentPlans={contentPlans}
            availableScripts={scripts}
          />
        </div>
      )}

      {/* Tab: Client Review & Publication */}
      {activeTab === "client-review" && clientReviewData && (
        <ClientReviewTab
          data={clientReviewData}
          projectName={project.name}
          userRole={profile.role}
          currentUserId={profile.id}
          canManage={canManage}
        />
      )}

      {/* Tab: Team */}
      {activeTab === "team" && (
        <ProjectTeamSection
          projectId={project.id}
          smsOwnerId={project.sms_owner_id}
          members={project.members}
          availableUsers={availableUsers}
          canManageTeam={canManage}
        />
      )}

      {/* Tab: Activity */}
      {activeTab === "activity" && (
        <ProjectActivityFeed logs={project.activity_logs} />
      )}
    </div>
  );
}
