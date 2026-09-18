export type ActivityCategory =
  | "ALL"
  | "PROJECT"
  | "TASK"
  | "DELIVERABLE"
  | "QC"
  | "CLIENT_REVIEW";

export interface ActivityLogItem {
  id: string;
  projectId: string;
  projectName: string;
  userId: string | null;
  actorName: string;
  eventType: string;
  category: ActivityCategory;
  categoryLabel: string;
  humanTitle: string;
  humanDescription: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface ActivityFeedFilter {
  projectId?: string;
  actorId?: string;
  category?: ActivityCategory;
  page: number;
  pageSize: number;
}

export interface PaginatedActivityResponse {
  items: ActivityLogItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ActivityFilterOptions {
  projects: Array<{ id: string; name: string }>;
  actors: Array<{ id: string; fullName: string }>;
}
