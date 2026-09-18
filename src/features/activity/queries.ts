import { createClient } from "@/lib/supabase/server";
import {
  categorizeEventType,
  formatActivityTitle,
  formatActivityDescription,
} from "./helpers";
import type {
  ActivityFeedFilter,
  PaginatedActivityResponse,
  ActivityFilterOptions,
  ActivityLogItem,
} from "./types";

export async function getPaginatedActivityLogs(
  filter: ActivityFeedFilter
): Promise<PaginatedActivityResponse> {
  const supabase = await createClient();
  const page = Math.max(1, filter.page || 1);
  const pageSize = Math.max(1, Math.min(100, filter.pageSize || 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let countQuery = supabase
    .from("activity_logs")
    .select("id", { count: "exact", head: true });

  let dataQuery = supabase
    .from("activity_logs")
    .select(`
      id,
      project_id,
      user_id,
      event_type,
      metadata,
      created_at,
      project:project_id(id, name),
      actor:user_id(id, full_name)
    `)
    .order("created_at", { ascending: false })
    .range(from, to);

  // Apply project filter
  if (filter.projectId && filter.projectId !== "ALL") {
    countQuery = countQuery.eq("project_id", filter.projectId);
    dataQuery = dataQuery.eq("project_id", filter.projectId);
  }

  // Apply actor filter
  if (filter.actorId && filter.actorId !== "ALL") {
    countQuery = countQuery.eq("user_id", filter.actorId);
    dataQuery = dataQuery.eq("user_id", filter.actorId);
  }

  // Apply category filter
  if (filter.category && filter.category !== "ALL") {
    switch (filter.category) {
      case "PROJECT":
        countQuery = countQuery.ilike("event_type", "%project%");
        dataQuery = dataQuery.ilike("event_type", "%project%");
        break;
      case "TASK":
        countQuery = countQuery.ilike("event_type", "%task%");
        dataQuery = dataQuery.ilike("event_type", "%task%");
        break;
      case "DELIVERABLE":
        countQuery = countQuery.or("event_type.ilike.%file%,event_type.ilike.%deliverable%");
        dataQuery = dataQuery.or("event_type.ilike.%file%,event_type.ilike.%deliverable%");
        break;
      case "QC":
        countQuery = countQuery.or("event_type.ilike.%qc%,event_type.ilike.%revision%");
        dataQuery = dataQuery.or("event_type.ilike.%qc%,event_type.ilike.%revision%");
        break;
      case "CLIENT_REVIEW":
        countQuery = countQuery.or("event_type.ilike.%client%,event_type.ilike.%presentation%");
        dataQuery = dataQuery.or("event_type.ilike.%client%,event_type.ilike.%presentation%");
        break;
    }
  }

  const [{ count }, { data, error }] = await Promise.all([
    countQuery,
    dataQuery,
  ]);

  if (error || !data) {
    return {
      items: [],
      totalCount: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const items: ActivityLogItem[] = data.map((row) => {
    const proj = Array.isArray(row.project) ? row.project[0] : row.project;
    const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
    const { category, label: categoryLabel } = categorizeEventType(row.event_type);
    const meta = (row.metadata as Record<string, unknown>) || {};

    return {
      id: row.id,
      projectId: row.project_id,
      projectName: (proj as { name: string } | null)?.name || "Project Operasional",
      userId: row.user_id,
      actorName: (actor as { full_name: string } | null)?.full_name || "Sistem Otomatis",
      eventType: row.event_type,
      category,
      categoryLabel,
      humanTitle: formatActivityTitle(row.event_type),
      humanDescription: formatActivityDescription(row.event_type, meta),
      createdAt: row.created_at,
      metadata: meta,
    };
  });

  return {
    items,
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}

export async function getActivityFilterOptions(): Promise<ActivityFilterOptions> {
  const supabase = await createClient();

  const [{ data: projects }, { data: profiles }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name")
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
  ]);

  return {
    projects: (projects || []).map((p) => ({ id: p.id, name: p.name })),
    actors: (profiles || []).map((p) => ({ id: p.id, fullName: p.full_name })),
  };
}
