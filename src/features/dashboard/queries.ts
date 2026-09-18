import { createClient } from "@/lib/supabase/server";
import type {
  AdminDashboardData,
  CreativeDirectorDashboardData,
  AccountExecutiveDashboardData,
  SmsDashboardData,
  CreativeDashboardData,
} from "./types";

// Date helpers for central deadline calculations
function getTodayIsoDate(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString().split("T")[0];
}

function getSevenDaysAheadIsoDate(): string {
  const future = new Date();
  future.setHours(23, 59, 59, 999);
  future.setDate(future.getDate() + 7);
  return future.toISOString().split("T")[0];
}

export function isDeadlineOverdue(deadline: string): boolean {
  if (!deadline) return false;
  const deadlineDate = deadline.split("T")[0];
  return deadlineDate < getTodayIsoDate();
}

export function isDeadlineDueSoon(deadline: string): boolean {
  if (!deadline) return false;
  const deadlineDate = deadline.split("T")[0];
  const today = getTodayIsoDate();
  const nextWeek = getSevenDaysAheadIsoDate();
  return deadlineDate >= today && deadlineDate <= nextWeek;
}

// ------------------------------------------------------------------------------
// 1. ADMIN DASHBOARD QUERIES (Governance)
// ------------------------------------------------------------------------------
export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const supabase = await createClient();
  const today = getTodayIsoDate();

  // 1. Active Projects Count
  const { count: activeProjectsCount } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .not("status", "in", '("PUBLISHED","DONE","CANCELLED")');

  // 2. Overdue Projects Count
  const { count: overdueProjectsCount } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .not("status", "in", '("PUBLISHED","DONE","CANCELLED")')
    .lt("deadline", today);

  // 3. Active Users Count
  const { count: activeUsersCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  // 4. Published Projects Count
  const { count: publishedProjectsCount } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("status", "PUBLISHED");

  // 5. Workflow Distribution across all projects
  const { data: statusRows } = await supabase
    .from("projects")
    .select("status")
    .is("deleted_at", null);

  const statusMap: Record<string, number> = {};
  (statusRows || []).forEach((row) => {
    statusMap[row.status] = (statusMap[row.status] || 0) + 1;
  });

  const orderedStatuses = [
    { status: "BRIEF_RECEIVED", label: "Brief Diterima" },
    { status: "CONTENT_PLANNING", label: "Perencanaan Konten" },
    { status: "SCRIPT_READY", label: "Naskah Siap" },
    { status: "PRODUCTION", label: "Produksi Berjalan" },
    { status: "INTERNAL_QC", label: "QC Internal" },
    { status: "CLIENT_REVIEW", label: "Review Klien" },
    { status: "APPROVED", label: "Disetujui" },
    { status: "PUBLISHED", label: "Dipublikasikan" },
  ];

  const workflowDistribution = orderedStatuses.map((item) => ({
    status: item.status,
    label: item.label,
    count: statusMap[item.status] || 0,
  }));

  // 6. Recent Activity Log (10 items)
  const { data: recentActivityRows } = await supabase
    .from("activity_logs")
    .select(`
      id,
      event_type,
      created_at,
      metadata,
      project:project_id(name),
      actor:user_id(full_name)
    `)
    .order("created_at", { ascending: false })
    .limit(10);

  const recentActivity = (recentActivityRows || []).map((row) => {
    const proj = Array.isArray(row.project) ? row.project[0] : row.project;
    const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
    return {
      id: row.id,
      eventType: row.event_type,
      projectName: (proj as { name: string } | null)?.name || "Project Operasional",
      actorName: (actor as { full_name: string } | null)?.full_name || "Sistem",
      createdAt: row.created_at,
      metadata: (row.metadata as Record<string, unknown>) || {},
    };
  });

  return {
    activeProjectsCount: activeProjectsCount || 0,
    overdueProjectsCount: overdueProjectsCount || 0,
    activeUsersCount: activeUsersCount || 0,
    publishedProjectsCount: publishedProjectsCount || 0,
    workflowDistribution,
    recentActivity,
  };
}

// ------------------------------------------------------------------------------
// 2. CREATIVE DIRECTOR DASHBOARD QUERIES (Governance & QC Oversight)
// ------------------------------------------------------------------------------
export async function getCreativeDirectorDashboardData(): Promise<CreativeDirectorDashboardData> {
  const supabase = await createClient();
  const today = getTodayIsoDate();
  const nextWeek = getSevenDaysAheadIsoDate();

  // 1. Tasks Waiting QC (IN_REVIEW)
  const { count: tasksWaitingQcCount } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("status", "IN_REVIEW");

  // 2. Tasks in Revision (REVISION_REQUESTED)
  const { count: tasksInRevisionCount } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("status", "REVISION_REQUESTED");

  // 3. Projects in INTERNAL_QC
  const { count: projectsInQcCount } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("status", "INTERNAL_QC");

  // 4. Upcoming Deadlines Count (projects active due within 7 days)
  const { count: upcomingDeadlinesCount } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .not("status", "in", '("PUBLISHED","DONE","CANCELLED")')
    .gte("deadline", today)
    .lte("deadline", nextWeek);

  // 5. QC Queue (Tasks currently in IN_REVIEW)
  const { data: qcRows } = await supabase
    .from("tasks")
    .select(`
      id,
      title,
      deadline,
      project:project_id(id, name),
      assignee:current_assignee_id(full_name),
      files:project_files(version, deleted_at)
    `)
    .is("deleted_at", null)
    .eq("status", "IN_REVIEW")
    .order("deadline", { ascending: true })
    .limit(10);

  const qcQueue = (qcRows || []).map((row) => {
    const proj = Array.isArray(row.project) ? row.project[0] : row.project;
    const assignee = Array.isArray(row.assignee) ? row.assignee[0] : row.assignee;
    const activeFiles = (row.files || []).filter((f: { deleted_at: string | null }) => f.deleted_at === null);
    const maxVersion = activeFiles.reduce((max: number, f: { version: number }) => Math.max(max, f.version), 1);

    return {
      taskId: row.id,
      taskTitle: row.title,
      projectId: (proj as { id: string } | null)?.id || "",
      projectName: (proj as { name: string } | null)?.name || "",
      assigneeName: (assignee as { full_name: string } | null)?.full_name || "Belum ditugaskan",
      deadline: row.deadline,
      version: maxVersion,
    };
  });

  // 6. Revision Queue (Tasks currently in REVISION_REQUESTED)
  const { data: revRows } = await supabase
    .from("tasks")
    .select(`
      id,
      title,
      project:project_id(id, name),
      assignee:current_assignee_id(full_name),
      revision_requests(notes, round_number, status)
    `)
    .is("deleted_at", null)
    .eq("status", "REVISION_REQUESTED")
    .limit(10);

  const revisionQueue = (revRows || []).map((row) => {
    const proj = Array.isArray(row.project) ? row.project[0] : row.project;
    const assignee = Array.isArray(row.assignee) ? row.assignee[0] : row.assignee;
    const openRev = (row.revision_requests || []).find(
      (r: { status: string }) => r.status === "OPEN" || r.status === "IN_PROGRESS"
    );

    return {
      taskId: row.id,
      taskTitle: row.title,
      projectId: (proj as { id: string } | null)?.id || "",
      projectName: (proj as { name: string } | null)?.name || "",
      assigneeName: (assignee as { full_name: string } | null)?.full_name || "Belum ditugaskan",
      notes: openRev?.notes || "Revisi sedang dikerjakan",
      roundNumber: openRev?.round_number || 1,
    };
  });

  // 7. Creative Workload Summary (Active Creatives)
  const { data: creativeProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["GRAPHIC_DESIGNER", "VIDEO_EDITOR"])
    .eq("is_active", true);

  const { data: activeTasks } = await supabase
    .from("tasks")
    .select("id, current_assignee_id, status")
    .is("deleted_at", null)
    .not("status", "in", '("APPROVED","COMPLETED")');

  const creativeWorkloadSummary = (creativeProfiles || []).map((profile) => {
    const userTasks = (activeTasks || []).filter((t) => t.current_assignee_id === profile.id);
    const inReviewCount = userTasks.filter((t) => t.status === "IN_REVIEW").length;
    return {
      creativeId: profile.id,
      creativeName: profile.full_name,
      role: profile.role === "GRAPHIC_DESIGNER" ? "Graphic Designer" : "Video Editor",
      activeTasksCount: userTasks.length,
      inReviewCount,
    };
  });

  return {
    tasksWaitingQcCount: tasksWaitingQcCount || 0,
    tasksInRevisionCount: tasksInRevisionCount || 0,
    projectsInQcCount: projectsInQcCount || 0,
    upcomingDeadlinesCount: upcomingDeadlinesCount || 0,
    qcQueue,
    revisionQueue,
    creativeWorkloadSummary,
  };
}

// ------------------------------------------------------------------------------
// 3. ACCOUNT EXECUTIVE DASHBOARD QUERIES (Global Monitoring)
// ------------------------------------------------------------------------------
export async function getAccountExecutiveDashboardData(): Promise<AccountExecutiveDashboardData> {
  const supabase = await createClient();
  const today = getTodayIsoDate();

  // 1. Active Projects Count
  const { count: activeProjectsCount } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .not("status", "in", '("PUBLISHED","DONE","CANCELLED")');

  // 2. Client Review Projects Count
  const { count: clientReviewProjectsCount } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("status", "CLIENT_REVIEW");

  // 3. Overdue Projects Count
  const { count: overdueProjectsCount } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .not("status", "in", '("PUBLISHED","DONE","CANCELLED")')
    .lt("deadline", today);

  // 4. Published Projects Count
  const { count: publishedProjectsCount } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("status", "PUBLISHED");

  // 5. Projects in Client Review List
  const { data: crRows } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      deadline,
      brand:brand_id(name),
      sms_owner:sms_owner_id(full_name),
      client_reviews(round_number, overall_verdict)
    `)
    .is("deleted_at", null)
    .eq("status", "CLIENT_REVIEW")
    .order("deadline", { ascending: true })
    .limit(8);

  const clientReviewProjects = (crRows || []).map((row) => {
    const brand = Array.isArray(row.brand) ? row.brand[0] : row.brand;
    const sms = Array.isArray(row.sms_owner) ? row.sms_owner[0] : row.sms_owner;
    const activeRound = (row.client_reviews || []).find(
      (cr: { overall_verdict: string }) => cr.overall_verdict === "PENDING"
    );

    return {
      projectId: row.id,
      projectName: row.name,
      brandName: (brand as { name: string } | null)?.name || "Klien",
      roundNumber: activeRound?.round_number || 1,
      deadline: row.deadline,
      smsOwnerName: (sms as { full_name: string } | null)?.full_name || "Belum ditugaskan",
    };
  });

  // 6. Upcoming Deadlines List (active projects ordered by deadline)
  const { data: deadlineRows } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      status,
      deadline,
      brand:brand_id(name)
    `)
    .is("deleted_at", null)
    .not("status", "in", '("PUBLISHED","DONE","CANCELLED")')
    .order("deadline", { ascending: true })
    .limit(8);

  const upcomingDeadlines = (deadlineRows || []).map((row) => {
    const brand = Array.isArray(row.brand) ? row.brand[0] : row.brand;
    return {
      projectId: row.id,
      projectName: row.name,
      brandName: (brand as { name: string } | null)?.name || "Klien",
      status: row.status,
      deadline: row.deadline,
      isOverdue: isDeadlineOverdue(row.deadline),
    };
  });

  return {
    activeProjectsCount: activeProjectsCount || 0,
    clientReviewProjectsCount: clientReviewProjectsCount || 0,
    overdueProjectsCount: overdueProjectsCount || 0,
    publishedProjectsCount: publishedProjectsCount || 0,
    clientReviewProjects,
    upcomingDeadlines,
  };
}

// ------------------------------------------------------------------------------
// 4. SOCIAL MEDIA SPECIALIST DASHBOARD QUERIES (Project Ownership & Publishing)
// ------------------------------------------------------------------------------
export async function getSmsDashboardData(smsUserId: string): Promise<SmsDashboardData> {
  const supabase = await createClient();
  const today = getTodayIsoDate();

  // 1. My Active Projects Count (Owned by caller)
  const { count: myActiveProjectsCount } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("sms_owner_id", smsUserId)
    .is("deleted_at", null)
    .not("status", "in", '("PUBLISHED","DONE","CANCELLED")');

  // 2. Awaiting Client Projects Count
  const { count: awaitingClientProjectsCount } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("sms_owner_id", smsUserId)
    .is("deleted_at", null)
    .eq("status", "CLIENT_REVIEW");

  // 3. Ready to Publish Projects Count
  const { count: readyToPublishProjectsCount } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("sms_owner_id", smsUserId)
    .is("deleted_at", null)
    .eq("status", "APPROVED");

  // 4. Overdue Owned Projects Count
  const { count: overdueOwnedProjectsCount } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("sms_owner_id", smsUserId)
    .is("deleted_at", null)
    .not("status", "in", '("PUBLISHED","DONE","CANCELLED")')
    .lt("deadline", today);

  // 5. Ready for Client Presentation (INTERNAL_QC where all tasks are APPROVED)
  const { data: qcProjects } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      deadline,
      brand:brand_id(name),
      tasks(id, status, requires_qc)
    `)
    .eq("sms_owner_id", smsUserId)
    .is("deleted_at", null)
    .eq("status", "INTERNAL_QC");

  const readyForClient = (qcProjects || [])
    .filter((p) => {
      const qcTasks = (p.tasks || []).filter((t: { requires_qc: boolean }) => t.requires_qc);
      return qcTasks.length > 0 && qcTasks.every((t: { status: string }) => t.status === "APPROVED");
    })
    .map((p) => {
      const brand = Array.isArray(p.brand) ? p.brand[0] : p.brand;
      return {
        projectId: p.id,
        projectName: p.name,
        brandName: (brand as { name: string } | null)?.name || "",
        deadline: p.deadline,
      };
    });

  // 6. Ready to Publish List (status = APPROVED)
  const { data: pubRows } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      deadline,
      brand:brand_id(name)
    `)
    .eq("sms_owner_id", smsUserId)
    .is("deleted_at", null)
    .eq("status", "APPROVED");

  const readyToPublish = (pubRows || []).map((p) => {
    const brand = Array.isArray(p.brand) ? p.brand[0] : p.brand;
    return {
      projectId: p.id,
      projectName: p.name,
      brandName: (brand as { name: string } | null)?.name || "",
      deadline: p.deadline,
    };
  });

  // 7. Active Client Revisions on Owned Projects
  const { data: clientRevTasks } = await supabase
    .from("tasks")
    .select(`
      id,
      title,
      project:project_id(id, name, sms_owner_id),
      assignee:current_assignee_id(full_name),
      revision_requests!inner(notes, source, status)
    `)
    .is("deleted_at", null)
    .eq("revision_requests.source", "CLIENT")
    .in("revision_requests.status", ["OPEN", "IN_PROGRESS"]);

  const activeClientRevisions = (clientRevTasks || [])
    .filter((t) => {
      const proj = Array.isArray(t.project) ? t.project[0] : t.project;
      return (proj as { sms_owner_id: string } | null)?.sms_owner_id === smsUserId;
    })
    .map((t) => {
      const proj = Array.isArray(t.project) ? t.project[0] : t.project;
      const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee;
      const rev = t.revision_requests[0];
      return {
        taskId: t.id,
        taskTitle: t.title,
        projectId: (proj as { id: string } | null)?.id || "",
        projectName: (proj as { name: string } | null)?.name || "",
        creativeName: (assignee as { full_name: string } | null)?.full_name || "Belum ditugaskan",
        notes: rev?.notes || "Revisi dari client sedang berlangsung",
      };
    });

  // 8. Owned Projects Table (Active)
  const { data: ownedRows } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      status,
      deadline,
      brand:brand_id(name)
    `)
    .eq("sms_owner_id", smsUserId)
    .is("deleted_at", null)
    .not("status", "in", '("PUBLISHED","DONE","CANCELLED")')
    .order("deadline", { ascending: true })
    .limit(10);

  const ownedProjects = (ownedRows || []).map((row) => {
    const brand = Array.isArray(row.brand) ? row.brand[0] : row.brand;
    return {
      projectId: row.id,
      projectName: row.name,
      brandName: (brand as { name: string } | null)?.name || "",
      status: row.status,
      deadline: row.deadline,
      isOverdue: isDeadlineOverdue(row.deadline),
    };
  });

  return {
    myActiveProjectsCount: myActiveProjectsCount || 0,
    awaitingClientProjectsCount: awaitingClientProjectsCount || 0,
    readyToPublishProjectsCount: readyToPublishProjectsCount || 0,
    overdueOwnedProjectsCount: overdueOwnedProjectsCount || 0,
    readyForClient,
    readyToPublish,
    activeClientRevisions,
    ownedProjects,
  };
}

// ------------------------------------------------------------------------------
// 5. GRAPHIC DESIGNER & VIDEO EDITOR DASHBOARD QUERIES (Task Execution)
// ------------------------------------------------------------------------------
export async function getCreativeDashboardData(creativeUserId: string): Promise<CreativeDashboardData> {
  const supabase = await createClient();
  const today = getTodayIsoDate();

  // 1. Fetch all active tasks assigned to the user
  const { data: activeTaskRows } = await supabase
    .from("tasks")
    .select(`
      id,
      title,
      status,
      priority,
      deadline,
      project:projects!inner (
        id,
        name,
        project_code,
        brand:brands (
          id,
          name,
          client:clients (
            id,
            name
          )
        )
      ),
      revision_requests (
        id,
        source,
        notes,
        status,
        created_at,
        round_number
      )
    `)
    .eq("current_assignee_id", creativeUserId)
    .is("deleted_at", null)
    .not("status", "in", '("APPROVED","COMPLETED")')
    .order("deadline", { ascending: true });

  const tasks = activeTaskRows || [];

  // 2. Total assigned tasks count ever (to distinguish Case A: never assigned vs Case B: all completed)
  const { count: totalCount } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("current_assignee_id", creativeUserId)
    .is("deleted_at", null);

  const totalAssignedTasksCount = totalCount || 0;

  // 3. Compute Metrics
  const myActiveTasksCount = tasks.length;
  const revisionRequestedCount = tasks.filter((t) => t.status === "REVISION_REQUESTED").length;
  const inReviewCount = tasks.filter((t) => t.status === "IN_REVIEW").length;

  let overdueCount = 0;
  let urgentOrOverdueCount = 0;

  for (const t of tasks) {
    if (t.deadline) {
      if (isDeadlineOverdue(t.deadline)) {
        overdueCount++;
        urgentOrOverdueCount++;
      } else if (isDeadlineDueSoon(t.deadline)) {
        urgentOrOverdueCount++;
      }
    }
  }

  // 4. Compute "Prioritas Saya Hari Ini" (Sorted by urgency)
  const getTaskPriorityRank = (t: (typeof tasks)[0]) => {
    if (t.status === "REVISION_REQUESTED") return 1;
    if (t.deadline && isDeadlineOverdue(t.deadline)) return 2;
    if (t.deadline && t.deadline.split("T")[0] === today) return 3;
    if (t.deadline && isDeadlineDueSoon(t.deadline)) return 4;
    if (t.status === "IN_PROGRESS") return 5;
    if (t.status === "TODO") return 6;
    return 7;
  };

  const sortedForPriority = [...tasks].sort((a, b) => {
    const rankA = getTaskPriorityRank(a);
    const rankB = getTaskPriorityRank(b);
    if (rankA !== rankB) return rankA - rankB;
    const deadA = a.deadline || "9999-12-31";
    const deadB = b.deadline || "9999-12-31";
    return deadA.localeCompare(deadB);
  });

  const priorityTasks = sortedForPriority.slice(0, 5).map((t) => {
    const proj = Array.isArray(t.project) ? t.project[0] : t.project;
    const activeRev = (t.revision_requests || []).find(
      (r: { status: string }) => r.status === "OPEN" || r.status === "IN_PROGRESS"
    );

    let ctaText: string | undefined;
    if (t.status === "TODO") ctaText = "Mulai Kerjakan";
    else if (t.status === "IN_PROGRESS") ctaText = "Lanjutkan";
    else if (t.status === "REVISION_REQUESTED") ctaText = "Kerjakan Revisi";

    const isToday = Boolean(t.deadline && t.deadline.split("T")[0] === today);
    const isOverdue = Boolean(t.deadline && isDeadlineOverdue(t.deadline));
    const isDueSoon = Boolean(t.deadline && isDeadlineDueSoon(t.deadline));

    const source = activeRev?.source as "INTERNAL_QC" | "CLIENT" | undefined;
    const sourceLabel =
      source === "CLIENT"
        ? ("Revisi dari Client" as const)
        : source === "INTERNAL_QC"
          ? ("Revisi Internal" as const)
          : null;

    return {
      taskId: t.id,
      taskTitle: t.title,
      projectId: (proj as { id: string } | null)?.id || "",
      projectName: (proj as { name: string } | null)?.name || "",
      status: t.status,
      priority: t.priority,
      deadline: t.deadline,
      isOverdue,
      isDueSoon,
      isToday,
      revisionSource: source || null,
      revisionSourceLabel: sourceLabel,
      ctaText,
      ctaHref: `/projects/${(proj as { id: string } | null)?.id}?tab=tasks`,
    };
  });

  // 5. Compute "Daftar Tugas Aktif Saya" (All active tasks, sorted by deadline)
  const activeTasks = tasks.map((t) => {
    const proj = Array.isArray(t.project) ? t.project[0] : t.project;
    return {
      taskId: t.id,
      taskTitle: t.title,
      projectId: (proj as { id: string } | null)?.id || "",
      projectName: (proj as { name: string } | null)?.name || "",
      status: t.status,
      priority: t.priority,
      deadline: t.deadline,
      isOverdue: isDeadlineOverdue(t.deadline),
      isDueSoon: isDeadlineDueSoon(t.deadline),
    };
  });

  // 6. Query "Feedback Terbaru" (Max 3-5 feedback items)
  const [revReqRes, qcRevRes] = await Promise.all([
    supabase
      .from("revision_requests")
      .select(`
        id,
        task_id,
        project_id,
        notes,
        source,
        round_number,
        created_at,
        tasks!revision_requests_task_id_fkey (
          id,
          title,
          projects (
            id,
            name
          )
        )
      `)
      .eq("assigned_to", creativeUserId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("qc_reviews")
      .select(`
        id,
        task_id,
        project_id,
        notes,
        result,
        round_number,
        created_at,
        project_files (
          version
        ),
        tasks!inner (
          id,
          title,
          current_assignee_id,
          projects (
            id,
            name
          )
        )
      `)
      .eq("tasks.current_assignee_id", creativeUserId)
      .not("notes", "is", null)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const rawFeedbacks: Array<{
    id: string;
    taskId: string;
    taskTitle: string;
    projectId: string;
    projectName: string;
    version: number | null;
    source: "INTERNAL_QC" | "CLIENT";
    sourceLabel: "Revisi Internal" | "Revisi dari Client";
    notes: string;
    createdAt: string;
  }> = [];

  if (revReqRes.data) {
    for (const r of revReqRes.data) {
      if (!r.notes || !r.notes.trim()) continue;
      const rawTask = r.tasks as unknown as {
        id: string;
        title: string;
        projects: { id: string; name: string } | null;
      } | null;
      const proj = rawTask?.projects;
      const source = (r.source as "INTERNAL_QC" | "CLIENT") || "INTERNAL_QC";

      rawFeedbacks.push({
        id: r.id,
        taskId: r.task_id,
        taskTitle: rawTask?.title || "Tugas",
        projectId: proj?.id || r.project_id || "",
        projectName: proj?.name || "Project",
        version: r.round_number || null,
        source,
        sourceLabel: source === "CLIENT" ? "Revisi dari Client" : "Revisi Internal",
        notes: r.notes.trim(),
        createdAt: r.created_at,
      });
    }
  }

  if (qcRevRes.data) {
    for (const q of qcRevRes.data) {
      if (!q.notes || !q.notes.trim()) continue;
      if (rawFeedbacks.some((f) => f.taskId === q.task_id && f.notes === q.notes.trim())) {
        continue;
      }
      const rawTask = q.tasks as unknown as {
        id: string;
        title: string;
        projects: { id: string; name: string } | null;
      } | null;
      const proj = rawTask?.projects;
      const fileData = q.project_files as unknown as { version: number } | null;

      rawFeedbacks.push({
        id: q.id,
        taskId: q.task_id,
        taskTitle: rawTask?.title || "Tugas",
        projectId: proj?.id || q.project_id || "",
        projectName: proj?.name || "Project",
        version: fileData?.version || q.round_number || null,
        source: "INTERNAL_QC",
        sourceLabel: "Revisi Internal",
        notes: q.notes.trim(),
        createdAt: q.created_at,
      });
    }
  }

  const recentFeedbacks = rawFeedbacks
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  // 7. Query "Project Saya" (3-5 active projects relevant to creative)
  const { data: memberRows } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", creativeUserId);

  const myProjectIdsSet = new Set<string>();
  if (memberRows) {
    for (const m of memberRows) {
      if (m.project_id) myProjectIdsSet.add(m.project_id);
    }
  }
  for (const t of tasks) {
    const p = Array.isArray(t.project) ? t.project[0] : t.project;
    if (p?.id) myProjectIdsSet.add(p.id);
  }

  let myProjects: CreativeDashboardData["myProjects"] = [];

  if (myProjectIdsSet.size > 0) {
    const { data: projectRows } = await supabase
      .from("projects")
      .select(`
        id,
        project_code,
        name,
        deadline,
        status,
        brand:brands (
          id,
          name,
          client:clients (
            id,
            name
          )
        )
      `)
      .in("id", Array.from(myProjectIdsSet))
      .is("deleted_at", null)
      .not("status", "in", '("PUBLISHED","DONE","CANCELLED")')
      .order("deadline", { ascending: true })
      .limit(4);

    if (projectRows) {
      myProjects = projectRows.map((p) => {
        const brandData = p.brand as unknown as {
          id: string;
          name: string;
          client: { id: string; name: string } | null;
        } | null;

        const projTasks = tasks.filter((t) => {
          const tp = Array.isArray(t.project) ? t.project[0] : t.project;
          return tp?.id === p.id;
        });

        const activeCount = projTasks.length;
        const revCount = projTasks.filter((t) => t.status === "REVISION_REQUESTED").length;
        const taskDeadlines = projTasks
          .map((t) => t.deadline)
          .filter(Boolean)
          .sort();

        return {
          id: p.id,
          projectCode: p.project_code,
          name: p.name,
          clientName: brandData?.client?.name || "Klien",
          brandName: brandData?.name || "Brand",
          myActiveTasksCount: activeCount,
          myNearestDeadline: taskDeadlines[0] || p.deadline,
          hasActiveRevision: revCount > 0,
          revisionCount: revCount,
        };
      });
    }
  }

  // 8. Recent completed tasks (for useful empty dashboard state if active tasks = 0)
  const { data: completedRows } = await supabase
    .from("tasks")
    .select(`
      id,
      title,
      updated_at,
      project:projects!inner (
        id,
        name
      )
    `)
    .eq("current_assignee_id", creativeUserId)
    .eq("status", "COMPLETED")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(3);

  const recentCompletedTasks = (completedRows || []).map((r) => {
    const proj = Array.isArray(r.project) ? r.project[0] : r.project;
    return {
      taskId: r.id,
      taskTitle: r.title,
      projectId: (proj as { id: string } | null)?.id || "",
      projectName: (proj as { name: string } | null)?.name || "",
      completedAt: r.updated_at,
    };
  });

  return {
    myActiveTasksCount,
    revisionRequestedCount,
    urgentOrOverdueCount,
    overdueCount,
    inReviewCount,
    totalAssignedTasksCount,
    priorityTasks,
    recentFeedbacks,
    myProjects,
    activeTasks,
    recentCompletedTasks,
  };
}
