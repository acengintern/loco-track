import type { Database } from "@/types/database";

export type BriefRow = Database["public"]["Tables"]["briefs"]["Row"];
export type BriefInsert = Database["public"]["Tables"]["briefs"]["Insert"];
export type BriefUpdate = Database["public"]["Tables"]["briefs"]["Update"];

export interface BriefDetail extends BriefRow {
  creator?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}
