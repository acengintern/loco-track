import type { UserRole } from "@/lib/supabase/provisioning";

export interface UserListItem {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserListStats {
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  roleCounts: Record<UserRole, number>;
}

export interface UserFilterParams {
  search?: string;
  role?: UserRole | "ALL";
  status?: "ALL" | "ACTIVE" | "INACTIVE";
  page?: number;
  pageSize?: number;
}

export interface PaginatedUsers {
  items: UserListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: UserListStats;
}
