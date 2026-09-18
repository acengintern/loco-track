import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/provisioning";
import type {
  PaginatedUsers,
  UserFilterParams,
  UserListItem,
  UserListStats,
} from "./types";

interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  username: string | null;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Fetches paginated users with filtering and aggregate team statistics.
 * Scoped to active administrator sessions.
 */
export async function getPaginatedUsers(
  params: UserFilterParams = {}
): Promise<PaginatedUsers> {
  const supabase = await createClient();

  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize || 15));
  const offset = (page - 1) * pageSize;

  // 1. Fetch global stats across all users
  const { data: allProfiles, error: statsError } = await supabase
    .from("profiles")
    .select("role, is_active");

  if (statsError) {
    throw new Error(`Gagal memuat statistik pengguna: ${statsError.message}`);
  }

  const initialRoleCounts: Record<UserRole, number> = {
    ADMIN: 0,
    CREATIVE_DIRECTOR: 0,
    ACCOUNT_EXECUTIVE: 0,
    SOCIAL_MEDIA_SPECIALIST: 0,
    GRAPHIC_DESIGNER: 0,
    VIDEO_EDITOR: 0,
  };

  const stats: UserListStats = (allProfiles || []).reduce<UserListStats>(
    (acc, row) => {
      acc.totalCount += 1;
      if (row.is_active) {
        acc.activeCount += 1;
      } else {
        acc.inactiveCount += 1;
      }
      const roleKey = row.role as UserRole;
      if (acc.roleCounts[roleKey] !== undefined) {
        acc.roleCounts[roleKey] += 1;
      }
      return acc;
    },
    {
      totalCount: 0,
      activeCount: 0,
      inactiveCount: 0,
      roleCounts: initialRoleCounts,
    }
  );

  // 2. Build filtered query for page results
  let query = supabase
    .from("profiles")
    .select(
      "id, full_name, email, username, role, avatar_url, is_active, created_at, updated_at",
      { count: "exact" }
    );

  if (params.search && params.search.trim().length > 0) {
    const searchTerm = `%${params.search.trim()}%`;
    query = query.or(`full_name.ilike.${searchTerm},email.ilike.${searchTerm},username.ilike.${searchTerm}`);
  }

  if (params.role && params.role !== "ALL") {
    query = query.eq("role", params.role);
  }

  if (params.status && params.status !== "ALL") {
    query = query.eq("is_active", params.status === "ACTIVE");
  }

  query = query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data: rows, count, error: listError } = await query;

  if (listError) {
    throw new Error(`Gagal memuat daftar pengguna: ${listError.message}`);
  }

  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const items: UserListItem[] = ((rows as ProfileRow[]) || []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    username: row.username,
    role: row.role,
    avatarUrl: row.avatar_url,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return {
    items,
    totalCount,
    page,
    pageSize,
    totalPages,
    stats,
  };
}

/**
 * Fetches a single user profile by ID.
 */
export async function getUserById(id: string): Promise<UserListItem | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, username, role, avatar_url, is_active, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as ProfileRow;
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    username: row.username,
    role: row.role,
    avatarUrl: row.avatar_url,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
