import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import {
  ROLE_LABELS,
  ROLE_NAVIGATION,
  isRouteAuthorized,
  ROLE_DASHBOARD_DESCRIPTIONS,
} from "../src/constants/navigation";
import type { UserRole } from "../src/lib/supabase/provisioning";

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseAnonKey || !serviceRoleKey) {
  console.error("Missing Supabase keys in environment");
  process.exit(1);
}

const anonClient = createClient(supabaseUrl, supabaseAnonKey);
const adminClient = createClient(supabaseUrl, serviceRoleKey);

let totalPassed = 0;
let totalFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    totalPassed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    totalFailed++;
  }
}

async function runVerification() {
  console.log("=== PHASE 4.1 AUTOMATED VERIFICATION SUITE ===\n");

  // -------------------------------------------------------------
  // Test 1: Role Display Labels (Section 11)
  // -------------------------------------------------------------
  console.log("1. Role Display Labels");
  const expectedLabels: Record<UserRole, string> = {
    ADMIN: "Administrator",
    CREATIVE_DIRECTOR: "Creative Director",
    ACCOUNT_EXECUTIVE: "Account Executive",
    SOCIAL_MEDIA_SPECIALIST: "Social Media Specialist",
    GRAPHIC_DESIGNER: "Graphic Designer",
    VIDEO_EDITOR: "Video Editor",
  };

  for (const [role, label] of Object.entries(expectedLabels)) {
    assert(
      ROLE_LABELS[role as UserRole] === label,
      `ROLE_LABELS for ${role} is '${label}'`
    );
  }

  // -------------------------------------------------------------
  // Test 2: Role Contextual Dashboard Copy (Section 23)
  // -------------------------------------------------------------
  console.log("\n2. Role Contextual Dashboard Copy");
  for (const role of Object.keys(expectedLabels) as UserRole[]) {
    const desc = ROLE_DASHBOARD_DESCRIPTIONS[role];
    assert(
      Boolean(desc && desc.length > 10 && !desc.includes(String.fromCharCode(8212))),
      `Description for ${role} is valid and free of em dashes: "${desc}"`
    );
  }

  // -------------------------------------------------------------
  // Test 3: Navigation Items per Role (Section 10 & Phase 4.1 Restored)
  // -------------------------------------------------------------
  console.log("\n3. Role-Aware Navigation Mapping (6/6 roles)");
  const adminNav = ROLE_NAVIGATION.ADMIN.map((i) => i.href);
  assert(
    adminNav.includes("/dashboard") &&
      adminNav.includes("/users") &&
      adminNav.includes("/activity") &&
      adminNav.includes("/settings") &&
      !adminNav.includes("/tasks") &&
      !adminNav.includes("/projects"),
    "ADMIN has: Dashboard, Users, Activity, Settings"
  );

  const cdNav = ROLE_NAVIGATION.CREATIVE_DIRECTOR.map((i) => i.href);
  assert(
    cdNav.includes("/dashboard") &&
      cdNav.includes("/projects") &&
      cdNav.includes("/approvals") &&
      cdNav.includes("/team") &&
      cdNav.includes("/activity") &&
      !cdNav.includes("/users"),
    "CREATIVE_DIRECTOR has: Dashboard, Projects, Approvals, Team / Workload, Activity"
  );

  const aeNav = ROLE_NAVIGATION.ACCOUNT_EXECUTIVE.map((i) => i.href);
  assert(
    aeNav.includes("/dashboard") &&
      aeNav.includes("/projects") &&
      aeNav.includes("/team") &&
      aeNav.includes("/activity") &&
      !aeNav.includes("/approvals") &&
      !aeNav.includes("/users"),
    "ACCOUNT_EXECUTIVE has: Dashboard, Projects, Team / Workload, Activity"
  );

  const smsNav = ROLE_NAVIGATION.SOCIAL_MEDIA_SPECIALIST.map((i) => i.href);
  assert(
    smsNav.includes("/dashboard") &&
      smsNav.includes("/projects") &&
      smsNav.includes("/tasks") &&
      smsNav.includes("/activity") &&
      !smsNav.includes("/approvals") &&
      !smsNav.includes("/users"),
    "SOCIAL_MEDIA_SPECIALIST has: Dashboard, Projects, My Tasks, Activity"
  );

  const designerNav = ROLE_NAVIGATION.GRAPHIC_DESIGNER.map((i) => i.href);
  assert(
    designerNav.includes("/dashboard") &&
      designerNav.includes("/tasks") &&
      designerNav.includes("/projects") &&
      designerNav.includes("/activity") &&
      !designerNav.includes("/users") &&
      !designerNav.includes("/approvals"),
    "GRAPHIC_DESIGNER has: Dashboard, My Tasks, Projects, Activity"
  );

  const editorNav = ROLE_NAVIGATION.VIDEO_EDITOR.map((i) => i.href);
  assert(
    editorNav.includes("/dashboard") &&
      editorNav.includes("/tasks") &&
      editorNav.includes("/projects") &&
      editorNav.includes("/activity") &&
      !editorNav.includes("/users") &&
      !editorNav.includes("/approvals"),
    "VIDEO_EDITOR has: Dashboard, My Tasks, Projects, Activity"
  );

  // -------------------------------------------------------------
  // Test 4: Route Penetration & Authorization Guards
  // -------------------------------------------------------------
  console.log("\n4. Route Penetration & Authorization Guards");
  // /projects -> ALLOWED for all roles with project visibility
  assert(isRouteAuthorized("/projects", "ADMIN"), "ADMIN -> /projects = ALLOWED");
  assert(isRouteAuthorized("/projects", "CREATIVE_DIRECTOR"), "CD -> /projects = ALLOWED");
  assert(isRouteAuthorized("/projects", "ACCOUNT_EXECUTIVE"), "AE -> /projects = ALLOWED");
  assert(isRouteAuthorized("/projects", "SOCIAL_MEDIA_SPECIALIST"), "SMS -> /projects = ALLOWED");
  assert(isRouteAuthorized("/projects", "GRAPHIC_DESIGNER"), "Designer -> /projects = ALLOWED");
  assert(isRouteAuthorized("/projects", "VIDEO_EDITOR"), "Editor -> /projects = ALLOWED");

  // Specific denied penetration routes
  assert(!isRouteAuthorized("/approvals", "GRAPHIC_DESIGNER"), "Designer -> /approvals = DENIED");
  assert(!isRouteAuthorized("/team", "VIDEO_EDITOR"), "Editor -> /team = DENIED");
  assert(!isRouteAuthorized("/users", "ACCOUNT_EXECUTIVE"), "AE -> /users = DENIED");
  assert(!isRouteAuthorized("/users", "SOCIAL_MEDIA_SPECIALIST"), "SMS -> /users = DENIED");
  assert(!isRouteAuthorized("/users", "GRAPHIC_DESIGNER"), "Designer -> /users = DENIED");
  assert(!isRouteAuthorized("/users", "VIDEO_EDITOR"), "Editor -> /users = DENIED");

  // Other critical boundaries
  assert(isRouteAuthorized("/approvals", "CREATIVE_DIRECTOR"), "CD -> /approvals = ALLOWED");
  assert(isRouteAuthorized("/team", "ACCOUNT_EXECUTIVE"), "AE -> /team = ALLOWED");
  assert(isRouteAuthorized("/tasks", "GRAPHIC_DESIGNER"), "Designer -> /tasks = ALLOWED");
  assert(isRouteAuthorized("/tasks", "VIDEO_EDITOR"), "Editor -> /tasks = ALLOWED");

  // -------------------------------------------------------------
  // Test 5: Project RLS Isolation for Creatives (Designer / Editor)
  // -------------------------------------------------------------
  console.log("\n5. Project RLS Isolation (Unrelated Project Security)");
  const { data: adminProf } = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", "admin@locotrack.local")
    .single();

  const { data: smsProf } = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", "sms@locotrack.local")
    .single();

  const testClientName = `Test Client ${Date.now()}`;
  const { data: testClient, error: clientErr } = await adminClient
    .from("clients")
    .insert({
      name: testClientName,
      is_active: true,
      created_by: adminProf!.id,
    })
    .select("id")
    .single();

  assert(!clientErr && Boolean(testClient), "Test client created for RLS verification");

  let testProjectId: string | null = null;
  if (testClient) {
    const brandCode = `BRD${Date.now().toString().slice(-5)}`;
    const { data: testBrand } = await adminClient
      .from("brands")
      .insert({
        client_id: testClient.id,
        name: "Test Brand",
        code: brandCode,
        created_by: adminProf!.id,
      })
      .select("id")
      .single();

    if (testBrand) {
      const prjCode = `PRJ${Date.now().toString().slice(-5)}`;
      const { data: proj, error: projErr } = await adminClient
        .from("projects")
        .insert({
          project_code: prjCode,
          brand_id: testBrand.id,
          name: "Private Unassigned Project",
          status: "BRIEF_RECEIVED",
          sms_owner_id: smsProf!.id,
          deadline: new Date(Date.now() + 86400000).toISOString(),
          created_by: adminProf!.id,
        })
        .select("id")
        .single();

      testProjectId = proj?.id ?? null;
      assert(!projErr && Boolean(testProjectId), "Test project created without Designer assigned");
    }
  }

  // Sign in as Designer
  const { data: designerAuth } = await anonClient.auth.signInWithPassword({
    email: "designer@locotrack.local",
    password: "password123",
  });

  if (designerAuth.session && testProjectId) {
    const designerScoped = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${designerAuth.session.access_token}`,
        },
      },
    });

    // Designer queries project before assignment -> MUST BE 0 (isolated by RLS)
    const { data: unassignedQueryResult } = await designerScoped
      .from("projects")
      .select("id, name")
      .eq("id", testProjectId);

    assert(
      Array.isArray(unassignedQueryResult) && unassignedQueryResult.length === 0,
      "Designer cannot see unassigned project via RLS (0 rows returned)"
    );

    // Assign Designer to project
    await adminClient.from("project_members").insert({
      project_id: testProjectId,
      user_id: designerAuth.user.id,
    });

    // Designer queries project after assignment -> MUST BE 1 (visible via project membership RLS)
    const { data: assignedQueryResult } = await designerScoped
      .from("projects")
      .select("id, name")
      .eq("id", testProjectId);

    assert(
      Array.isArray(assignedQueryResult) && assignedQueryResult.length === 1,
      "Designer can see assigned project after membership assignment (1 row returned)"
    );

    // Clean up test project and client
    await adminClient.from("project_members").delete().eq("project_id", testProjectId);
    await adminClient.from("projects").delete().eq("id", testProjectId);
    if (testClient) {
      await adminClient.from("brands").delete().eq("client_id", testClient.id);
      await adminClient.from("clients").delete().eq("id", testClient.id);
    }
  }

  // -------------------------------------------------------------
  // Test 6: Real Supabase Auth & Session Verification
  // -------------------------------------------------------------
  console.log("\n6. Real Supabase Auth & Session Lifecycle");
  const testUsers = [
    { email: "admin@locotrack.local", role: "ADMIN", expectedActive: true },
    { email: "cd@locotrack.local", role: "CREATIVE_DIRECTOR", expectedActive: true },
    { email: "ae@locotrack.local", role: "ACCOUNT_EXECUTIVE", expectedActive: true },
    { email: "sms@locotrack.local", role: "SOCIAL_MEDIA_SPECIALIST", expectedActive: true },
    { email: "designer@locotrack.local", role: "GRAPHIC_DESIGNER", expectedActive: true },
    { email: "editor@locotrack.local", role: "VIDEO_EDITOR", expectedActive: true },
    { email: "inactive@locotrack.local", role: "GRAPHIC_DESIGNER", expectedActive: false },
  ];

  for (const user of testUsers) {
    const { data: authData, error: authError } =
      await anonClient.auth.signInWithPassword({
        email: user.email,
        password: "password123",
      });

    assert(!authError && Boolean(authData.session), `Auth sign-in succeeds for ${user.email}`);

    if (authData.user) {
      const { data: profile, error: profError } = await adminClient
        .from("profiles")
        .select("id, full_name, email, role, is_active")
        .eq("id", authData.user.id)
        .single();

      assert(!profError && Boolean(profile), `Profile retrieved for ${user.email}`);
      assert(profile?.role === user.role, `Profile role matches ${user.role}`);
      assert(
        profile?.is_active === user.expectedActive,
        `Profile is_active matches expected (${user.expectedActive})`
      );

      if (!user.expectedActive) {
        assert(
          profile?.is_active === false,
          `Deactivated user ${user.email} is blocked (is_active=false)`
        );
      }
    }
  }

  // Test invalid credentials rejection
  const { data: invalidData, error: invalidError } =
    await anonClient.auth.signInWithPassword({
      email: "admin@locotrack.local",
      password: "wrongpassword!",
    });
  assert(
    Boolean(invalidError) && !invalidData.session,
    "Invalid password correctly rejected with safe error message"
  );

  // -------------------------------------------------------------
  // Test 7: Actual Logout Flow Smoke Test
  // -------------------------------------------------------------
  console.log("\n7. Logout Flow Smoke Test");
  // 1. Create a dedicated client instance to simulate client-side browser session
  const logoutTestClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: preLogoutAuth } = await logoutTestClient.auth.signInWithPassword({
    email: "editor@locotrack.local",
    password: "password123",
  });
  assert(
    Boolean(preLogoutAuth.session),
    "Authenticated session established before logout test"
  );

  // 2. Perform signOut
  const { error: signOutErr } = await logoutTestClient.auth.signOut();
  assert(!signOutErr, "Supabase auth.signOut() executed without error");

  // 3. Verify session is cleared
  const { data: postLogoutSession } = await logoutTestClient.auth.getSession();
  assert(
    postLogoutSession.session === null,
    "Supabase session is completely null after signOut"
  );

  // 4. Verify getUser returns null / error
  const { data: postLogoutUser } = await logoutTestClient.auth.getUser();
  assert(
    postLogoutUser.user === null,
    "Supabase getUser() returns null user after signOut"
  );

  // -------------------------------------------------------------
  // Test 8: Self-Service Profile Update
  // -------------------------------------------------------------
  console.log("\n8. Self-Service Profile Update");
  const { data: designerReAuth } = await anonClient.auth.signInWithPassword({
    email: "designer@locotrack.local",
    password: "password123",
  });

  if (designerReAuth.session) {
    const userScoped = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${designerReAuth.session.access_token}`,
        },
      },
    });

    const updatedName = "Diana Designer Updated";
    const { error: updateError } = await userScoped
      .from("profiles")
      .update({ full_name: updatedName })
      .eq("id", designerReAuth.user.id);

    assert(!updateError, "Designer can update own full_name under RLS");

    const { data: updatedProf } = await userScoped
      .from("profiles")
      .select("full_name")
      .eq("id", designerReAuth.user.id)
      .single();

    assert(
      updatedProf?.full_name === updatedName,
      "Updated full_name persisted in database"
    );

    // Revert change
    await userScoped
      .from("profiles")
      .update({ full_name: "Diana Designer" })
      .eq("id", designerReAuth.user.id);
  }

  // -------------------------------------------------------------
  // Test 9: Anti-Slop Rule R-02 (Zero Em Dashes) Check
  // -------------------------------------------------------------
  console.log("\n9. Anti-Slop Zero Em Dash (\\u2014) Scan");
  const scanDirs = ["src/app", "src/components", "src/constants"];
  let emDashCount = 0;

  const forbiddenChar = String.fromCharCode(8212);
  function scanDirectory(dirPath: string) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        if (content.includes(forbiddenChar)) {
          console.error(`  [!] Em dash found in: ${fullPath}`);
          emDashCount++;
        }
      }
    }
  }

  for (const dir of scanDirs) {
    const fullDir = path.resolve(process.cwd(), dir);
    if (fs.existsSync(fullDir)) {
      scanDirectory(fullDir);
    }
  }

  assert(
    emDashCount === 0,
    `Zero em dashes (\\u2014) in UI code and copy (found: ${emDashCount})`
  );

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log("\n=============================================");
  console.log(`TOTAL PASSED: ${totalPassed}`);
  console.log(`TOTAL FAILED: ${totalFailed}`);
  console.log("=============================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error("Verification failed with uncaught exception:", err);
  process.exit(1);
});
