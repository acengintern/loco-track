import type {
  Database,
  ProjectPhase,
  PriorityLevel,
  UserRole,
} from "@/types/database";

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];
export type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"];

export interface ProjectWithRelations extends ProjectRow {
  brand: {
    id: string;
    name: string;
    code: string;
    client: {
      id: string;
      name: string;
    };
  };
  sms_owner: {
    id: string;
    full_name: string;
    email: string;
  };
  members_count: number;
}

export interface ProjectMemberDetail {
  id: string;
  project_id: string;
  user_id: string;
  created_at: string;
  user: {
    id: string;
    full_name: string;
    email: string;
    role: UserRole;
    avatar_url: string | null;
  };
}

export interface ProjectActivityLog {
  id: string;
  project_id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
  user: {
    id: string;
    full_name: string;
    email: string;
    role: UserRole;
  } | null;
}

export interface ProjectDetail extends ProjectRow {
  brand: {
    id: string;
    name: string;
    code: string;
    client: {
      id: string;
      name: string;
    };
  };
  sms_owner: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
  members: ProjectMemberDetail[];
  activity_logs: ProjectActivityLog[];
}

export interface ProjectFilterParams {
  search?: string;
  status?: ProjectPhase;
  priority?: PriorityLevel;
  brandId?: string;
  smsOwnerId?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedProjects {
  projects: ProjectWithRelations[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
}

export interface CreativeProjectTaskSummary {
  todo: number;
  in_progress: number;
  in_review: number;
  revision_requested: number;
  approved: number;
  completed: number;
}

export interface CreativeProjectItem {
  id: string;
  project_code: string;
  name: string;
  description: string | null;
  status: ProjectPhase;
  priority: PriorityLevel;
  deadline: string;
  brand: {
    id: string;
    name: string;
    code: string;
    client: {
      id: string;
      name: string;
    };
  };
  sms_owner: {
    id: string;
    full_name: string;
    email: string;
  };
  myTasksCount: number;
  myActiveTasksCount: number;
  myNearestDeadline: string | null;
  hasActiveRevision: boolean;
  statusSummary: CreativeProjectTaskSummary;
}

export interface PaginatedCreativeProjects {
  projects: CreativeProjectItem[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
}

export interface CreativeProjectFilterParams {
  userId: string;
  search?: string;
  status?: ProjectPhase;
  priority?: PriorityLevel;
  brandId?: string;
  page?: number;
  pageSize?: number;
  isAdminPreview?: boolean;
}

