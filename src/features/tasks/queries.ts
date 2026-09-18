import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/supabase/auth";
import type { TaskWithRelations, TaskAssignmentItem } from "./types";

/**
 * Fetches all non-deleted tasks belonging to a specific project.
 */
export async function getTasksByProjectId(
  projectId: string
): Promise<TaskWithRelations[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id,
      project_id,
      title,
      task_type,
      status,
      priority,
      requires_qc,
      deadline,
      notes,
      content_plan_id,
      script_id,
      current_assignee_id,
      created_at,
      updated_at,
      deleted_at,
      publication_url,
      published_at,
      published_by,
      current_assignee:profiles!tasks_current_assignee_id_fkey (
        id,
        full_name,
        email,
        role
      ),
      content_plan:content_plans (
        id,
        title,
        channel
      ),
      script:scripts (
        id,
        title,
        status
      ),
      client_review_items:client_review_items (
        id,
        verdict,
        feedback_notes,
        created_at
      )
    `)
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("deadline", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching project tasks:", error);
    return [];
  }

  return (data || []).map((t) => {
    const rawItems = (t.client_review_items as Array<{
      id: string;
      verdict: "APPROVED" | "REVISION_REQUESTED";
      feedback_notes: string | null;
      created_at: string;
    }>) || [];
    const sorted = [...rawItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return {
      ...t,
      latest_client_review: sorted[0] || null,
    };
  }) as unknown as TaskWithRelations[];
}

/**
 * Fetches a single task by ID with relations and assignment history.
 */
export async function getTaskById(
  taskId: string
): Promise<TaskWithRelations | null> {
  const supabase = await createClient();

  const { data: taskData, error: taskError } = await supabase
    .from("tasks")
    .select(`
      id,
      project_id,
      title,
      task_type,
      status,
      priority,
      requires_qc,
      deadline,
      notes,
      content_plan_id,
      script_id,
      current_assignee_id,
      created_at,
      updated_at,
      deleted_at,
      publication_url,
      published_at,
      published_by,
      project:projects (
        id,
        name,
        project_code,
        deadline,
        status,
        sms_owner_id
      ),
      current_assignee:profiles!tasks_current_assignee_id_fkey (
        id,
        full_name,
        email,
        role
      ),
      content_plan:content_plans (
        id,
        title,
        channel
      ),
      script:scripts (
        id,
        title,
        status
      ),
      client_review_items:client_review_items (
        id,
        verdict,
        feedback_notes,
        created_at
      )
    `)
    .eq("id", taskId)
    .is("deleted_at", null)
    .single();

  if (taskError || !taskData) {
    return null;
  }

  // Fetch assignment history for the task
  const { data: assignmentsData } = await supabase
    .from("task_assignments")
    .select(`
      id,
      task_id,
      assignee_id,
      assigned_by,
      assigned_at,
      ended_at,
      assignee:profiles!task_assignments_assignee_id_fkey (
        id,
        full_name,
        role,
        email
      )
    `)
    .eq("task_id", taskId)
    .order("assigned_at", { ascending: false });

  const rawReviews = (taskData.client_review_items as Array<{
    id: string;
    verdict: "APPROVED" | "REVISION_REQUESTED";
    feedback_notes: string | null;
    created_at: string;
  }>) || [];
  const sortedReviews = [...rawReviews].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const task = {
    ...taskData,
    latest_client_review: sortedReviews[0] || null,
    assignments: (assignmentsData || []) as unknown as TaskAssignmentItem[],
  } as unknown as TaskWithRelations;

  return task;
}

/**
 * Fetches tasks for the My Tasks route, scoped by user role.
 * - Creative roles (Designer, Editor): only assigned tasks
 * - SMS: tasks from owned projects or directly assigned
 * - Admin: all active tasks
 */
export async function getMyTasks(): Promise<TaskWithRelations[]> {
  const profile = await requireActiveProfile();
  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select(`
      id,
      project_id,
      title,
      task_type,
      status,
      priority,
      requires_qc,
      deadline,
      notes,
      content_plan_id,
      script_id,
      current_assignee_id,
      created_at,
      updated_at,
      deleted_at,
      publication_url,
      published_at,
      published_by,
      project:projects!inner (
        id,
        name,
        project_code,
        deadline,
        status,
        sms_owner_id
      ),
      current_assignee:profiles!tasks_current_assignee_id_fkey (
        id,
        full_name,
        email,
        role
      ),
      content_plan:content_plans (
        id,
        title,
        channel
      ),
      script:scripts (
        id,
        title,
        status
      ),
      client_review_items:client_review_items (
        id,
        verdict,
        feedback_notes,
        created_at
      )
    `)
    .is("deleted_at", null)
    .order("deadline", { ascending: true });

  if (profile.role === "GRAPHIC_DESIGNER" || profile.role === "VIDEO_EDITOR") {
    // Creatives only see tasks directly assigned to them
    query = query.eq("current_assignee_id", profile.id);
  } else if (profile.role === "SOCIAL_MEDIA_SPECIALIST") {
    // SMS sees tasks in projects they own
    query = query.eq("project.sms_owner_id", profile.id);
  }
  // Admin sees all non-deleted tasks

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching My Tasks:", error);
    return [];
  }

  return (data || []).map((t) => {
    const rawItems = (t.client_review_items as Array<{
      id: string;
      verdict: "APPROVED" | "REVISION_REQUESTED";
      feedback_notes: string | null;
      created_at: string;
    }>) || [];
    const sorted = [...rawItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return {
      ...t,
      latest_client_review: sorted[0] || null,
    };
  }) as unknown as TaskWithRelations[];
}

/**
 * Fetches active creative users available for assignment.
 */
export async function getAssignableCreativeUsers(): Promise<
  Array<{
    id: string;
    full_name: string;
    email: string;
    role: string;
  }>
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("is_active", true)
    .in("role", ["GRAPHIC_DESIGNER", "VIDEO_EDITOR", "SOCIAL_MEDIA_SPECIALIST"])
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Error fetching assignable creative users:", error);
    return [];
  }

  return data || [];
}
