import { createClient } from "@/lib/supabase/server";
import type { BrandWithRelations, BrandDetail } from "./types";

export async function getBrands(params?: {
  search?: string;
}): Promise<BrandWithRelations[]> {
  const supabase = await createClient();

  let query = supabase
    .from("brands")
    .select(`
      id,
      client_id,
      name,
      code,
      description,
      created_by,
      created_at,
      updated_at,
      deleted_at,
      clients (
        id,
        name
      ),
      projects (
        id,
        deleted_at
      )
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (params?.search && params.search.trim()) {
    const term = params.search.trim();
    query = query.or(`name.ilike.%${term}%,code.ilike.%${term}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching brands:", error);
    return [];
  }

  return (data || []).map((brand) => {
    const clientData = brand.clients as unknown as { id: string; name: string } | null;
    const activeProjects = (brand.projects || []).filter(
      (p: { id: string; deleted_at: string | null }) => p.deleted_at === null
    );

    return {
      id: brand.id,
      client_id: brand.client_id,
      name: brand.name,
      code: brand.code,
      description: brand.description,
      created_by: brand.created_by,
      created_at: brand.created_at,
      updated_at: brand.updated_at,
      deleted_at: brand.deleted_at,
      client_name: clientData?.name || "Client Tidak Diketahui",
      projects_count: activeProjects.length,
    };
  });
}

export async function getBrandById(id: string): Promise<BrandDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("brands")
    .select(`
      id,
      client_id,
      name,
      code,
      description,
      created_by,
      created_at,
      updated_at,
      deleted_at,
      clients (
        id,
        name
      ),
      projects (
        id,
        project_code,
        name,
        status,
        deadline,
        deleted_at
      )
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !data) {
    return null;
  }

  const clientData = data.clients as unknown as { id: string; name: string } | null;
  const activeProjects = (data.projects || [])
    .filter((p: { deleted_at: string | null }) => p.deleted_at === null)
    .map((p: { id: string; project_code: string; name: string; status: string; deadline: string }) => ({
      id: p.id,
      project_code: p.project_code,
      name: p.name,
      status: p.status,
      deadline: p.deadline,
    }));

  return {
    id: data.id,
    client_id: data.client_id,
    name: data.name,
    code: data.code,
    description: data.description,
    created_by: data.created_by,
    created_at: data.created_at,
    updated_at: data.updated_at,
    deleted_at: data.deleted_at,
    client: {
      id: clientData?.id || data.client_id,
      name: clientData?.name || "Client Tidak Diketahui",
    },
    projects: activeProjects,
  };
}

export async function getActiveClientsForBrandSelection(): Promise<
  Array<{ id: string; name: string }>
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .select("id, name")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching clients for selection:", error);
    return [];
  }

  return data || [];
}
