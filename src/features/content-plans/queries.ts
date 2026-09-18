import { createClient } from "@/lib/supabase/server";
import type { ContentPlanDetail } from "./types";

export async function getContentPlansByProjectId(
  projectId: string,
  search?: string
): Promise<ContentPlanDetail[]> {
  const supabase = await createClient();

  let query = supabase
    .from("content_plans")
    .select(`
      id,
      project_id,
      title,
      channel,
      planned_post_date,
      pillar,
      copy_draft,
      status,
      created_by,
      created_at,
      updated_at,
      creator:profiles!content_plans_created_by_fkey (
        id,
        full_name,
        email
      )
    `)
    .eq("project_id", projectId)
    .order("planned_post_date", { ascending: true });

  if (search && search.trim()) {
    const term = search.trim();
    query = query.or(`title.ilike.%${term}%,pillar.ilike.%${term}%,channel.ilike.%${term}%`);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("Error fetching content plans:", error);
    return [];
  }

  return data.map((row) => {
    const creatorData = row.creator as unknown as {
      id: string;
      full_name: string;
      email: string;
    } | null;

    return {
      id: row.id,
      project_id: row.project_id,
      title: row.title,
      channel: row.channel,
      planned_post_date: row.planned_post_date,
      pillar: row.pillar,
      copy_draft: row.copy_draft,
      status: row.status,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      creator: creatorData,
    };
  });
}
