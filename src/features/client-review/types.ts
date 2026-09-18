import type { Database } from "@/types/database";

export type ClientReviewVerdict = Database["public"]["Enums"]["client_review_verdict"];
export type QcVerdict = Database["public"]["Enums"]["qc_verdict"];

export interface ClientReviewItemDetail {
  id: string;
  client_review_id: string;
  task_id: string;
  file_id: string;
  verdict: QcVerdict;
  feedback_notes: string | null;
  created_at: string;
  task: {
    id: string;
    title: string;
    task_type: string;
    status: string;
    current_assignee?: {
      id: string;
      full_name: string;
      avatar_url: string | null;
    } | null;
  };
  file: {
    id: string;
    file_name: string;
    file_size_bytes: number;
    mime_type: string;
    storage_path: string;
    version: number;
    public_url?: string;
  };
}

export interface ClientReviewRoundDetail {
  id: string;
  project_id: string;
  submitted_by: string;
  round_number: number;
  overall_verdict: ClientReviewVerdict;
  general_feedback: string | null;
  reviewed_at: string | null;
  created_at: string;
  submitter?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  items: ClientReviewItemDetail[];
}

export interface PresentedTaskCandidate {
  task_id: string;
  task_title: string;
  task_type: string;
  task_status: string;
  assignee_name: string;
  assignee_id: string;
  file_id: string;
  file_name: string;
  file_size_bytes: number;
  version: number;
  storage_path: string;
  public_url?: string;
  internal_qc_approved: boolean;
  client_item?: {
    id: string;
    verdict: QcVerdict;
    feedback_notes: string | null;
    created_at: string;
  } | null;
}

export interface ProjectClientReviewData {
  projectId: string;
  projectStatus: string;
  smsOwnerId: string;
  publicationUrl: string | null;
  publishNote: string | null;
  publishedAt: string | null;
  publishedBy: {
    id: string;
    full_name: string;
  } | null;
  currentRound: ClientReviewRoundDetail | null;
  allRounds: ClientReviewRoundDetail[];
  presentedCandidates: PresentedTaskCandidate[];
  canStartReview: boolean;
  canRePresent: boolean;
  canFinalizeApproval: boolean;
  canPublish: boolean;
  pendingTasksCount: number;
  approvedTasksCount: number;
  revisionTasksCount: number;
  activeRevisionRequestsCount: number;
}
