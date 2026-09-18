"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export interface ResolveIdentifierResult {
  success: boolean;
  email?: string;
  error?: string;
}

/**
 * Resolves an email or username identifier into a confirmed email address
 * suitable for Supabase Auth signInWithPassword.
 * 
 * If the identifier contains an '@', it is treated as a direct email.
 * Otherwise, it performs a case-insensitive lookup on public.profiles.username.
 */
export async function resolveLoginIdentifier(
  identifier: string
): Promise<ResolveIdentifierResult> {
  const trimmed = identifier.trim();
  if (!trimmed) {
    return { success: false, error: "Email/username atau kata sandi tidak sesuai." };
  }

  // Direct email address returns immediately
  if (trimmed.includes("@")) {
    return { success: true, email: trimmed.toLowerCase() };
  }

  // Enforce username format: 3-30 characters, alphanumeric, dots, underscores, hyphens
  if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(trimmed)) {
    return {
      success: false,
      error: "Email/username atau kata sandi tidak sesuai.",
    };
  }

  try {
    const admin = createAdminClient();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("email, is_active")
      .ilike("username", trimmed)
      .maybeSingle();

    if (error || !profile) {
      return {
        success: false,
        error: "Email/username atau kata sandi tidak sesuai.",
      };
    }

    if (!profile.is_active) {
      return {
        success: false,
        error: "Akun Anda sedang dinonaktifkan. Hubungi administrator.",
      };
    }

    return {
      success: true,
      email: profile.email,
    };
  } catch (err: unknown) {
    console.error("Failed to resolve login identifier:", err);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat memverifikasi nama pengguna.",
    };
  }
}
