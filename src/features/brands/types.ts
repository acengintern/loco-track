import type { Database } from "@/types/database";

export type BrandRow = Database["public"]["Tables"]["brands"]["Row"];
export type BrandInsert = Database["public"]["Tables"]["brands"]["Insert"];
export type BrandUpdate = Database["public"]["Tables"]["brands"]["Update"];

export interface BrandWithRelations extends BrandRow {
  client_name: string;
  projects_count?: number;
}

export interface BrandDetail extends BrandRow {
  client: {
    id: string;
    name: string;
  };
  projects: Array<{
    id: string;
    project_code: string;
    name: string;
    status: string;
    deadline: string;
  }>;
}
