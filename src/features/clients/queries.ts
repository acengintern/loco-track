import { createClient } from "@/lib/supabase/server";
import type { ClientWithStats, ClientDetail } from "./types";

export async function getClients(params?: {
  search?: string;
}): Promise<ClientWithStats[]> {
  const supabase = await createClient();

  let query = supabase
    .from("clients")
    .select(`
      id,
      name,
      description,
      contact_name,
      contact_email,
      contact_phone,
      is_active,
      created_by,
      created_at,
      updated_at,
      deleted_at,
      brands (
        id,
        deleted_at
      )
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (params?.search && params.search.trim()) {
    const term = params.search.trim();
    query = query.or(`name.ilike.%${term}%,contact_name.ilike.%${term}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching clients:", error);
    return [];
  }

  return (data || []).map((client) => {
    const activeBrands = (client.brands || []).filter(
      (b: { id: string; deleted_at: string | null }) => b.deleted_at === null
    );
    return {
      id: client.id,
      name: client.name,
      description: client.description,
      contact_name: client.contact_name,
      contact_email: client.contact_email,
      contact_phone: client.contact_phone,
      is_active: client.is_active,
      created_by: client.created_by,
      created_at: client.created_at,
      updated_at: client.updated_at,
      deleted_at: client.deleted_at,
      brands_count: activeBrands.length,
    };
  });
}

export async function getClientById(id: string): Promise<ClientDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .select(`
      id,
      name,
      description,
      contact_name,
      contact_email,
      contact_phone,
      is_active,
      created_by,
      created_at,
      updated_at,
      deleted_at,
      brands (
        id,
        name,
        code,
        is_active,
        created_at,
        deleted_at
      )
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !data) {
    return null;
  }

  const activeBrands = (data.brands || [])
    .filter((b: { deleted_at: string | null }) => b.deleted_at === null)
    .map((b: { id: string; name: string; code: string; is_active: boolean; created_at: string }) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      is_active: b.is_active,
      created_at: b.created_at,
    }));

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    contact_name: data.contact_name,
    contact_email: data.contact_email,
    contact_phone: data.contact_phone,
    is_active: data.is_active,
    created_by: data.created_by,
    created_at: data.created_at,
    updated_at: data.updated_at,
    deleted_at: data.deleted_at,
    brands: activeBrands,
  };
}
