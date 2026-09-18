"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FolderKanban,
  ExternalLink,
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Archive,
} from "lucide-react";
import type { ProjectWithRelations, PaginatedProjects } from "../types";
import type { UserRole } from "@/types/database";
import { ProjectStatusBadge, ProjectPriorityBadge } from "./project-badges";
import { ProjectArchiveDialog } from "./project-archive-dialog";
import { ProjectCreateDialog } from "./project-create-dialog";
import { Button } from "@/components/ui/button";

interface ProjectListProps {
  data: PaginatedProjects;
  userRole: UserRole;
  currentUserId: string;
  hasFilters: boolean;
  brands?: Array<{
    id: string;
    name: string;
    code: string;
    client_name: string;
  }>;
  smsUsers?: Array<{
    id: string;
    full_name: string;
    email: string;
  }>;
}

export function ProjectList({
  data,
  userRole,
  currentUserId,
  hasFilters,
  brands = [],
  smsUsers = [],
}: ProjectListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [archivingProject, setArchivingProject] =
    React.useState<ProjectWithRelations | null>(null);

  const canCreate = userRole === "ADMIN" || userRole === "SOCIAL_MEDIA_SPECIALIST";

  const goToPage = (pageNumber: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(pageNumber));
    router.push(`/projects?${params.toString()}`);
  };

  const isOwnerOrAdmin = (project: ProjectWithRelations) => {
    return userRole === "ADMIN" || (userRole === "SOCIAL_MEDIA_SPECIALIST" && project.sms_owner_id === currentUserId);
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
            {hasFilters ? "Project tidak ditemukan" : "Belum ada project"}
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
            {hasFilters
              ? "Tidak ada project yang sesuai dengan filter pencarian yang diterapkan."
              : "Daftar project operasional agency akan muncul di sini."}
          </p>
          {canCreate && !hasFilters && (
            <div className="mt-4">
              <ProjectCreateDialog
                brands={brands}
                smsUsers={smsUsers}
                isAdmin={userRole === "ADMIN"}
                currentUserId={currentUserId}
                trigger={
                  <Button size="sm" className="gap-1.5">
                    <Plus className="size-4" />
                    <span>Buat Project Pertama</span>
                  </Button>
                }
              />
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-hidden rounded-lg border border-border bg-card shadow-2xs">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs border-collapse min-w-[1050px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                    <th className="py-2.5 px-4 font-medium w-[150px] min-w-[140px] whitespace-nowrap">Kode Project</th>
                    <th className="py-2.5 px-4 font-medium w-[300px] min-w-[260px]">Judul & Klien/Brand</th>
                    <th className="py-2.5 px-4 font-medium text-center w-[160px] min-w-[140px] whitespace-nowrap">Status</th>
                    <th className="py-2.5 px-4 font-medium text-center w-[120px] min-w-[100px] whitespace-nowrap">Prioritas</th>
                    <th className="py-2.5 px-4 font-medium w-[180px] min-w-[160px] whitespace-nowrap">Penanggung Jawab</th>
                    <th className="py-2.5 px-4 font-medium w-[150px] min-w-[140px] whitespace-nowrap">Batas Akhir</th>
                    <th className="py-2.5 px-4 font-medium text-center w-[80px] min-w-[80px] whitespace-nowrap">Tim</th>
                    <th className="py-2.5 px-4 font-medium text-right w-[100px] min-w-[100px] whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-border/60">
                {data.projects.map((project) => {
                  const canManage = isOwnerOrAdmin(project);

                  return (
                    <tr
                      key={project.id}
                      className="hover:bg-accent/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <Link
                          href={`/projects/${project.id}`}
                          className="font-mono text-[11px] font-semibold text-foreground hover:underline"
                        >
                          {project.project_code}
                        </Link>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-foreground">
                          <Link
                            href={`/projects/${project.id}`}
                            className="hover:underline flex items-center gap-1.5"
                          >
                            <span className="truncate">{project.name}</span>
                            <ExternalLink className="size-3 text-muted-foreground shrink-0" />
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
                      <td className="py-3 px-4 text-center">
                        <ProjectStatusBadge status={project.status} />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <ProjectPriorityBadge priority={project.priority} />
                      </td>
                      <td className="py-3 px-4 text-muted-foreground font-medium">
                        {project.sms_owner.full_name}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-[11px]">
                        {new Date(project.deadline).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                          <Users className="size-3" />
                          <span>{project.members_count}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            nativeButton={false}
                            variant="ghost"
                            size="icon-sm"
                            render={<Link href={`/projects/${project.id}`} />}
                            aria-label={`Detail ${project.name}`}
                          >
                            <ExternalLink className="size-3.5 text-muted-foreground hover:text-foreground" />
                          </Button>
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setArchivingProject(project)}
                              aria-label={`Arsipkan ${project.name}`}
                              className="text-destructive/70 hover:text-destructive"
                            >
                              <Archive className="size-3.5" />
                            </Button>
                          )}
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
              const canManage = isOwnerOrAdmin(project);

              return (
                <div
                  key={project.id}
                  className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[10px] font-semibold text-muted-foreground block mb-0.5">
                        {project.project_code}
                      </span>
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-semibold text-sm text-foreground hover:underline flex items-center gap-1.5"
                      >
                        <span>{project.name}</span>
                        <ExternalLink className="size-3.5 text-muted-foreground shrink-0" />
                      </Link>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        <span>{project.brand.client.name}</span>
                        <span className="mx-1">•</span>
                        <span className="font-medium text-foreground">
                          {project.brand.name}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <ProjectStatusBadge status={project.status} />
                      <ProjectPriorityBadge priority={project.priority} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs border-t border-border/60 pt-2 text-muted-foreground">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 block">
                        Penanggung Jawab
                      </span>
                      <span className="truncate block font-medium text-foreground">
                        {project.sms_owner.full_name}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 block">
                        Batas Akhir
                      </span>
                      <div className="flex items-center gap-1 font-medium text-foreground">
                        <Calendar className="size-3 text-muted-foreground" />
                        <span>
                          {new Date(project.deadline).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/60 pt-2">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="size-3.5" />
                      <span>{project.members_count} Anggota Tim</span>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <Button
                        nativeButton={false}
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        render={<Link href={`/projects/${project.id}`} />}
                      >
                        <span>Buka Detail</span>
                      </Button>
                      {canManage && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setArchivingProject(project)}
                          className="text-xs h-8 text-destructive border-destructive/20 hover:bg-destructive/10"
                        >
                          <Archive className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
              <span>
                Menampilkan Halaman {data.currentPage} dari {data.totalPages} ({data.totalCount} project)
              </span>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.currentPage <= 1}
                  onClick={() => goToPage(data.currentPage - 1)}
                  className="gap-1 text-xs h-8"
                >
                  <ChevronLeft className="size-3.5" />
                  <span>Sebelumnya</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.currentPage >= data.totalPages}
                  onClick={() => goToPage(data.currentPage + 1)}
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

      {/* Archive Dialog */}
      <ProjectArchiveDialog
        open={Boolean(archivingProject)}
        onOpenChange={(open) => {
          if (!open) setArchivingProject(null);
        }}
        project={archivingProject}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
