import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./server";
import type { UserRole } from "./provisioning";

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Returns the currently authenticated user from session cookies.
 * Deduplicated per-request via React cache.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
});

/**
 * Returns the profile for the current user.
 * Rejects inactive personnel immediately.
 * Deduplicated per-request via React cache.
 */
export const getCurrentProfile = cache(async (): Promise<UserProfile | null> => {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, avatar_url, is_active, created_at, updated_at")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    return null;
  }

  // Enforce immediate rejection of deactivated personnel
  if (!profile.is_active) {
    return null;
  }

  return {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    role: profile.role as UserRole,
    avatarUrl: profile.avatar_url,
    isActive: profile.is_active,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
});

/**
 * Requires an authenticated user with an active profile.
 * Redirects to /login if unauthenticated or deactivated.
 */
export async function requireActiveProfile(): Promise<UserProfile> {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  return profile;
}

/**
 * Enforces role-based guard for Server Components and Server Actions.
 * Redirects to /unauthorized if role lacks permission (Section 18 & 19).
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<UserProfile> {
  const profile = await requireActiveProfile();

  if (!allowedRoles.includes(profile.role)) {
    redirect("/unauthorized");
  }

  return profile;
}
