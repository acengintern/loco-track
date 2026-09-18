import { createClient } from "@/lib/supabase/server";
import type { ScriptWithRelations } from "./types";

export async function getScriptsByProjectId(
  projectId: string,
  search?: string
): Promise<ScriptWithRelations[]> {
  const supabase = await createClient();

  let query = supabase
    .from("scripts")
    .select(`
      id,
      project_id,
      content_plan_id,
      title,
      hook,
      body,
      visual_cues,
      call_to_action,
      status,
      created_by,
      created_at,
      updated_at,
      content_plan:content_plans!scripts_content_plan_id_fkey (
        id,
        title,
        channel
      ),
      creator:profiles!scripts_created_by_fkey (
        id,
        full_name,
        email
      )
    `)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (search && search.trim()) {
    const term = search.trim();
    query = query.or(`title.ilike.%${term}%,hook.ilike.%${term}%,body.ilike.%${term}%`);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("Error fetching scripts:", error);
    return [];
  }

  return data.map((row) => {
    const contentPlanData = row.content_plan as unknown as {
      id: string;
      title: string;
      channel: string;
    } | null;

    const creatorData = row.creator as unknown as {
      id: string;
      full_name: string;
      email: string;
    } | null;

    return {
      id: row.id,
      project_id: row.project_id,
      content_plan_id: row.content_plan_id,
      title: row.title,
      hook: row.hook,
      body: row.body,
      visual_cues: row.visual_cues,
      call_to_action: row.call_to_action,
      status: row.status as "DRAFT" | "READY",
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      content_plan: contentPlanData,
      creator: creatorData,
    };
  });
}
