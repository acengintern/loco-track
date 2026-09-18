import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ApprovalQueueItem,
  DeliverableFileInfo,
  QcReviewWithRelations,
  RevisionRequestWithRelations,
  ProjectQcCompleteness,
} from "./types";
import type { TaskType, PriorityLevel } from "@/features/tasks/types";

/**
 * Fetch all tasks in IN_REVIEW state requiring QC for the approvals queue.
 * Respects RLS and strictly restricts to tasks with requires_qc = true
 * (GRAPHIC_DESIGN and VIDEO_EDITING).
 */
export async function getApprovalsQueue(customClient?: SupabaseClient): Promise<ApprovalQueueItem[]> {
  const supabase = customClient ?? (await createClient());

  // Query tasks in IN_REVIEW that require QC (strictly GRAPHIC_DESIGN and VIDEO_EDITING)
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select(`
      id,
      title,
      task_type,
      priority,
      deadline,
      project_id,
      updated_at,
      current_assignee:profiles!tasks_current_assignee_id_fkey (
        id,
        full_name
      ),
      project:projects!tasks_project_id_fkey (
        id,
        project_code,
        name,
        deleted_at
      ),
      files:project_files!project_files_task_id_fkey (
        id,
        asset_group_id,
        version,
        file_name,
        file_type,
        mime_type,
        file_size_bytes,
        storage_path,
        created_at,
        uploaded_by,
        deleted_at
      ),
      qc_reviews (
        id,
        round_number,
        result,
        notes,
        created_at
      ),
      revision_requests (
        id,
        round_number,
        notes,
        status,
        created_at
      )
    `)
    .eq("status", "IN_REVIEW")
    .eq("requires_qc", true)
    .in("task_type", ["GRAPHIC_DESIGN", "VIDEO_EDITING"])
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error || !tasks) {
    return [];
  }

  const items: ApprovalQueueItem[] = [];

  for (const task of tasks) {
    // Exclude tasks whose project is archived
    const projectData = task.project as unknown as { id: string; project_code: string; name: string; deleted_at: string | null } | null;
    if (!projectData || projectData.deleted_at !== null) {
      continue;
    }

    // Filter active files and find highest active version
    const activeFiles = ((task.files as Array<{
      id: string;
      asset_group_id?: string;
      version: number;
      file_name: string;
      file_type: string;
      mime_type: string;
      file_size_bytes: number;
      storage_path: string;
      created_at: string;
      uploaded_by: string;
      deleted_at: string | null;
    }>) || []).filter((f) => f.deleted_at === null);

    activeFiles.sort((a, b) => b.version - a.version);
    const latestFileRaw = activeFiles[0] || null;

    // Lineage-safe previous version: same task and same asset_group_id
    let previousFileRaw: (typeof activeFiles)[number] | null = null;
    if (latestFileRaw) {
      previousFileRaw =
        activeFiles.find(
          (f) =>
            f.id !== latestFileRaw.id &&
            (f.asset_group_id && latestFileRaw.asset_group_id
              ? f.asset_group_id === latestFileRaw.asset_group_id
              : true)
        ) || null;
    }

    const priorReviews = (task.qc_reviews as Array<{ id: string; round_number: number; result: string; notes?: string; created_at?: string }>) || [];
    const revisionRequests = (task.revision_requests as Array<{ id: string; round_number: number; notes: string; status: string; created_at: string }>) || [];

    const maxRound = priorReviews.reduce((max, r) => Math.max(max, r.round_number), 0);
    const hasPriorRevisions = priorReviews.length > 0 || revisionRequests.length > 0 || maxRound > 0;

    // Fetch previous revision notes if available
    let previousRevisionNotes: string | null = null;
    if (revisionRequests.length > 0) {
      const sortedRevs = [...revisionRequests].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      previousRevisionNotes = sortedRevs[0]?.notes || null;
    } else if (priorReviews.length > 0) {
      const rejectedReviews = priorReviews.filter((r) => r.result === "REVISION_REQUESTED");
      if (rejectedReviews.length > 0) {
        const sortedReviews = [...rejectedReviews].sort(
          (a, b) => new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime()
        );
        previousRevisionNotes = sortedReviews[0]?.notes || null;
      }
    }

    const assigneeData = task.current_assignee as unknown as { id: string; full_name: string } | null;

    const latestFile: DeliverableFileInfo | null = latestFileRaw
      ? {
          id: latestFileRaw.id,
          version: latestFileRaw.version,
          file_name: latestFileRaw.file_name,
          file_type: latestFileRaw.file_type,
          mime_type: latestFileRaw.mime_type,
          file_size_bytes: latestFileRaw.file_size_bytes,
          storage_path: latestFileRaw.storage_path,
          created_at: latestFileRaw.created_at,
          uploaded_by: latestFileRaw.uploaded_by,
          asset_group_id: latestFileRaw.asset_group_id,
        }
      : null;

    const previousFile: DeliverableFileInfo | null = previousFileRaw
      ? {
          id: previousFileRaw.id,
          version: previousFileRaw.version,
          file_name: previousFileRaw.file_name,
          file_type: previousFileRaw.file_type,
          mime_type: previousFileRaw.mime_type,
          file_size_bytes: previousFileRaw.file_size_bytes,
          storage_path: previousFileRaw.storage_path,
          created_at: previousFileRaw.created_at,
          uploaded_by: previousFileRaw.uploaded_by,
          asset_group_id: previousFileRaw.asset_group_id,
        }
      : null;

    items.push({
      task_id: task.id,
      task_title: task.title,
      task_type: task.task_type as TaskType,
      priority: task.priority as PriorityLevel,
      deadline: task.deadline,
      project_id: projectData.id,
      project_code: projectData.project_code,
      project_name: projectData.name,
      assignee: assigneeData,
      latest_file: latestFile,
      previous_file: previousFile,
      previous_revision_notes: previousRevisionNotes,
      has_prior_revisions: hasPriorRevisions,
      submitted_at: latestFile ? latestFile.created_at : task.updated_at,
      qc_round: maxRound + 1,
      prior_reviews_count: priorReviews.length,
    });
  }

  return items;
}

export { getApprovalQueueStats } from "./utils";

/**
 * Fetch chronological QC reviews history for a task.
 */
export async function getTaskQcHistory(taskId: string): Promise<QcReviewWithRelations[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("qc_reviews")
    .select(`
      id,
      project_id,
      task_id,
      file_id,
      reviewer_id,
      result,
      notes,
      round_number,
      reviewed_at,
      created_at,
      reviewer:profiles!qc_reviews_reviewer_id_fkey (
        id,
        full_name,
        role
      ),
      file:project_files!qc_reviews_file_id_fkey (
        id,
        version,
        file_name,
        file_type,
        storage_path
      )
    `)
    .eq("task_id", taskId)
    .order("round_number", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data as unknown as QcReviewWithRelations[];
}

/**
 * Fetch revision requests for a task.
 */
export async function getTaskRevisionRequests(taskId: string): Promise<RevisionRequestWithRelations[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("revision_requests")
    .select(`
      id,
      project_id,
      task_id,
      assigned_to,
      qc_review_id,
      requested_by,
      source,
      round_number,
      notes,
      status,
      requested_at,
      resolved_at,
      created_at,
      assigned_to_profile:profiles!revision_requests_assigned_to_fkey (
        id,
        full_name
      ),
      requested_by_profile:profiles!revision_requests_requested_by_fkey (
        id,
        full_name
      )
    `)
    .eq("task_id", taskId)
    .order("round_number", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data as unknown as RevisionRequestWithRelations[];
}

/**
 * Check if all QC-required tasks for a project are approved.
 */
export async function checkProjectQcCompleteness(projectId: string): Promise<ProjectQcCompleteness> {
  const supabase = await createClient();

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, status, requires_qc")
    .eq("project_id", projectId)
    .is("deleted_at", null);

  if (error || !tasks) {
    return {
      projectId,
      totalQcTasks: 0,
      approvedTasks: 0,
      inReviewTasks: 0,
      revisionTasks: 0,
      inProgressTasks: 0,
      isComplete: false,
      statusText: "Gagal memuat status QC project.",
    };
  }

  const qcTasks = tasks.filter((t) => t.requires_qc);
  const totalQcTasks = qcTasks.length;
  const approvedTasks = qcTasks.filter((t) => t.status === "APPROVED" || t.status === "COMPLETED").length;
  const inReviewTasks = qcTasks.filter((t) => t.status === "IN_REVIEW").length;
  const revisionTasks = qcTasks.filter((t) => t.status === "REVISION_REQUESTED").length;
  const inProgressTasks = qcTasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "TODO").length;

  const isComplete = totalQcTasks > 0 && approvedTasks === totalQcTasks;

  let statusText = "Semua tugas QC telah disetujui.";
  if (totalQcTasks === 0) {
    statusText = "Tidak ada tugas yang memerlukan QC pada project ini.";
  } else if (!isComplete) {
    statusText = `${approvedTasks} dari ${totalQcTasks} tugas QC disetujui (${inReviewTasks} menunggu review, ${revisionTasks} perlu revisi).`;
  }

  return {
    projectId,
    totalQcTasks,
    approvedTasks,
    inReviewTasks,
    revisionTasks,
    inProgressTasks,
    isComplete,
    statusText,
  };
}

export const getProjectQcCompleteness = checkProjectQcCompleteness;
