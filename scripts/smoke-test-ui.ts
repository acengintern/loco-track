import { createServerClient } from "@supabase/ssr";
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

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedCount++;
  }
}

async function getAuthCookie(email: string, password = "password123"): Promise<string> {
  let storedCookies: Array<{ name: string; value: string }> = [];
  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => storedCookies,
      setAll: (cookies) => {
        storedCookies = cookies;
      },
    },
  });

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Failed to sign in as ${email}: ${error.message}`);
  }

  return storedCookies.map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join("; ");
}

async function runSmokeTests() {
  console.log("=== PHASE 4.1 UI & ROUTE SMOKE TESTS ===\n");

  // -------------------------------------------------------------
  // Test 1: Anonymous Access & Authentication Guards
  // -------------------------------------------------------------
  console.log("1. Anonymous Route Redirects & Safe Endpoints");
  const anonDashboard = await fetch(`${baseUrl}/dashboard`, { redirect: "manual" });
  assert(
    anonDashboard.status === 307 && anonDashboard.headers.get("location") === "/login",
    "Anonymous visiting /dashboard redirected (307) to /login"
  );

  const anonProjects = await fetch(`${baseUrl}/projects`, { redirect: "manual" });
  assert(
    anonProjects.status === 307 && anonProjects.headers.get("location") === "/login",
    "Anonymous visiting /projects redirected (307) to /login"
  );

  const anonTasks = await fetch(`${baseUrl}/tasks`, { redirect: "manual" });
  assert(
    anonTasks.status === 307 && anonTasks.headers.get("location") === "/login",
    "Anonymous visiting /tasks redirected (307) to /login"
  );

  const anonSettings = await fetch(`${baseUrl}/settings`, { redirect: "manual" });
  assert(
    anonSettings.status === 307 && anonSettings.headers.get("location") === "/login",
    "Anonymous visiting /settings redirected (307) to /login"
  );

  const anonLogin = await fetch(`${baseUrl}/login`);
  assert(anonLogin.status === 200, "Anonymous visiting /login receives 200 OK");
  const loginHtml = await anonLogin.text();
  assert(
    loginHtml.includes("Masuk ke workspace") &&
      loginHtml.includes("id=\"email\"") &&
      loginHtml.includes("id=\"password\""),
    "Login form contains email, password fields and workspace heading"
  );

  const anonUnauthorized = await fetch(`${baseUrl}/unauthorized`, { redirect: "manual" });
  assert(
    anonUnauthorized.status === 307 && anonUnauthorized.headers.get("location") === "/login",
    "Anonymous visiting /unauthorized redirected to /login (requires authenticated session)"
  );

  const anonNotFound = await fetch(`${baseUrl}/non-existent-page-test-xyz`);
  assert(anonNotFound.status === 404, "Unknown route returns 404 Not Found");
  const notFoundHtml = await anonNotFound.text();
  assert(
    notFoundHtml.includes("Halaman Tidak Ditemukan"),
    "404 page contains 'Halaman Tidak Ditemukan'"
  );

  // -------------------------------------------------------------
  // Test 2: Active Authenticated Session on /login & /dashboard
  // -------------------------------------------------------------
  console.log("\n2. Authenticated Session Routing");
  const adminCookie = await getAuthCookie("admin@locotrack.local");
  const activeUserOnLogin = await fetch(`${baseUrl}/login`, {
    headers: { Cookie: adminCookie },
    redirect: "manual",
  });
  assert(
    activeUserOnLogin.status === 307 &&
      activeUserOnLogin.headers.get("location") === "/dashboard",
    "Active authenticated user visiting /login redirected (307) to /dashboard"
  );

  const adminDashboardRes = await fetch(`${baseUrl}/dashboard`, {
    headers: { Cookie: adminCookie },
  });
  assert(adminDashboardRes.status === 200, "Admin can access /dashboard (200 OK)");
  const adminDashHtml = await adminDashboardRes.text();
  assert(
    adminDashHtml.includes("Administrator") &&
      adminDashHtml.includes("Super Administrator") &&
      adminDashHtml.includes("/users"),
    "Admin dashboard contains human role label, name, and admin operational links"
  );

  // Authenticated user visiting /unauthorized
  const designerCookieForUnauth = await getAuthCookie("designer@locotrack.local");
  const unauthAuthRes = await fetch(`${baseUrl}/unauthorized`, {
    headers: { Cookie: designerCookieForUnauth },
  });
  assert(unauthAuthRes.status === 200, "Authenticated user visiting /unauthorized receives 200 OK");
  const unauthAuthHtml = await unauthAuthRes.text();
  assert(
    unauthAuthHtml.includes("Akses Dibatasi"),
    "Authenticated /unauthorized displays 'Akses Dibatasi' notice"
  );

  // -------------------------------------------------------------
  // Test 3: Creative Roles Access to /projects (Phase 4.1 Requirement)
  // -------------------------------------------------------------
  console.log("\n3. Creative Roles Access to /projects");
  const designerCookie = await getAuthCookie("designer@locotrack.local");
  const designerProjectsRes = await fetch(`${baseUrl}/projects`, {
    headers: { Cookie: designerCookie },
  });
  assert(
    designerProjectsRes.status === 200,
    "Designer visiting /projects returns 200 OK (ALLOWED)"
  );
  const designerProjHtml = await designerProjectsRes.text();
  assert(
    designerProjHtml.includes("Direktori Project") &&
      !designerProjHtml.includes("NEXT_REDIRECT;replace;/unauthorized;307;"),
    "Designer receives actual /projects page without unauthorized redirect"
  );

  const editorCookie = await getAuthCookie("editor@locotrack.local");
  const editorProjectsRes = await fetch(`${baseUrl}/projects`, {
    headers: { Cookie: editorCookie },
  });
  assert(
    editorProjectsRes.status === 200,
    "Editor visiting /projects returns 200 OK (ALLOWED)"
  );
  const editorProjHtml = await editorProjectsRes.text();
  assert(
    editorProjHtml.includes("Direktori Project") &&
      !editorProjHtml.includes("NEXT_REDIRECT;replace;/unauthorized;307;"),
    "Editor receives actual /projects page without unauthorized redirect"
  );

  // Other project-visible roles
  const smsCookie = await getAuthCookie("sms@locotrack.local");
  const smsProjectsRes = await fetch(`${baseUrl}/projects`, {
    headers: { Cookie: smsCookie },
  });
  assert(smsProjectsRes.status === 200, "SMS visiting /projects returns 200 OK (ALLOWED)");

  const aeCookie = await getAuthCookie("ae@locotrack.local");
  const aeProjectsRes = await fetch(`${baseUrl}/projects`, {
    headers: { Cookie: aeCookie },
  });
  assert(aeProjectsRes.status === 200, "AE visiting /projects returns 200 OK (ALLOWED)");

  const cdCookie = await getAuthCookie("cd@locotrack.local");
  const cdProjectsRes = await fetch(`${baseUrl}/projects`, {
    headers: { Cookie: cdCookie },
  });
  assert(cdProjectsRes.status === 200, "CD visiting /projects returns 200 OK (ALLOWED)");

  // -------------------------------------------------------------
  // Test 4: Route Penetration & Guard Enforcement
  // -------------------------------------------------------------
  console.log("\n4. Route Guard Penetration Tests");
  // Designer -> /approvals (must redirect to /unauthorized)
  const designerApprovalsRes = await fetch(`${baseUrl}/approvals`, {
    headers: { Cookie: designerCookie },
  });
  const designerApprovalsHtml = await designerApprovalsRes.text();
  assert(
    designerApprovalsHtml.includes("NEXT_REDIRECT;replace;/unauthorized;307;") ||
      designerApprovalsRes.status === 307,
    "Designer -> /approvals triggers server guard redirect to /unauthorized (DENIED)"
  );

  // Editor -> /team (must redirect to /unauthorized)
  const editorTeamRes = await fetch(`${baseUrl}/team`, {
    headers: { Cookie: editorCookie },
  });
  const editorTeamHtml = await editorTeamRes.text();
  assert(
    editorTeamHtml.includes("NEXT_REDIRECT;replace;/unauthorized;307;") ||
      editorTeamRes.status === 307,
    "Editor -> /team triggers server guard redirect to /unauthorized (DENIED)"
  );

  // AE -> /users (must redirect to /unauthorized)
  const aeUsersRes = await fetch(`${baseUrl}/users`, {
    headers: { Cookie: aeCookie },
  });
  const aeUsersHtml = await aeUsersRes.text();
  assert(
    aeUsersHtml.includes("NEXT_REDIRECT;replace;/unauthorized;307;") ||
      aeUsersRes.status === 307,
    "AE -> /users triggers server guard redirect to /unauthorized (DENIED)"
  );

  // SMS -> /users (must redirect to /unauthorized)
  const smsUsersRes = await fetch(`${baseUrl}/users`, {
    headers: { Cookie: smsCookie },
  });
  const smsUsersHtml = await smsUsersRes.text();
  assert(
    smsUsersHtml.includes("NEXT_REDIRECT;replace;/unauthorized;307;") ||
      smsUsersRes.status === 307,
    "SMS -> /users triggers server guard redirect to /unauthorized (DENIED)"
  );

  // CD -> /approvals (must be 200 OK)
  const cdApprovalsRes = await fetch(`${baseUrl}/approvals`, {
    headers: { Cookie: cdCookie },
  });
  const cdApprovalsHtml = await cdApprovalsRes.text();
  assert(
    cdApprovalsRes.status === 200 &&
      !cdApprovalsHtml.includes("NEXT_REDIRECT;replace;/unauthorized;307;"),
    "CD -> /approvals returns 200 OK (ALLOWED)"
  );

  // AE -> /team (must be 200 OK)
  const aeTeamRes = await fetch(`${baseUrl}/team`, {
    headers: { Cookie: aeCookie },
  });
  const aeTeamHtml = await aeTeamRes.text();
  assert(
    aeTeamRes.status === 200 &&
      !aeTeamHtml.includes("NEXT_REDIRECT;replace;/unauthorized;307;"),
    "AE -> /team returns 200 OK (ALLOWED)"
  );

  // -------------------------------------------------------------
  // Test 5: Responsive Shell & Accessibility HTML Inspection
  // -------------------------------------------------------------
  console.log("\n5. Responsive Shell & Accessibility Layout Inspection");
  const sampleDashboard = await fetch(`${baseUrl}/dashboard`, {
    headers: { Cookie: designerCookie },
  });
  const dashHtml = await sampleDashboard.text();

  // Desktop sidebar checks
  assert(
    dashHtml.includes("aside") &&
      dashHtml.includes("hidden md:flex md:w-60 md:flex-col md:shrink-0") &&
      dashHtml.includes("aria-label=\"Sidebar Navigasi\""),
    "Desktop sidebar has responsive breakpoint (hidden md:flex), 240px width (w-60), and aria-label"
  );

  // Mobile navigation trigger checks
  assert(
    dashHtml.includes("md:hidden") &&
      dashHtml.includes("h-11 w-11") &&
      dashHtml.includes("aria-label=\"Buka menu navigasi\""),
    "Mobile menu trigger is hidden on desktop (md:hidden), has >=44px touch target (h-11 w-11), and accessible label"
  );

  // Mobile navigation drawer touch ergonomics
  const mobileNavSrc = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/layout/mobile-navigation.tsx"),
    "utf-8"
  );
  assert(
    mobileNavSrc.includes("min-h-[44px]"),
    "Mobile navigation drawer source enforces minimum 44px touch targets (min-h-[44px])"
  );

  // User menu accessibility
  assert(
    dashHtml.includes("aria-label=\"Menu pengguna\""),
    "UserMenu trigger has explicit accessible aria-label"
  );

  // Viewport meta tag
  assert(
    dashHtml.includes("name=\"viewport\" content=\"width=device-width, initial-scale=1\""),
    "Viewport meta tag configured for responsive mobile rendering"
  );

  // Layout containment (zero horizontal overflow)
  assert(
    dashHtml.includes("min-w-0") && dashHtml.includes("overflow-y-auto"),
    "Main layout column uses min-w-0 containment and vertical overflow isolation"
  );

  // Focus ring styling
  assert(
    dashHtml.includes("focus-visible:ring-2") &&
      dashHtml.includes("focus-visible:ring-ring"),
    "Interactive links and controls include visible WCAG focus rings"
  );

  // Role navigation presence for Designer (Activity removed from sidebar)
  assert(
    dashHtml.includes("href=\"/tasks\"") &&
      dashHtml.includes("href=\"/projects\"") &&
      !dashHtml.includes("href=\"/activity\"") &&
      !dashHtml.includes("href=\"/users\"") &&
      !dashHtml.includes("href=\"/approvals\""),
    "Designer shell contains Tasks, Projects, and excludes Activity, Users, Approvals"
  );

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log("\n=============================================");
  console.log(`SMOKE TESTS PASSED: ${passedCount}`);
  console.log(`SMOKE TESTS FAILED: ${failedCount}`);
  console.log("=============================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSmokeTests().catch((err) => {
  console.error("Smoke tests failed with uncaught exception:", err);
  process.exit(1);
});
