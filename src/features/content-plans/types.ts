import type { Database } from "@/types/database";

export type ContentPlanRow = Database["public"]["Tables"]["content_plans"]["Row"];
export type ContentPlanInsert = Database["public"]["Tables"]["content_plans"]["Insert"];
export type ContentPlanUpdate = Database["public"]["Tables"]["content_plans"]["Update"];

export interface ContentPlanDetail extends ContentPlanRow {
  creator?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}
