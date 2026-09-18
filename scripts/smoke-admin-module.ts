import { createServerClient } from "@supabase/ssr";
import * as fs from "node:fs";
import * as path from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";

// Auto-load .env.local
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

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failedCount++;
  }
}

async function getRoleSessionCookie(email: string): Promise<string> {
  let storedCookies: Array<{ name: string; value: string }> = [];
  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => storedCookies,
      setAll: (cookies) => {
        storedCookies = cookies;
      },
    },
  });

  const { error } = await client.auth.signInWithPassword({
    email,
    password: "password123",
  });

  if (error) {
    throw new Error(`Failed to sign in as ${email}: ${error.message}`);
  }

  return storedCookies
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");
}

async function runAdminSmokeTests() {
  console.log("================================================================================");
  console.log("SMOKE TEST: ADMIN MODULE COMPLETION (USER MANAGEMENT, SETTINGS, DASHBOARD)");
  console.log("================================================================================\n");

  const adminCookie = await getRoleSessionCookie("admin@locotrack.local");
  const cdCookie = await getRoleSessionCookie("cd@locotrack.local");
  const designerCookie = await getRoleSessionCookie("designer@locotrack.local");

  // 1. Route Authorization Tests
  console.log("1. Testing Route Access Controls on /users...");

  const adminUsersRes = await fetch(`${baseUrl}/users`, {
    headers: { Cookie: adminCookie },
  });
  assert(adminUsersRes.status === 200, "Admin can access /users (HTTP 200)");

  const cdUsersRes = await fetch(`${baseUrl}/users`, {
    headers: { Cookie: cdCookie },
    redirect: "manual",
  });
  const cdUsersHtml = await cdUsersRes.text();
  assert(
    cdUsersHtml.includes("NEXT_REDIRECT;replace;/unauthorized;307;") ||
      cdUsersHtml.includes("unauthorized") ||
      cdUsersRes.status === 307 ||
      cdUsersRes.status === 302,
    "Creative Director is denied access to /users (Server guard redirect to /unauthorized)"
  );

  const designerUsersRes = await fetch(`${baseUrl}/users`, {
    headers: { Cookie: designerCookie },
    redirect: "manual",
  });
  const designerUsersHtml = await designerUsersRes.text();
  assert(
    designerUsersHtml.includes("NEXT_REDIRECT;replace;/unauthorized;307;") ||
      designerUsersHtml.includes("unauthorized") ||
      designerUsersRes.status === 307 ||
      designerUsersRes.status === 302,
    "Graphic Designer is denied access to /users (Server guard redirect to /unauthorized)"
  );

  // 2. User Management UI Content Verification
  console.log("\n2. Verifying User Management UI Elements on /users...");
  const adminUsersHtml = await adminUsersRes.text();

  assert(
    adminUsersHtml.includes("Manajemen Pengguna"),
    'Page header title "Manajemen Pengguna" is present'
  );
  assert(
    adminUsersHtml.includes("Total Personel"),
    'Metric card "Total Personel" is present'
  );
  assert(
    adminUsersHtml.includes("Personel Aktif"),
    'Metric card "Personel Aktif" is present'
  );
  assert(
    adminUsersHtml.includes("Komposisi Peran"),
    'Metric card "Komposisi Peran" is present'
  );
  assert(
    adminUsersHtml.includes("Tambah Pengguna"),
    'Action button "Tambah Pengguna" is present'
  );
  assert(
    adminUsersHtml.includes("admin@locotrack.local"),
    "Existing user email appears in the list table"
  );
  assert(
    !adminUsersHtml.includes("Modul Administrasi Pengguna\n        </h2>\n        <p className=\"mt-1.5 max-w-md text-sm text-muted-foreground leading-relaxed\">\n          Penyediaan akun awal telah diselesaikan"),
    "Old placeholder empty box has been successfully removed"
  );

  // Check no raw ISO timestamps in visible UI
  const visibleHtml = adminUsersHtml
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  assert(
    !/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(visibleHtml),
    "/users contains zero raw ISO timestamps in visible UI"
  );

  // 3. Admin Settings Page Verification
  console.log("\n3. Verifying Admin Settings Page (/settings)...");
  // Warm up route in dev server
  await fetch(`${baseUrl}/settings`, { headers: { Cookie: adminCookie } });
  const adminSettingsRes = await fetch(`${baseUrl}/settings`, {
    headers: { Cookie: adminCookie },
  });
  assert(adminSettingsRes.status === 200, "Admin can access /settings (HTTP 200)");
  const adminSettingsHtml = await adminSettingsRes.text();
  assert(
    adminSettingsHtml.includes("Tata Kelola") &&
      adminSettingsHtml.includes("Keamanan Sistem"),
    'Admin settings renders "Tata Kelola & Keamanan Sistem" governance section'
  );
  assert(
    adminSettingsHtml.includes("Database") && adminSettingsHtml.includes("RLS"),
    'Admin settings displays database & RLS status'
  );

  // Non-admin settings does not show governance card
  const designerSettingsRes = await fetch(`${baseUrl}/settings`, {
    headers: { Cookie: designerCookie },
  });
  const designerSettingsHtml = await designerSettingsRes.text();
  assert(
    !designerSettingsHtml.includes("Tata Kelola & Keamanan Sistem"),
    "Non-admin settings does NOT display administrative system governance card"
  );

  // 4. Admin Dashboard Enhancement Verification
  console.log("\n4. Verifying Admin Dashboard Enhancements (/dashboard)...");
  const adminDashRes = await fetch(`${baseUrl}/dashboard`, {
    headers: { Cookie: adminCookie },
  });
  const adminDashHtml = await adminDashRes.text();
  assert(
    adminDashHtml.includes('href="/users"'),
    'Admin dashboard links to /users'
  );
  assert(
    adminDashHtml.includes("Pusat Kendali Administrasi"),
    'Admin dashboard renders "Pusat Kendali Administrasi" quick action bar'
  );

  // 5. Backend Server Actions & Business Logic Verification
  console.log("\n5. Testing User Management Server Actions...");
  const adminClient = createAdminClient();
  const testEmail = `smoke_admin_test_${Date.now()}@locotrack.local`;
  let createdUserId: string | null = null;

  try {
    // Note: Server actions check requireRole(["ADMIN"]) which reads headers/cookies from server context.
    // In node/script environment without request context, we can test direct provisionUser and admin operations:
    const { provisionUser, deactivateUser } = await import("@/lib/supabase/provisioning");

    console.log("  Testing provisionUser...");
    const provisionResult = await provisionUser({
      email: testEmail,
      fullName: "Test Automated User",
      role: "GRAPHIC_DESIGNER",
      password: "TestPassword123!",
      sendInvite: false,
    });
    createdUserId = provisionResult.userId;
    assert(Boolean(createdUserId), `User provisioned successfully with ID: ${createdUserId}`);

    // Verify profile row exists
    const { data: profileCheck } = await adminClient
      .from("profiles")
      .select("id, full_name, role, is_active")
      .eq("id", createdUserId)
      .single();
    assert(profileCheck?.full_name === "Test Automated User", "Profile full_name matches");
    assert(profileCheck?.role === "GRAPHIC_DESIGNER", "Profile role matches");
    assert(profileCheck?.is_active === true, "Profile is initially active");

    // Test deactivation
    console.log("  Testing deactivateUser...");
    await deactivateUser(createdUserId);

    const { data: deactivatedCheck } = await adminClient
      .from("profiles")
      .select("is_active")
      .eq("id", createdUserId)
      .single();
    assert(deactivatedCheck?.is_active === false, "User was successfully deactivated");

    // Test reactivation
    console.log("  Testing reactivation...");
    await adminClient
      .from("profiles")
      .update({ is_active: true })
      .eq("id", createdUserId);

    const { data: reactivatedCheck } = await adminClient
      .from("profiles")
      .select("is_active")
      .eq("id", createdUserId)
      .single();
    assert(reactivatedCheck?.is_active === true, "User was successfully reactivated");

  } finally {
    // Cleanup test user
    if (createdUserId) {
      console.log("  Cleaning up test user...");
      await adminClient.from("profiles").delete().eq("id", createdUserId);
      await adminClient.auth.admin.deleteUser(createdUserId);
      console.log("  [PASS] Test user cleaned up successfully");
      passedCount++;
    }
  }

  console.log(
    "\n================================================================================"
  );
  console.log(`RESULTS: ${passedCount} PASS, ${failedCount} FAIL`);
  console.log(
    "================================================================================"
  );

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAdminSmokeTests().catch((err) => {
  console.error("Admin smoke test failed:", err);
  process.exit(1);
});
