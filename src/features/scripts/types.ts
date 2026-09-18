import type { Database } from "@/types/database";

export type ScriptRow = Database["public"]["Tables"]["scripts"]["Row"];
export type ScriptInsert = Database["public"]["Tables"]["scripts"]["Insert"];
export type ScriptUpdate = Database["public"]["Tables"]["scripts"]["Update"];

export interface ScriptWithRelations extends ScriptRow {
  content_plan?: {
    id: string;
    title: string;
    channel: string;
  } | null;
  creator?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}
