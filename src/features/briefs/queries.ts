import { createClient } from "@/lib/supabase/server";
import type { BriefDetail } from "./types";

export async function getBriefByProjectId(
  projectId: string
): Promise<BriefDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("briefs")
    .select(`
      id,
      project_id,
      objective,
      target_audience,
      key_message,
      deliverables_summary,
      reference_links,
      created_by,
      created_at,
      updated_at,
      creator:profiles!briefs_created_by_fkey (
        id,
        full_name,
        email
      )
    `)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const creatorData = data.creator as unknown as {
    id: string;
    full_name: string;
    email: string;
  } | null;

  return {
    id: data.id,
    project_id: data.project_id,
    objective: data.objective,
    target_audience: data.target_audience,
    key_message: data.key_message,
    deliverables_summary: data.deliverables_summary,
    reference_links: data.reference_links,
    created_by: data.created_by,
    created_at: data.created_at,
    updated_at: data.updated_at,
    creator: creatorData,
  };
}
