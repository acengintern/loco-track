import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Auto-load .env.local if present
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

/**
 * Initial Administrator Bootstrap Script
 * Idempotent server-side script to initialize root ADMIN user.
 * Requires environment variables:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - ADMIN_EMAIL
 * - ADMIN_PASSWORD
 * - ADMIN_NAME (optional, defaults to "System Administrator")
 */
async function bootstrapAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || "System Administrator";

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }

  if (!adminEmail || !adminPassword) {
    console.error("Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be provided.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Check if admin profile already exists
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, email, role, is_active")
    .eq("email", adminEmail)
    .single();

  if (existingProfile) {
    console.log(`Admin profile for ${adminEmail} already exists (ID: ${existingProfile.id}). No action needed.`);
    return;
  }

  console.log(`Provisioning initial admin account: ${adminEmail}...`);

  // Create user in Supabase Auth
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { full_name: adminName },
  });

  if (authError || !authUser.user) {
    console.error("Failed to create auth user:", authError?.message);
    process.exit(1);
  }

  const userId = authUser.user.id;

  // Insert profile row with ADMIN role
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    full_name: adminName,
    email: adminEmail,
    role: "ADMIN",
    is_active: true,
  });

  if (profileError) {
    console.error("Failed to create profile row:", profileError.message);
    // Compensating action: remove newly created auth user to prevent ghost account
    console.log("Rolling back auth user creation...");
    await supabase.auth.admin.deleteUser(userId);
    process.exit(1);
  }

  console.log(`Successfully bootstrapped initial admin account: ${adminEmail} (ID: ${userId})`);
}

bootstrapAdmin().catch((err) => {
  console.error("Unexpected bootstrap failure:", err);
  process.exit(1);
});
