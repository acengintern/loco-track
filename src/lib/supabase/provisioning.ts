import { createAdminClient } from "./admin";

export type UserRole =
  | "ADMIN"
  | "CREATIVE_DIRECTOR"
  | "ACCOUNT_EXECUTIVE"
  | "SOCIAL_MEDIA_SPECIALIST"
  | "GRAPHIC_DESIGNER"
  | "VIDEO_EDITOR";

export interface ProvisionUserParams {
  email: string;
  password?: string;
  fullName: string;
  role: UserRole;
  username?: string;
  sendInvite?: boolean;
}

export interface ProvisionUserResult {
  userId: string;
  email: string;
  role: UserRole;
  fullName: string;
  username?: string | null;
}

/**
 * Server-only user provisioning foundation.
 * Handles user creation across Supabase Auth and public.profiles.
 * Employs compensating cleanup because Auth API and PostgreSQL mutations are not one atomic transaction.
 */
export async function provisionUser(params: ProvisionUserParams): Promise<ProvisionUserResult> {
  const admin = createAdminClient();

  let userId: string | null = null;
  const normalizedUsername = params.username ? params.username.trim().toLowerCase() : null;

  try {
    // 1. Create or invite user via Supabase Auth Admin API
    if (params.sendInvite || !params.password) {
      const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(params.email, {
        data: { full_name: params.fullName, username: normalizedUsername },
      });

      if (inviteError || !inviteData.user) {
        throw new Error(`Auth invite failed: ${inviteError?.message || "Unknown auth error"}`);
      }
      userId = inviteData.user.id;
    } else {
      const { data: createData, error: createError } = await admin.auth.admin.createUser({
        email: params.email,
        password: params.password,
        email_confirm: true,
        user_metadata: { full_name: params.fullName, username: normalizedUsername },
      });

      if (createError || !createData.user) {
        throw new Error(`Auth user creation failed: ${createError?.message || "Unknown auth error"}`);
      }
      userId = createData.user.id;
    }

    // 2. Insert corresponding profile row
    const { error: profileError } = await admin.from("profiles").insert({
      id: userId,
      full_name: params.fullName,
      email: params.email,
      role: params.role,
      username: normalizedUsername,
      is_active: true,
    });

    if (profileError) {
      throw new Error(`Profile creation failed: ${profileError.message}`);
    }

    return {
      userId,
      email: params.email,
      role: params.role,
      fullName: params.fullName,
      username: normalizedUsername,
    };
  } catch (err: unknown) {
    // Compensating cleanup: if auth was created but profile failed, delete auth user
    if (userId) {
      try {
        await admin.auth.admin.deleteUser(userId);
      } catch (cleanupErr) {
        console.error(`Compensating cleanup failed for orphaned user ${userId}:`, cleanupErr);
      }
    }
    const message = err instanceof Error ? err.message : "User provisioning failed";
    throw new Error(message);
  }
}

/**
 * Deactivates a user account and revokes active sessions.
 */
export async function deactivateUser(userId: string): Promise<void> {
  const admin = createAdminClient();

  // 1. Mark profile inactive
  const { error: profileError } = await admin
    .from("profiles")
    .update({ is_active: false })
    .eq("id", userId);

  if (profileError) {
    throw new Error(`Failed to deactivate profile: ${profileError.message}`);
  }

  // 2. Revoke active auth sessions
  try {
    await admin.auth.admin.signOut(userId);
  } catch (signOutErr) {
    console.warn(`Failed to immediately terminate sessions for deactivated user ${userId}:`, signOutErr);
  }
}
