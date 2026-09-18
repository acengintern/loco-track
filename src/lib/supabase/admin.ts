import { createClient } from "@supabase/supabase-js";

/**
 * Privileged Supabase Admin Client.
 * Strictly server-only. Uses SUPABASE_SERVICE_ROLE_KEY.
 * Reserved exclusively for Admin Auth user provisioning, session revocation, and initial bootstrap.
 * Prohibited from being imported in Client Components or used for ordinary business CRUD.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("Security violation: createAdminClient cannot be executed in browser context.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase admin configuration: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
