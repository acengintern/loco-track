import * as React from "react";
import { requireRole } from "@/lib/supabase/auth";
import { ROUTE_PERMISSIONS } from "@/constants/navigation";
import { PageHeader } from "@/components/layout/page-header";
import {
  getPaginatedActivityLogs,
  getActivityFilterOptions,
} from "@/features/activity/queries";
import { ActivityFilterBar } from "@/features/activity/components/activity-filter-bar";
import { ActivityTable } from "@/features/activity/components/activity-table";
import { ActivityPagination } from "@/features/activity/components/activity-pagination";
import type { ActivityCategory } from "@/features/activity/types";

interface ActivityPageProps {
  searchParams: Promise<{
    project?: string;
    actor?: string;
    category?: string;
    page?: string;
  }>;
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  await requireRole(ROUTE_PERMISSIONS["/activity"]);

  const params = await searchParams;
  const page = parseInt(params.page || "1", 10) || 1;
  const projectId = params.project || undefined;
  const actorId = params.actor || undefined;
  const category = (params.category as ActivityCategory) || undefined;

  const [filterOptions, activityData] = await Promise.all([
    getActivityFilterOptions(),
    getPaginatedActivityLogs({
      page,
      pageSize: 25,
      projectId,
      actorId,
      category,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Log Aktivitas"
        description="Riwayat perubahan alur kerja dan pencatatan audit operasional sistem."
      />

      <ActivityFilterBar options={filterOptions} />

      <ActivityTable items={activityData.items} />

      <ActivityPagination
        page={activityData.page}
        totalPages={activityData.totalPages}
        totalCount={activityData.totalCount}
      />
    </div>
  );
}
