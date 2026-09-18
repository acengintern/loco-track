export type TaskType =
  | "GRAPHIC_DESIGN"
  | "VIDEO_EDITING"
  | "CONTENT_PLAN"
  | "SCRIPT"
  | "PUBLISHING"
  | "OTHER";

export type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "REVISION_REQUESTED"
  | "APPROVED"
  | "COMPLETED";

export type PriorityLevel = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

/**
 * Human-facing labels for task statuses (Rule 39).
 * Raw enum strings must never be displayed as primary text in the UI.
 */
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "Belum dikerjakan",
  IN_PROGRESS: "Sedang dikerjakan",
  IN_REVIEW: "Menunggu review",
  REVISION_REQUESTED: "Perlu revisi",
  APPROVED: "Disetujui",
  COMPLETED: "Selesai",
};

/**
 * Human-facing labels for task types (Rule 40).
 */
export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  GRAPHIC_DESIGN: "Desain Grafis",
  VIDEO_EDITING: "Video Editing",
  CONTENT_PLAN: "Content Plan",
  SCRIPT: "Script",
  PUBLISHING: "Publishing",
  OTHER: "Lainnya",
};

/**
 * Human-facing labels for task priorities.
 */
export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  LOW: "Rendah",
  MEDIUM: "Sedang",
  HIGH: "Tinggi",
  URGENT: "Mendesak",
};

export interface TaskAssignmentItem {
  id: string;
  task_id: string;
  assignee_id: string;
  assigned_by: string;
  assigned_at: string;
  ended_at: string | null;
  assignee?: {
    id: string;
    full_name: string;
    role: string;
    email: string;
  } | null;
}

export interface TaskWithRelations {
  id: string;
  project_id: string;
  title: string;
  task_type: TaskType;
  status: TaskStatus;
  priority: PriorityLevel;
  requires_qc: boolean;
  deadline: string;
  notes: string | null;
  content_plan_id: string | null;
  script_id: string | null;
  current_assignee_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  project?: {
    id: string;
    name: string;
    project_code: string;
    deadline: string;
    status: string;
    sms_owner_id: string;
  };
  current_assignee?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  } | null;
  content_plan?: {
    id: string;
    title: string;
    channel: string;
  } | null;
  script?: {
    id: string;
    title: string;
    status: string;
  } | null;
  assignments?: TaskAssignmentItem[];
  publication_url?: string | null;
  published_at?: string | null;
  published_by?: string | null;
  client_review_items?: TaskClientReviewItem[];
  latest_client_review?: TaskClientReviewItem | null;
}

export interface TaskClientReviewItem {
  id: string;
  verdict: "APPROVED" | "REVISION_REQUESTED";
  feedback_notes: string | null;
  created_at: string;
}
