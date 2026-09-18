import type { Database } from "@/types/database";

export type FileCategory = Database["public"]["Enums"]["file_category"];

export interface DeliverableFile {
  id: string;
  project_id: string;
  task_id: string | null;
  asset_group_id: string;
  version: number;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  file_type: FileCategory;
  mime_type: string;
  file_size_bytes: number;
  uploaded_by: string;
  created_at: string;
  deleted_at: string | null;
  uploader?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  } | null;
}

export interface DeliverableUploadAllocation {
  file_id: string;
  project_id: string;
  task_id: string;
  asset_group_id: string;
  version: number;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  sanitized_name: string;
  file_type: FileCategory;
  mime_type: string;
  file_size_bytes: number;
}
