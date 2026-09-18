"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  provisionUser,
  deactivateUser,
  type ProvisionUserResult,
  type UserRole,
} from "@/lib/supabase/provisioning";
import {
  createUserSchema,
  updateUserSchema,
  toggleUserStatusSchema,
  resetPasswordSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type ToggleUserStatusInput,
  type ResetPasswordInput,
} from "./schemas";

export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Provisions a new user account with Supabase Auth and public.profiles.
 * Strictly restricted to Administrator role.
 */
export async function createUserAction(
  rawInput: CreateUserInput
): Promise<ActionResponse<ProvisionUserResult>> {
  try {
    await requireRole(["ADMIN"]);

    const validated = createUserSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || "Data pengguna tidak valid.",
      };
    }

    const { fullName, email, username, role, password, sendInvite } = validated.data;
    const normalizedUsername = username.trim().toLowerCase();

    // Check if email already exists in profiles
    const supabase = await createClient();
    const { data: existingEmail } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (existingEmail) {
      return {
        success: false,
        error: "Pengguna dengan alamat email tersebut sudah terdaftar.",
      };
    }

    // Check if username already exists in profiles
    const { data: existingUsername } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", normalizedUsername)
      .maybeSingle();

    if (existingUsername) {
      return {
        success: false,
        error: "Nama pengguna tersebut sudah digunakan.",
      };
    }

    const result = await provisionUser({
      email,
      fullName,
      username: normalizedUsername,
      role,
      password: password || undefined,
      sendInvite,
    });

    revalidatePath("/users");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: result,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal membuat pengguna baru.";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Updates an existing user's display name and operational role.
 * Strictly restricted to Administrator role.
 */
export async function updateUserAction(
  rawInput: UpdateUserInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    const caller = await requireRole(["ADMIN"]);

    const validated = updateUserSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || "Data perubahan tidak valid.",
      };
    }

    const { id: targetUserId, fullName, username, role: newRole } = validated.data;
    const normalizedUsername = username ? username.trim().toLowerCase() : undefined;
    const supabase = await createClient();
    const admin = createAdminClient();

    // Check current target user record
    const { data: targetUser, error: fetchErr } = await supabase
      .from("profiles")
      .select("id, role, is_active, username")
      .eq("id", targetUserId)
      .maybeSingle();

    if (fetchErr || !targetUser) {
      return {
        success: false,
        error: "Pengguna tidak ditemukan dalam sistem.",
      };
    }

    // Safety invariant: If changing role away from ADMIN, verify that another active ADMIN exists
    if (targetUser.role === "ADMIN" && newRole !== "ADMIN") {
      const { count: activeAdminCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "ADMIN")
        .eq("is_active", true);

      if ((activeAdminCount ?? 0) <= 1) {
        return {
          success: false,
          error: "Peran tidak dapat diubah karena ini adalah satu-satunya Administrator aktif.",
        };
      }
    }

    // Check username uniqueness if changed
    if (normalizedUsername && normalizedUsername !== targetUser.username) {
      const { data: existingUserWithUsername } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", normalizedUsername)
        .neq("id", targetUserId)
        .maybeSingle();

      if (existingUserWithUsername) {
        return {
          success: false,
          error: "Nama pengguna tersebut sudah digunakan oleh akun lain.",
        };
      }
    }

    // 1. Update public.profiles
    const updatePayload: {
      full_name: string;
      role: UserRole;
      username?: string;
      updated_at: string;
    } = {
      full_name: fullName,
      role: newRole,
      updated_at: new Date().toISOString(),
    };
    if (normalizedUsername !== undefined) {
      updatePayload.username = normalizedUsername;
    }

    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", targetUserId);

    if (profileUpdateError) {
      return {
        success: false,
        error: `Gagal memperbarui profil: ${profileUpdateError.message}`,
      };
    }

    // 2. Synchronize in Supabase Auth user_metadata
    try {
      const metaUpdate: { full_name: string; username?: string } = { full_name: fullName };
      if (normalizedUsername !== undefined) {
        metaUpdate.username = normalizedUsername;
      }
      await admin.auth.admin.updateUserById(targetUserId, {
        user_metadata: metaUpdate,
      });
    } catch (authSyncErr) {
      console.warn("Gagal menyinkronkan user_metadata di auth:", authSyncErr);
    }

    revalidatePath("/users");
    revalidatePath("/dashboard");
    if (caller.id === targetUserId) {
      revalidatePath("/settings");
    }

    return {
      success: true,
      data: { id: targetUserId },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui data pengguna.";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Activates or deactivates a user account.
 * Deactivating revokes active sessions and blocks immediate login.
 * Strictly restricted to Administrator role.
 */
export async function toggleUserStatusAction(
  rawInput: ToggleUserStatusInput
): Promise<ActionResponse<{ id: string; isActive: boolean }>> {
  try {
    const caller = await requireRole(["ADMIN"]);

    const validated = toggleUserStatusSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || "Parameter status tidak valid.",
      };
    }

    const { id: targetUserId, isActive: targetActive } = validated.data;

    // Safety invariant: Admin cannot deactivate their own account
    if (caller.id === targetUserId && !targetActive) {
      return {
        success: false,
        error: "Anda tidak dapat menonaktifkan akun Administrator Anda sendiri.",
      };
    }

    const supabase = await createClient();

    // Check target user record
    const { data: targetUser } = await supabase
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", targetUserId)
      .maybeSingle();

    if (!targetUser) {
      return {
        success: false,
        error: "Pengguna tidak ditemukan dalam sistem.",
      };
    }

    // Safety invariant: Cannot deactivate the last active administrator
    if (targetUser.role === "ADMIN" && !targetActive) {
      const { count: activeAdminCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "ADMIN")
        .eq("is_active", true);

      if ((activeAdminCount ?? 0) <= 1) {
        return {
          success: false,
          error: "Tidak dapat menonaktifkan Administrator aktif terakhir.",
        };
      }
    }

    if (!targetActive) {
      // Deactivate profile and revoke active session tokens
      await deactivateUser(targetUserId);
    } else {
      // Reactivate profile
      const { error: activateError } = await supabase
        .from("profiles")
        .update({
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetUserId);

      if (activateError) {
        return {
          success: false,
          error: `Gagal mengaktifkan kembali akun: ${activateError.message}`,
        };
      }
    }

    revalidatePath("/users");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: { id: targetUserId, isActive: targetActive },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mengubah status keaktifan akun.";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Sets a new password for an existing user account via Supabase Auth Admin.
 * Strictly restricted to Administrator role.
 */
export async function resetUserPasswordAction(
  rawInput: ResetPasswordInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    await requireRole(["ADMIN"]);

    const validated = resetPasswordSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || "Format kata sandi baru tidak valid.",
      };
    }

    const { id: targetUserId, password } = validated.data;
    const admin = createAdminClient();

    const { error: resetError } = await admin.auth.admin.updateUserById(
      targetUserId,
      { password }
    );

    if (resetError) {
      return {
        success: false,
        error: `Gagal memperbarui kata sandi: ${resetError.message}`,
      };
    }

    revalidatePath("/users");

    return {
      success: true,
      data: { id: targetUserId },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal mereset kata sandi akun.";
    return {
      success: false,
      error: message,
    };
  }
}
