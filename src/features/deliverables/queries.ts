import { createClient } from "@/lib/supabase/server";
import type { DeliverableFile } from "./types";

/**
 * Fetches all non-deleted deliverable files for a specific task ordered latest first.
 */
export async function getTaskDeliverables(
  taskId: string,
  includeDeleted = false
): Promise<DeliverableFile[]> {
  const supabase = await createClient();

  let query = supabase
    .from("project_files")
    .select(`
      id,
      project_id,
      task_id,
      asset_group_id,
      version,
      storage_bucket,
      storage_path,
      file_name,
      file_type,
      mime_type,
      file_size_bytes,
      uploaded_by,
      created_at,
      deleted_at,
      uploader:profiles!project_files_uploaded_by_fkey (
        id,
        full_name,
        email,
        role
      )
    `)
    .eq("task_id", taskId)
    .order("version", { ascending: false });

  if (!includeDeleted) {
    query = query.is("deleted_at", null);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching task deliverables:", error);
    return [];
  }

  return (data || []) as unknown as DeliverableFile[];
}

/**
 * Fetches the latest active deliverable file for a task.
 */
export async function getLatestTaskDeliverable(
  taskId: string
): Promise<DeliverableFile | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("project_files")
    .select(`
      id,
      project_id,
      task_id,
      asset_group_id,
      version,
      storage_bucket,
      storage_path,
      file_name,
      file_type,
      mime_type,
      file_size_bytes,
      uploaded_by,
      created_at,
      deleted_at,
      uploader:profiles!project_files_uploaded_by_fkey (
        id,
        full_name,
        email,
        role
      )
    `)
    .eq("task_id", taskId)
    .is("deleted_at", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching latest task deliverable:", error);
    return null;
  }

  return data as unknown as DeliverableFile | null;
}
