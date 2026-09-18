import type { Database } from "@/types/database";

export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
export type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];
export type ClientUpdate = Database["public"]["Tables"]["clients"]["Update"];

export interface ClientWithStats extends ClientRow {
  brands_count?: number;
}

export interface ClientDetail extends ClientRow {
  brands: Array<{
    id: string;
    name: string;
    code: string;
    is_active: boolean;
    created_at: string;
  }>;
}
