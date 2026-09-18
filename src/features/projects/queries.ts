import { createClient } from "@/lib/supabase/server";
import type {
  ProjectWithRelations,
  ProjectDetail,
  ProjectFilterParams,
  PaginatedProjects,
  CreativeProjectFilterParams,
  PaginatedCreativeProjects,
  CreativeProjectItem,
} from "./types";
import type { UserRole } from "@/types/database";

export async function getProjects(
  params?: ProjectFilterParams
): Promise<PaginatedProjects> {
  const supabase = await createClient();

  const page = Math.max(1, params?.page || 1);
  const pageSize = Math.max(1, Math.min(params?.pageSize || 10, 50));
  const offset = (page - 1) * pageSize;

  let countQuery = supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);

  let dataQuery = supabase
    .from("projects")
    .select(`
      id,
      project_code,
      brand_id,
      name,
      description,
      status,
      priority,
      start_date,
      sms_owner_id,
      deadline,
      script_not_required,
      published_at,
      published_by,
      publication_url,
      publish_note,
      created_by,
      created_at,
      updated_at,
      deleted_at,
      brands (
        id,
        name,
        code,
        clients (
          id,
          name
        )
      ),
      sms_owner:profiles!projects_sms_owner_id_fkey (
        id,
        full_name,
        email
      ),
      project_members (
        id
      )
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (params?.search && params.search.trim()) {
    const term = params.search.trim();
    countQuery = countQuery.or(`name.ilike.%${term}%,project_code.ilike.%${term}%`);
    dataQuery = dataQuery.or(`name.ilike.%${term}%,project_code.ilike.%${term}%`);
  }

  if (params?.status) {
    countQuery = countQuery.eq("status", params.status);
    dataQuery = dataQuery.eq("status", params.status);
  }

  if (params?.priority) {
    countQuery = countQuery.eq("priority", params.priority);
    dataQuery = dataQuery.eq("priority", params.priority);
  }

  if (params?.brandId) {
    countQuery = countQuery.eq("brand_id", params.brandId);
    dataQuery = dataQuery.eq("brand_id", params.brandId);
  }

  if (params?.smsOwnerId) {
    countQuery = countQuery.eq("sms_owner_id", params.smsOwnerId);
    dataQuery = dataQuery.eq("sms_owner_id", params.smsOwnerId);
  }

  const [{ count, error: countError }, { data, error: dataError }] =
    await Promise.all([countQuery, dataQuery]);

  if (countError || dataError) {
    console.error("Error fetching projects:", countError || dataError);
    return {
      projects: [],
      totalCount: 0,
      currentPage: page,
      totalPages: 0,
      pageSize,
    };
  }

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const projects: ProjectWithRelations[] = (data || []).map((row) => {
    const brandData = row.brands as unknown as {
      id: string;
      name: string;
      code: string;
      clients: { id: string; name: string } | null;
    } | null;

    const smsOwnerData = row.sms_owner as unknown as {
      id: string;
      full_name: string;
      email: string;
    } | null;

    const membersData = (row.project_members || []) as unknown as Array<{ id: string }>;

    return {
      id: row.id,
      project_code: row.project_code,
      brand_id: row.brand_id,
      name: row.name,
      description: row.description,
      status: row.status,
      priority: row.priority,
      start_date: row.start_date,
      sms_owner_id: row.sms_owner_id,
      deadline: row.deadline,
      script_not_required: row.script_not_required ?? false,
      published_at: row.published_at,
      published_by: row.published_by,
      publication_url: row.publication_url,
      publish_note: row.publish_note,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      brand: {
        id: brandData?.id || row.brand_id,
        name: brandData?.name || "Brand Tidak Diketahui",
        code: brandData?.code || "UNK",
        client: {
          id: brandData?.clients?.id || "",
          name: brandData?.clients?.name || "Client Tidak Diketahui",
        },
      },
      sms_owner: {
        id: smsOwnerData?.id || row.sms_owner_id,
        full_name: smsOwnerData?.full_name || "SMS Belum Ditugaskan",
        email: smsOwnerData?.email || "",
      },
      members_count: membersData.length,
    };
  });

  return {
    projects,
    totalCount,
    currentPage: page,
    totalPages,
    pageSize,
  };
}

export async function getProjectById(id: string): Promise<ProjectDetail | null> {
  const supabase = await createClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select(`
      id,
      project_code,
      brand_id,
      name,
      description,
      status,
      priority,
      start_date,
      sms_owner_id,
      deadline,
      script_not_required,
      published_at,
      published_by,
      publication_url,
      publish_note,
      created_by,
      created_at,
      updated_at,
      deleted_at,
      brands (
        id,
        name,
        code,
        clients (
          id,
          name
        )
      ),
      sms_owner:profiles!projects_sms_owner_id_fkey (
        id,
        full_name,
        email,
        avatar_url
      )
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !project) {
    return null;
  }

  // Fetch members with profiles
  const { data: membersData } = await supabase
    .from("project_members")
    .select(`
      id,
      project_id,
      user_id,
      created_at,
      profiles (
        id,
        full_name,
        email,
        role,
        avatar_url
      )
    `)
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  // Fetch activity logs
  const { data: activitiesData } = await supabase
    .from("activity_logs")
    .select(`
      id,
      project_id,
      event_type,
      metadata,
      created_at,
      profiles (
        id,
        full_name,
        email,
        role
      )
    `)
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(30);

  const brandData = project.brands as unknown as {
    id: string;
    name: string;
    code: string;
    clients: { id: string; name: string } | null;
  } | null;

  const smsOwnerData = project.sms_owner as unknown as {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;

  const members = (membersData || []).map((m) => {
    const prof = m.profiles as unknown as {
      id: string;
      full_name: string;
      email: string;
      role: UserRole;
      avatar_url: string | null;
    } | null;

    return {
      id: m.id,
      project_id: m.project_id,
      user_id: m.user_id,
      created_at: m.created_at,
      user: {
        id: prof?.id || m.user_id,
        full_name: prof?.full_name || "Pengguna",
        email: prof?.email || "",
        role: prof?.role || ("GRAPHIC_DESIGNER" as UserRole),
        avatar_url: prof?.avatar_url || null,
      },
    };
  });

  // Collect any referenced user IDs in activities metadata that lack a name
  const missingUserIds = new Set<string>();
  for (const a of activitiesData || []) {
    const meta = (a.metadata || {}) as Record<string, unknown>;
    for (const key of [
      "assignee_id",
      "new_assignee_id",
      "previous_assignee_id",
      "assigned_to",
      "user_id",
    ]) {
      const val = meta[key];
      if (typeof val === "string" && val.length === 36) {
        missingUserIds.add(val);
      }
    }
  }

  const resolvedUserMap: Record<string, string> = {};
  for (const m of members) {
    resolvedUserMap[m.user_id] = m.user.full_name;
  }
  if (smsOwnerData) {
    resolvedUserMap[smsOwnerData.id] = smsOwnerData.full_name;
  }
  const idsToQuery = Array.from(missingUserIds).filter(
    (uid) => !resolvedUserMap[uid]
  );
  if (idsToQuery.length > 0) {
    const { data: extraProfiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", idsToQuery);
    if (extraProfiles) {
      for (const p of extraProfiles) {
        resolvedUserMap[p.id] = p.full_name;
      }
    }
  }

  const activity_logs = (activitiesData || []).map((a) => {
    const prof = a.profiles as unknown as {
      id: string;
      full_name: string;
      email: string;
      role: UserRole;
    } | null;

    const meta = { ...((a.metadata || {}) as Record<string, unknown>) };
    if (
      meta.assignee_id &&
      typeof meta.assignee_id === "string" &&
      !meta.assignee_name &&
      resolvedUserMap[meta.assignee_id]
    ) {
      meta.assignee_name = resolvedUserMap[meta.assignee_id];
    }
    if (
      meta.new_assignee_id &&
      typeof meta.new_assignee_id === "string" &&
      !meta.new_assignee_name &&
      resolvedUserMap[meta.new_assignee_id]
    ) {
      meta.new_assignee_name = resolvedUserMap[meta.new_assignee_id];
    }
    if (
      meta.previous_assignee_id &&
      typeof meta.previous_assignee_id === "string" &&
      !meta.previous_assignee_name &&
      resolvedUserMap[meta.previous_assignee_id]
    ) {
      meta.previous_assignee_name = resolvedUserMap[meta.previous_assignee_id];
    }
    if (
      meta.user_id &&
      typeof meta.user_id === "string" &&
      !meta.full_name &&
      resolvedUserMap[meta.user_id]
    ) {
      meta.full_name = resolvedUserMap[meta.user_id];
    }

    return {
      id: a.id,
      project_id: a.project_id,
      event_type: a.event_type,
      metadata: meta,
      created_at: a.created_at,
      user: prof
        ? {
            id: prof.id,
            full_name: prof.full_name,
            email: prof.email,
            role: prof.role,
          }
        : null,
    };
  });

  return {
    id: project.id,
    project_code: project.project_code,
    brand_id: project.brand_id,
    name: project.name,
    description: project.description,
    status: project.status,
    priority: project.priority,
    start_date: project.start_date,
    sms_owner_id: project.sms_owner_id,
    deadline: project.deadline,
    script_not_required: project.script_not_required ?? false,
    published_at: project.published_at,
    published_by: project.published_by,
    publication_url: project.publication_url,
    publish_note: project.publish_note,
    created_by: project.created_by,
    created_at: project.created_at,
    updated_at: project.updated_at,
    deleted_at: project.deleted_at,
    brand: {
      id: brandData?.id || project.brand_id,
      name: brandData?.name || "Brand Tidak Diketahui",
      code: brandData?.code || "UNK",
      client: {
        id: brandData?.clients?.id || "",
        name: brandData?.clients?.name || "Client Tidak Diketahui",
      },
    },
    sms_owner: {
      id: smsOwnerData?.id || project.sms_owner_id,
      full_name: smsOwnerData?.full_name || "SMS Belum Ditugaskan",
      email: smsOwnerData?.email || "",
      avatar_url: smsOwnerData?.avatar_url || null,
    },
    members,
    activity_logs,
  };
}

export async function getActiveBrandsForProjectSelection(): Promise<
  Array<{
    id: string;
    name: string;
    code: string;
    client_name: string;
  }>
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("brands")
    .select(`
      id,
      name,
      code,
      clients (
        name
      )
    `)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching active brands for selection:", error);
    return [];
  }

  return (data || []).map((b) => {
    const clientData = b.clients as unknown as { name: string } | null;
    return {
      id: b.id,
      name: b.name,
      code: b.code,
      client_name: clientData?.name || "Client Tidak Diketahui",
    };
  });
}

export async function getActiveSMSUsersForSelection(): Promise<
  Array<{
    id: string;
    full_name: string;
    email: string;
    role: UserRole;
  }>
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("is_active", true)
    .eq("role", "SOCIAL_MEDIA_SPECIALIST")
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Error fetching SMS users for selection:", error);
    return [];
  }

  return data || [];
}

export async function getAvailableUsersForTeamRoster(
  projectId: string
): Promise<
  Array<{
    id: string;
    full_name: string;
    email: string;
    role: UserRole;
  }>
> {
  const supabase = await createClient();

  // Get current member user IDs
  const { data: currentMembers } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);

  const existingUserIds = (currentMembers || []).map((m) => m.user_id);

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (existingUserIds.length > 0) {
    query = query.not("id", "in", `(${existingUserIds.join(",")})`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching available users for team:", error);
    return [];
  }

  return data || [];
}

export async function getCreativeProjects(
  params: CreativeProjectFilterParams
): Promise<PaginatedCreativeProjects> {
  const supabase = await createClient();

  const page = Math.max(1, params.page || 1);
  const pageSize = Math.max(1, Math.min(params.pageSize || 15, 50));
  const offset = (page - 1) * pageSize;

  // 1. Gather all project IDs where user is member or has assigned tasks
  const [memberRes, taskRes, historyRes] = await Promise.all([
    supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", params.userId),
    supabase
      .from("tasks")
      .select("project_id")
      .eq("current_assignee_id", params.userId)
      .is("deleted_at", null),
    supabase
      .from("task_assignments")
      .select("task_id")
      .eq("assignee_id", params.userId),
  ]);

  const projectIdsSet = new Set<string>();

  if (memberRes.data) {
    for (const row of memberRes.data) {
      if (row.project_id) projectIdsSet.add(row.project_id);
    }
  }

  if (taskRes.data) {
    for (const row of taskRes.data) {
      if (row.project_id) projectIdsSet.add(row.project_id);
    }
  }

  if (historyRes.data && historyRes.data.length > 0) {
    const historyTaskIds = historyRes.data.map((r) => r.task_id);
    const { data: historyTasks } = await supabase
      .from("tasks")
      .select("project_id")
      .in("id", historyTaskIds);
    if (historyTasks) {
      for (const t of historyTasks) {
        if (t.project_id) projectIdsSet.add(t.project_id);
      }
    }
  }

  let projectIds = Array.from(projectIdsSet);

  // If Admin preview and admin has no personal assignments, fetch active projects so admin can preview the creative view
  if (params.isAdminPreview && projectIds.length === 0) {
    const { data: sampleProjects } = await supabase
      .from("projects")
      .select("id")
      .is("deleted_at", null)
      .limit(10);
    if (sampleProjects) {
      projectIds = sampleProjects.map((p) => p.id);
    }
  }

  // If still no projects found, return empty result
  if (projectIds.length === 0) {
    return {
      projects: [],
      totalCount: 0,
      currentPage: page,
      totalPages: 0,
      pageSize,
    };
  }

  // 2. Query projects
  let countQuery = supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .in("id", projectIds)
    .is("deleted_at", null);

  let dataQuery = supabase
    .from("projects")
    .select(`
      id,
      project_code,
      name,
      description,
      status,
      priority,
      deadline,
      brand:brands (
        id,
        name,
        code,
        client:clients (
          id,
          name
        )
      ),
      sms_owner:profiles!projects_sms_owner_id_fkey (
        id,
        full_name,
        email
      )
    `)
    .in("id", projectIds)
    .is("deleted_at", null)
    .order("deadline", { ascending: true })
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (params.search && params.search.trim()) {
    const term = params.search.trim();
    countQuery = countQuery.or(`name.ilike.%${term}%,project_code.ilike.%${term}%`);
    dataQuery = dataQuery.or(`name.ilike.%${term}%,project_code.ilike.%${term}%`);
  }

  if (params.status) {
    countQuery = countQuery.eq("status", params.status);
    dataQuery = dataQuery.eq("status", params.status);
  }

  if (params.priority) {
    countQuery = countQuery.eq("priority", params.priority);
    dataQuery = dataQuery.eq("priority", params.priority);
  }

  if (params.brandId) {
    countQuery = countQuery.eq("brand_id", params.brandId);
    dataQuery = dataQuery.eq("brand_id", params.brandId);
  }

  const [{ count, error: countError }, { data, error: dataError }] =
    await Promise.all([countQuery, dataQuery]);

  if (countError || dataError) {
    console.error("Error fetching creative projects:", countError || dataError);
    return {
      projects: [],
      totalCount: 0,
      currentPage: page,
      totalPages: 0,
      pageSize,
    };
  }

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);
  const pageProjects = data || [];

  if (pageProjects.length === 0) {
    return {
      projects: [],
      totalCount,
      currentPage: page,
      totalPages,
      pageSize,
    };
  }

  // 3. Query all user tasks across these displayed projects in one query
  const pageProjectIds = pageProjects.map((p) => p.id);
  let tasksQuery = supabase
    .from("tasks")
    .select("id, project_id, status, deadline, priority")
    .in("project_id", pageProjectIds)
    .is("deleted_at", null);

  if (!params.isAdminPreview || projectIdsSet.size > 0) {
    tasksQuery = tasksQuery.eq("current_assignee_id", params.userId);
  }

  const { data: tasksData, error: tasksError } = await tasksQuery;

  if (tasksError) {
    console.error("Error fetching creative project tasks:", tasksError);
  }

  const allTasks = tasksData || [];

  // 4. Map into CreativeProjectItem format
  const projects: CreativeProjectItem[] = pageProjects.map((proj) => {
    const projTasks = allTasks.filter((t) => t.project_id === proj.id);
    const activeTasks = projTasks.filter((t) => t.status !== "COMPLETED");
    const activeDeadlines = activeTasks
      .map((t) => t.deadline)
      .filter((d): d is string => Boolean(d))
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    const brandData = proj.brand as unknown as {
      id: string;
      name: string;
      code: string;
      client: { id: string; name: string } | null;
    } | null;

    const smsOwnerData = proj.sms_owner as unknown as {
      id: string;
      full_name: string;
      email: string;
    } | null;

    return {
      id: proj.id,
      project_code: proj.project_code,
      name: proj.name,
      description: proj.description,
      status: proj.status,
      priority: proj.priority,
      deadline: proj.deadline,
      brand: {
        id: brandData?.id || "",
        name: brandData?.name || "Brand Tidak Diketahui",
        code: brandData?.code || "",
        client: {
          id: brandData?.client?.id || "",
          name: brandData?.client?.name || "Client Tidak Diketahui",
        },
      },
      sms_owner: {
        id: smsOwnerData?.id || "",
        full_name: smsOwnerData?.full_name || "Belum Ditentukan",
        email: smsOwnerData?.email || "",
      },
      myTasksCount: projTasks.length,
      myActiveTasksCount: activeTasks.length,
      myNearestDeadline: activeDeadlines[0] || null,
      hasActiveRevision: projTasks.some((t) => t.status === "REVISION_REQUESTED"),
      statusSummary: {
        todo: projTasks.filter((t) => t.status === "TODO").length,
        in_progress: projTasks.filter((t) => t.status === "IN_PROGRESS").length,
        in_review: projTasks.filter((t) => t.status === "IN_REVIEW").length,
        revision_requested: projTasks.filter((t) => t.status === "REVISION_REQUESTED").length,
        approved: projTasks.filter((t) => t.status === "APPROVED").length,
        completed: projTasks.filter((t) => t.status === "COMPLETED").length,
      },
    };
  });

  return {
    projects,
    totalCount,
    currentPage: page,
    totalPages,
    pageSize,
  };
}

