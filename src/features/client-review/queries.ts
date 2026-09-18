import { createClient } from "@/lib/supabase/server";
import type {
  ProjectClientReviewData,
  ClientReviewRoundDetail,
  ClientReviewItemDetail,
  PresentedTaskCandidate,
} from "./types";

export async function getProjectClientReviewData(
  projectId: string
): Promise<ProjectClientReviewData | null> {
  const supabase = await createClient();

  // 1. Fetch project details
  const { data: project, error: projError } = await supabase
    .from("projects")
    .select(`
      id,
      status,
      sms_owner_id,
      publication_url,
      publish_note,
      published_at,
      published_by,
      published_by_profile:profiles!projects_published_by_fkey (
        id,
        full_name
      )
    `)
    .eq("id", projectId)
    .is("deleted_at", null)
    .maybeSingle();

  if (projError || !project) {
    return null;
  }

  // 2. Fetch all client reviews with submitter and review items
  const { data: reviewsData, error: revError } = await supabase
    .from("client_reviews")
    .select(`
      id,
      project_id,
      submitted_by,
      round_number,
      overall_verdict,
      general_feedback,
      reviewed_at,
      created_at,
      submitter:profiles!client_reviews_submitted_by_fkey (
        id,
        full_name,
        avatar_url
      ),
      items:client_review_items (
        id,
        client_review_id,
        task_id,
        file_id,
        verdict,
        feedback_notes,
        created_at,
        task:tasks!client_review_items_task_id_fkey (
          id,
          title,
          task_type,
          status,
          current_assignee:profiles!tasks_current_assignee_id_fkey (
            id,
            full_name,
            avatar_url
          )
        ),
        file:project_files!client_review_items_file_id_fkey (
          id,
          file_name,
          file_size_bytes,
          mime_type,
          storage_path,
          version
        )
      )
    `)
    .eq("project_id", projectId)
    .order("round_number", { ascending: false });

  if (revError) {
    console.error("Error fetching client reviews:", revError);
  }

  const allRounds: ClientReviewRoundDetail[] = (reviewsData || []).map((r) => {
    const rawItems = (r.items as unknown as ClientReviewItemDetail[]) || [];
    return {
      id: r.id,
      project_id: r.project_id,
      submitted_by: r.submitted_by,
      round_number: r.round_number,
      overall_verdict: r.overall_verdict,
      general_feedback: r.general_feedback,
      reviewed_at: r.reviewed_at,
      created_at: r.created_at,
      submitter: r.submitter as unknown as ClientReviewRoundDetail["submitter"],
      items: rawItems,
    };
  });

  // Current active round (if any has PENDING verdict, or the latest round)
  const pendingRound = allRounds.find((r) => r.overall_verdict === "PENDING") || null;
  const currentRound = pendingRound || (allRounds.length > 0 ? allRounds[0] : null);

  // 3. Fetch active QC-required tasks for this project
  const { data: tasksData, error: taskError } = await supabase
    .from("tasks")
    .select(`
      id,
      title,
      task_type,
      status,
      current_assignee_id,
      current_assignee:profiles!tasks_current_assignee_id_fkey (
        id,
        full_name
      ),
      files:project_files!project_files_task_id_fkey (
        id,
        file_name,
        file_size_bytes,
        version,
        storage_path,
        deleted_at
      ),
      qc_reviews (
        id,
        file_id,
        result
      )
    `)
    .eq("project_id", projectId)
    .eq("requires_qc", true)
    .is("deleted_at", null);

  if (taskError) {
    console.error("Error fetching tasks for client review:", taskError);
  }

  // 4. Fetch active revision requests for this project
  const { data: revRequests } = await supabase
    .from("revision_requests")
    .select("id, status")
    .eq("project_id", projectId)
    .in("status", ["OPEN", "IN_PROGRESS"]);

  const activeRevisionRequestsCount = revRequests?.length || 0;

  // 5. Build presented task candidates
  const presentedCandidates: PresentedTaskCandidate[] = [];
  let pendingTasksCount = 0;
  let approvedTasksCount = 0;
  let revisionTasksCount = 0;

  for (const t of tasksData || []) {
    const activeFiles = ((t.files as Array<{
      id: string;
      file_name: string;
      file_size_bytes: number;
      version: number;
      storage_path: string;
      deleted_at: string | null;
    }>) || []).filter((f) => f.deleted_at === null);

    // Sections 3 & 4: Resolve the latest internally QC-approved deliverable version
    const approvedFiles = activeFiles.filter((f) =>
      (t.qc_reviews as Array<{ id: string; file_id: string; result: string }>)?.some(
        (qr) => qr.file_id === f.id && qr.result === "APPROVED"
      )
    );
    approvedFiles.sort((a, b) => b.version - a.version);
    const latestApprovedFile = approvedFiles[0] || null;

    activeFiles.sort((a, b) => b.version - a.version);
    const latestFile = latestApprovedFile || activeFiles[0] || null;

    const hasNewerUnapprovedVersion =
      latestApprovedFile !== null &&
      activeFiles.some((f) => f.version > latestApprovedFile.version);

    const approvedQc = Boolean(latestApprovedFile && !hasNewerUnapprovedVersion);

    // Check if there is an item in the current round
    let clientItem = null;
    if (currentRound) {
      const match = currentRound.items.find((item) => item.task_id === t.id);
      if (match) {
        clientItem = {
          id: match.id,
          verdict: match.verdict,
          feedback_notes: match.feedback_notes,
          created_at: match.created_at,
        };
      }
    }

    if (clientItem?.verdict === "APPROVED") {
      approvedTasksCount++;
    } else if (clientItem?.verdict === "REVISION_REQUESTED") {
      revisionTasksCount++;
    } else {
      pendingTasksCount++;
    }

    const assignee = t.current_assignee as unknown as { id: string; full_name: string } | null;

    if (latestFile) {
      presentedCandidates.push({
        task_id: t.id,
        task_title: t.title,
        task_type: t.task_type,
        task_status: t.status,
        assignee_name: assignee?.full_name || "Belum ditugaskan",
        assignee_id: t.current_assignee_id || "",
        file_id: latestFile.id,
        file_name: latestFile.file_name,
        file_size_bytes: latestFile.file_size_bytes,
        version: latestFile.version,
        storage_path: latestFile.storage_path,
        internal_qc_approved: approvedQc,
        client_item: clientItem,
      });
    }
  }

  // 6. Calculate domain gates
  const totalTasks = tasksData?.length || 0;
  const allTasksInternallyApproved =
    totalTasks > 0 &&
    (tasksData || []).every((t) => t.status === "APPROVED") &&
    presentedCandidates.length === totalTasks &&
    presentedCandidates.every((c) => c.internal_qc_approved);

  const noPendingRound = !pendingRound;
  const noActiveRevisions = activeRevisionRequestsCount === 0;

  // Can start review: project in INTERNAL_QC, all tasks internally approved, no pending round, no active revisions
  const canStartReview =
    project.status === "INTERNAL_QC" &&
    allTasksInternallyApproved &&
    noPendingRound &&
    noActiveRevisions;

  // Can re-present: project in CLIENT_REVIEW, all tasks internally approved, no pending round, no active revisions
  const canRePresent =
    project.status === "CLIENT_REVIEW" &&
    allTasksInternallyApproved &&
    noPendingRound &&
    noActiveRevisions;

  // Can finalize approval: project in CLIENT_REVIEW, all tasks internally approved, no active revisions,
  // and every candidate has client verdict APPROVED
  const allCandidatesClientApproved =
    presentedCandidates.length === totalTasks &&
    totalTasks > 0 &&
    presentedCandidates.every((c) => c.client_item?.verdict === "APPROVED");

  const canFinalizeApproval =
    project.status === "CLIENT_REVIEW" &&
    allTasksInternallyApproved &&
    noActiveRevisions &&
    allCandidatesClientApproved;

  // Can publish: project in APPROVED, no active revisions, all tasks approved
  const canPublish =
    project.status === "APPROVED" &&
    noActiveRevisions &&
    (tasksData || []).every((t) => t.status === "APPROVED");

  const publishedByProfile = project.published_by_profile as unknown as {
    id: string;
    full_name: string;
  } | null;

  return {
    projectId: project.id,
    projectStatus: project.status,
    smsOwnerId: project.sms_owner_id,
    publicationUrl: project.publication_url,
    publishNote: project.publish_note,
    publishedAt: project.published_at,
    publishedBy: publishedByProfile,
    currentRound,
    allRounds,
    presentedCandidates,
    canStartReview,
    canRePresent,
    canFinalizeApproval,
    canPublish,
    pendingTasksCount,
    approvedTasksCount,
    revisionTasksCount,
    activeRevisionRequestsCount,
  };
}
