import * as React from "react";
import Link from "next/link";
import { Plus, Eye } from "lucide-react";
import { requireActiveProfile } from "@/lib/supabase/auth";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectSubnav } from "@/components/layout/project-subnav";
import {
  getProjects,
  getCreativeProjects,
  getActiveBrandsForProjectSelection,
} from "@/features/projects/queries";
import { ProjectFilters } from "@/features/projects/components/project-filters";
import { ProjectList } from "@/features/projects/components/project-list";
import { CreativeProjectList } from "@/features/projects/components/creative-project-list";
import { Button } from "@/components/ui/button";
import type { ProjectPhase, PriorityLevel } from "@/types/database";

interface ProjectsPageProps {
  searchParams: Promise<{
    q?: string;
    status?: ProjectPhase;
    priority?: PriorityLevel;
    brandId?: string;
    smsOwnerId?: string;
    page?: string;
    view?: string;
  }>;
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const profile = await requireActiveProfile();
  const params = await searchParams;

  const isCreativeRole =
    profile.role === "GRAPHIC_DESIGNER" || profile.role === "VIDEO_EDITOR";
  const isCreativePreview = profile.role === "ADMIN" && params.view === "creative";
  const isCreative = isCreativeRole || isCreativePreview;

  const pageNum = params.page ? parseInt(params.page, 10) : 1;
  const validPageNum = isNaN(pageNum) ? 1 : pageNum;

  const [paginatedData, creativeData, brands] = await Promise.all([
    !isCreative
      ? getProjects({
          search: params.q,
          status: params.status,
          priority: params.priority,
          brandId: params.brandId,
          smsOwnerId: params.smsOwnerId,
          page: validPageNum,
          pageSize: 15,
        })
      : Promise.resolve(null),
    isCreative
      ? getCreativeProjects({
          userId: profile.id,
          search: params.q,
          status: params.status,
          priority: params.priority,
          brandId: params.brandId,
          page: validPageNum,
          pageSize: 15,
          isAdminPreview: isCreativePreview,
        })
      : Promise.resolve(null),
    getActiveBrandsForProjectSelection(),
  ]);

  const canCreate =
    (profile.role === "ADMIN" || profile.role === "SOCIAL_MEDIA_SPECIALIST") &&
    !isCreative;
  const hasFilters = Boolean(
    params.q || params.status || params.priority || params.brandId || params.smsOwnerId
  );

  return (
    <div className="space-y-6">
      {!isCreative && <ProjectSubnav current="projects" role={profile.role} />}

      <PageHeader
        title={isCreative ? "Project Terkait Saya" : "Direktori Project"}
        description={
          isCreative
            ? "Daftar project operasional yang menugaskan Anda dalam pengerjaan dan produksi kreatif."
            : "Pantau seluruh alur kerja project operasional dan penugasan tim agency."
        }
      >
        <div className="flex items-center gap-2">
          {profile.role === "ADMIN" && (
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              render={
                <Link
                  href={
                    isCreativePreview
                      ? "/projects"
                      : "/projects?view=creative"
                  }
                />
              }
            >
              <Eye className="size-3.5" />
              <span>{isCreativePreview ? "Mode Admin" : "Mode Kreatif"}</span>
            </Button>
          )}

          {canCreate && (
            <Button
              nativeButton={false}
              size="sm"
              className="gap-1.5 shrink-0"
              render={<Link href="/projects/new" />}
            >
              <Plus className="size-4" />
              <span>Buat Project</span>
            </Button>
          )}
        </div>
      </PageHeader>

      <ProjectFilters
        currentSearch={params.q}
        currentStatus={params.status}
        currentPriority={params.priority}
        currentBrandId={params.brandId}
        brands={brands}
      />

      {isCreative && creativeData ? (
        <CreativeProjectList
          data={creativeData}
          hasFilters={hasFilters}
        />
      ) : paginatedData ? (
        <ProjectList
          data={paginatedData}
          userRole={profile.role}
          currentUserId={profile.id}
          hasFilters={hasFilters}
        />
      ) : null}
    </div>
  );
}
