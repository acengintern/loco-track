import type { TaskType, PriorityLevel } from "@/features/tasks/types";

export type QcVerdict = "APPROVED" | "REVISION_REQUESTED";
export type RevisionSource = "INTERNAL_QC" | "CLIENT";
export type RevisionStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

export interface QcReviewWithRelations {
  id: string;
  project_id: string;
  task_id: string;
  file_id: string;
  reviewer_id: string;
  result: QcVerdict;
  notes: string;
  round_number: number;
  reviewed_at: string;
  created_at: string;
  reviewer?: {
    id: string;
    full_name: string;
    role: string;
  } | null;
  file?: {
    id: string;
    version: number;
    file_name: string;
    file_type: string;
    storage_path: string;
  } | null;
}

export interface RevisionRequestWithRelations {
  id: string;
  project_id: string;
  task_id: string;
  assigned_to: string;
  qc_review_id: string | null;
  requested_by: string;
  source: RevisionSource;
  round_number: number;
  notes: string;
  status: RevisionStatus;
  requested_at: string;
  resolved_at: string | null;
  created_at: string;
  assigned_to_profile?: {
    id: string;
    full_name: string;
  } | null;
  requested_by_profile?: {
    id: string;
    full_name: string;
  } | null;
}

export interface DeliverableFileInfo {
  id: string;
  version: number;
  file_name: string;
  file_type: string;
  mime_type: string;
  file_size_bytes: number;
  storage_path: string;
  created_at: string;
  uploaded_by: string;
  asset_group_id?: string;
}

export interface ApprovalQueueItem {
  task_id: string;
  task_title: string;
  task_type: TaskType;
  priority: PriorityLevel;
  deadline: string | null;
  project_id: string;
  project_code: string;
  project_name: string;
  assignee: {
    id: string;
    full_name: string;
  } | null;
  latest_file: DeliverableFileInfo | null;
  previous_file: DeliverableFileInfo | null;
  previous_revision_notes: string | null;
  has_prior_revisions: boolean;
  submitted_at: string;
  qc_round: number;
  prior_reviews_count: number;
}

export interface ApprovalQueueStats {
  totalInReview: number;
  urgentCount: number;
  revisionRoundCount: number;
  criticalDeadlineCount: number;
}

export interface ProjectQcCompleteness {
  projectId: string;
  totalQcTasks: number;
  approvedTasks: number;
  inReviewTasks: number;
  revisionTasks: number;
  inProgressTasks: number;
  isComplete: boolean;
  statusText: string;
}
