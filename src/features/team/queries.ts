import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isDeadlineOverdue, isDeadlineDueSoon } from "@/features/dashboard/queries";
import type {
  TeamWorkloadData,
  CreativeWorkloadMember,
  CreativeTaskSummary,
  UrgentTaskItem,
  TeamStatusDistribution,
  TeamDeadlineRisk,
} from "./types";

interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  role: "GRAPHIC_DESIGNER" | "VIDEO_EDITOR";
  avatar_url: string | null;
}

interface TaskProjectRow {
  id: string;
  name: string;
  status: string;
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
  deadline: string | null;
  current_assignee_id: string;
  project: TaskProjectRow | TaskProjectRow[] | null;
}

/**
 * Calculates calendar day difference between target date and today in local time.
 * Returns null if deadline is not provided or invalid.
 */
function getDeadlineDiffDays(deadline: string | null): number | null {
  if (!deadline) return null;
  const datePart = deadline.split("T")[0];
  const parts = datePart.split("-");
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const target = new Date(year, month, day);
  if (isNaN(target.getTime())) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export async function getTeamWorkloadData(customClient?: SupabaseClient): Promise<TeamWorkloadData> {
  const supabase = customClient ?? (await createClient());

  // 1. Fetch active creative members
  const { data: rawProfiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, avatar_url")
    .in("role", ["GRAPHIC_DESIGNER", "VIDEO_EDITOR"])
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (profileError || !rawProfiles) {
    return {
      members: [],
      totalActiveCreatives: 0,
      totalActiveTasks: 0,
      totalDueSoonTasks: 0,
      totalOverdueTasks: 0,
      statusDistribution: { todo: 0, inProgress: 0, revision: 0, inReview: 0, total: 0 },
      deadlineRisk: { overdue: 0, dueSoon: 0, safe: 0, noDeadline: 0, total: 0 },
      nearestDeadlines: [],
    };
  }

  const profiles = rawProfiles as ProfileRow[];

  // 2. Fetch all active tasks assigned to creatives
  const { data: rawTasksData, error: taskError } = await supabase
    .from("tasks")
    .select(`
      id,
      title,
      status,
      deadline,
      current_assignee_id,
      project:project_id(id, name, status)
    `)
    .is("deleted_at", null)
    .not("status", "in", '("APPROVED","COMPLETED")')
    .order("deadline", { ascending: true });

  // Fallback if error or no tasks
  if (taskError || !rawTasksData) {
    const members: CreativeWorkloadMember[] = profiles.map((p) => ({
      id: p.id,
      fullName: p.full_name,
      email: p.email,
      role: p.role,
      avatarUrl: p.avatar_url,
      totalActiveTasks: 0,
      todoCount: 0,
      inProgressCount: 0,
      revisionCount: 0,
      inReviewCount: 0,
      dueSoonCount: 0,
      overdueCount: 0,
      tasks: [],
    }));

    return {
      members,
      totalActiveCreatives: members.length,
      totalActiveTasks: 0,
      totalDueSoonTasks: 0,
      totalOverdueTasks: 0,
      statusDistribution: { todo: 0, inProgress: 0, revision: 0, inReview: 0, total: 0 },
      deadlineRisk: { overdue: 0, dueSoon: 0, safe: 0, noDeadline: 0, total: 0 },
      nearestDeadlines: [],
    };
  }

  const rawTasks = rawTasksData as unknown as TaskRow[];

  const creativeProfileIds = new Set(profiles.map((p) => p.id));

  // Filter tasks to strictly exclude PUBLISHED and CANCELLED projects,
  // and strictly restrict to active creative personnel
  const activeTasks = rawTasks.filter((t: TaskRow) => {
    const proj = Array.isArray(t.project) ? t.project[0] : t.project;
    if (!proj) return false;
    if (proj.status === "PUBLISHED" || proj.status === "CANCELLED") return false;
    return creativeProfileIds.has(t.current_assignee_id);
  });

  // Group tasks by assignee and compute aggregates
  let globalTotalActive = 0;
  let globalTotalDueSoon = 0;
  let globalTotalOverdue = 0;

  let globalTodo = 0;
  let globalInProgress = 0;
  let globalRevision = 0;
  let globalInReview = 0;

  let riskOverdue = 0;
  let riskDueSoon = 0;
  let riskSafe = 0;
  let riskNoDeadline = 0;

  const urgentCandidates: {
    task: TaskRow;
    diffDays: number | null;
    assigneeName: string;
    assigneeRole: "GRAPHIC_DESIGNER" | "VIDEO_EDITOR";
  }[] = [];

  const profileMap = new Map<string, ProfileRow>(profiles.map((p: ProfileRow) => [p.id, p]));

  const members: CreativeWorkloadMember[] = profiles.map((profile: ProfileRow) => {
    const userTaskRows = activeTasks.filter((t: TaskRow) => t.current_assignee_id === profile.id);

    const userTasks: CreativeTaskSummary[] = userTaskRows.map((t: TaskRow) => {
      const proj = Array.isArray(t.project) ? t.project[0] : t.project;
      const isOverdue = t.deadline ? isDeadlineOverdue(t.deadline) : false;
      const isDueSoon = t.deadline ? isDeadlineDueSoon(t.deadline) : false;

      return {
        id: t.id,
        title: t.title,
        projectId: proj?.id || "",
        projectName: proj?.name || "Project Operasional",
        status: t.status,
        deadline: t.deadline,
        isOverdue,
        isDueSoon,
      };
    });

    const todoCount = userTasks.filter((t) => t.status === "TODO").length;
    const inProgressCount = userTasks.filter((t) => t.status === "IN_PROGRESS").length;
    const revisionCount = userTasks.filter((t) => t.status === "REVISION_REQUESTED").length;
    const inReviewCount = userTasks.filter((t) => t.status === "IN_REVIEW").length;
    const dueSoonCount = userTasks.filter((t) => !t.isOverdue && t.isDueSoon).length;
    const overdueCount = userTasks.filter((t) => t.isOverdue).length;

    globalTotalActive += userTasks.length;
    globalTotalDueSoon += dueSoonCount;
    globalTotalOverdue += overdueCount;

    globalTodo += todoCount;
    globalInProgress += inProgressCount;
    globalRevision += revisionCount;
    globalInReview += inReviewCount;

    return {
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      role: profile.role,
      avatarUrl: profile.avatar_url,
      totalActiveTasks: userTasks.length,
      todoCount,
      inProgressCount,
      revisionCount,
      inReviewCount,
      dueSoonCount,
      overdueCount,
      tasks: userTasks,
    };
  });

  // Calculate global deadline risk distribution
  for (const t of activeTasks) {
    const diff = getDeadlineDiffDays(t.deadline);
    if (diff === null) {
      riskNoDeadline += 1;
    } else if (diff < 0) {
      riskOverdue += 1;
    } else if (diff <= 7) {
      riskDueSoon += 1;
    } else {
      riskSafe += 1;
    }

    const assignee = profileMap.get(t.current_assignee_id);
    if (assignee) {
      urgentCandidates.push({
        task: t,
        diffDays: diff,
        assigneeName: assignee.full_name,
        assigneeRole: assignee.role,
      });
    }
  }

  // Sort urgent candidates:
  // 1. Tasks with deadline come first, sorted by diffDays ascending:
  //    negative (overdue) -> 0 (today) -> 1 (tomorrow) -> 2+ (upcoming)
  // 2. Tasks without deadline come last
  urgentCandidates.sort((a, b) => {
    if (a.diffDays === null && b.diffDays === null) return 0;
    if (a.diffDays === null) return 1;
    if (b.diffDays === null) return -1;
    return a.diffDays - b.diffDays;
  });

  // Take top 3 to 5 tasks
  const nearestDeadlines: UrgentTaskItem[] = urgentCandidates
    .filter((item) => item.diffDays !== null) // prioritize tasks with deadline for strip
    .slice(0, 5)
    .map((item) => {
      const proj = Array.isArray(item.task.project) ? item.task.project[0] : item.task.project;
      const diff = item.diffDays as number;

      let urgencyLabel = "";
      let isOverdue = false;
      let isDueToday = false;
      let isDueTomorrow = false;

      if (diff < 0) {
        urgencyLabel = `Terlambat ${Math.abs(diff)} hari`;
        isOverdue = true;
      } else if (diff === 0) {
        urgencyLabel = "Hari ini";
        isDueToday = true;
      } else if (diff === 1) {
        urgencyLabel = "Besok";
        isDueTomorrow = true;
      } else {
        urgencyLabel = `${diff} hari lagi`;
      }

      return {
        id: item.task.id,
        title: item.task.title,
        projectId: proj?.id || "",
        projectName: proj?.name || "Project Operasional",
        assigneeName: item.assigneeName,
        assigneeRole: item.assigneeRole,
        status: item.task.status,
        deadline: item.task.deadline,
        urgencyLabel,
        isOverdue,
        isDueToday,
        isDueTomorrow,
      };
    });

  const statusDistribution: TeamStatusDistribution = {
    todo: globalTodo,
    inProgress: globalInProgress,
    revision: globalRevision,
    inReview: globalInReview,
    total: globalTotalActive,
  };

  const deadlineRisk: TeamDeadlineRisk = {
    overdue: riskOverdue,
    dueSoon: riskDueSoon,
    safe: riskSafe,
    noDeadline: riskNoDeadline,
    total: globalTotalActive,
  };

  return {
    members,
    totalActiveCreatives: members.length,
    totalActiveTasks: globalTotalActive,
    totalDueSoonTasks: globalTotalDueSoon,
    totalOverdueTasks: globalTotalOverdue,
    statusDistribution,
    deadlineRisk,
    nearestDeadlines,
  };
}
