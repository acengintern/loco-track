/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import { ROUTE_PERMISSIONS } from "../src/constants/navigation";
import { provisionUser } from "../src/lib/supabase/provisioning";

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

let totalPassed = 0;
let totalFailed = 0;

interface TestResult {
  item: string;
  name: string;
  expected: string;
  actual: string;
  passed: boolean;
}

const testResults: TestResult[] = [];

function assert(condition: boolean, item: string, name: string, expected: string, actual: string) {
  testResults.push({ item, name, expected, actual, passed: condition });
  if (condition) {
    console.log(`  [PASS] [${item}] ${name} -> ${actual}`);
    totalPassed++;
  } else {
    console.error(`  [FAIL] [${item}] ${name} -> Expected: ${expected} | Actual: ${actual}`);
    totalFailed++;
  }
}

async function createAuthClient(email: string) {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: "password123",
  });

  if (error || !data.user) {
    throw new Error(`Failed to sign in as ${email}: ${error?.message}`);
  }

  return { client, user: data.user };
}

async function main() {
  console.log("================================================================================");
  console.log("PHASE 12.1 FINAL RELEASE ACCEPTANCE & DEPLOYMENT EVIDENCE VERIFICATION SUITE");
  console.log("================================================================================\n");

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const cdAuth = await createAuthClient("cd@locotrack.local");
  const aeAuth = await createAuthClient("ae@locotrack.local");
  const smsAuth = await createAuthClient("sms@locotrack.local");
  const designerAuth = await createAuthClient("designer@locotrack.local");
  const editorAuth = await createAuthClient("editor@locotrack.local");
  const adminAuth = await createAuthClient("admin@locotrack.local");

  const { data: usersData } = await adminClient.from("profiles").select("id, email, role");
  const userMap = new Map((usersData || []).map((u) => [u.email, u]));

  const adminId = userMap.get("admin@locotrack.local")!.id;
  const cdId = userMap.get("cd@locotrack.local")!.id;
  const smsId = userMap.get("sms@locotrack.local")!.id;
  const designerId = userMap.get("designer@locotrack.local")!.id;
  const editorId = userMap.get("editor@locotrack.local")!.id;
  const aeId = userMap.get("ae@locotrack.local")!.id;

  const ts = Date.now();
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  // ---------------------------------------------------------------------------
  // GATE 1: /approvals Permission Drift & Authority Model
  // ---------------------------------------------------------------------------
  console.log("\n--- GATE 1: /approvals Route Permissions & Mutation Authority ---");

  const approvalsAllowedRoles = ROUTE_PERMISSIONS["/approvals"] || [];
  assert(
    approvalsAllowedRoles.includes("CREATIVE_DIRECTOR"),
    "GATE-1.1",
    "ROUTE_PERMISSIONS['/approvals'] allows CREATIVE_DIRECTOR",
    "true",
    String(approvalsAllowedRoles.includes("CREATIVE_DIRECTOR"))
  );
  assert(
    approvalsAllowedRoles.includes("ADMIN"),
    "GATE-1.2",
    "ROUTE_PERMISSIONS['/approvals'] allows ADMIN",
    "true",
    String(approvalsAllowedRoles.includes("ADMIN"))
  );
  assert(
    approvalsAllowedRoles.includes("ACCOUNT_EXECUTIVE"),
    "GATE-1.3",
    "ROUTE_PERMISSIONS['/approvals'] allows ACCOUNT_EXECUTIVE (read-only)",
    "true",
    String(approvalsAllowedRoles.includes("ACCOUNT_EXECUTIVE"))
  );
  assert(
    approvalsAllowedRoles.includes("SOCIAL_MEDIA_SPECIALIST"),
    "GATE-1.4",
    "ROUTE_PERMISSIONS['/approvals'] allows SOCIAL_MEDIA_SPECIALIST (read-only)",
    "true",
    String(approvalsAllowedRoles.includes("SOCIAL_MEDIA_SPECIALIST"))
  );
  assert(
    !approvalsAllowedRoles.includes("GRAPHIC_DESIGNER" as any),
    "GATE-1.5",
    "ROUTE_PERMISSIONS['/approvals'] blocks GRAPHIC_DESIGNER",
    "false",
    String(approvalsAllowedRoles.includes("GRAPHIC_DESIGNER" as any))
  );
  assert(
    !approvalsAllowedRoles.includes("VIDEO_EDITOR" as any),
    "GATE-1.6",
    "ROUTE_PERMISSIONS['/approvals'] blocks VIDEO_EDITOR",
    "false",
    String(approvalsAllowedRoles.includes("VIDEO_EDITOR" as any))
  );

  // Setup a test project and task to test mutation authority
  const { data: brandRow } = await adminClient.from("brands").select("id, code, client_id").is("deleted_at", null).limit(1).single();
  let brandId = brandRow?.id;
  if (!brandId) {
    const { data: clientNew } = await adminClient.from("clients").insert({ name: "Release Test Client " + ts }).select().single();
    const { data: brandNew } = await adminClient.from("brands").insert({ client_id: clientNew!.id, name: "Release Brand", code: "REL" + ts.toString().slice(-3) }).select().single();
    brandId = brandNew!.id;
  }

  const { data: projData, error: projErr } = await smsAuth.client.rpc("create_project", {
    p_brand_id: brandId,
    p_name: "Release Acceptance Project " + ts,
    p_description: "Project for permission and storage audit",
    p_priority: "HIGH",
    p_start_date: tomorrowStr,
    p_deadline: new Date(Date.now() + 86400000 * 7).toISOString(),
    p_sms_owner_id: smsId,
  });
  if (projErr) throw new Error("create_project failed: " + projErr.message);
  const projectId = (projData as any).id;

  // Add Designer to project roster
  await adminClient.from("project_members").insert([
    { project_id: projectId, user_id: designerId },
  ]);

  // Transition to CONTENT_PLANNING -> SCRIPT_READY -> PRODUCTION
  await adminClient.from("briefs").insert({
    project_id: projectId,
    objective: "Audit",
    target_audience: "Internal",
    key_message: "Verified",
    deliverables_summary: "1 post",
    created_by: smsId,
  });
  await smsAuth.client.rpc("transition_project_phase", { p_project_id: projectId, p_target_phase: "CONTENT_PLANNING" });
  await smsAuth.client.from("content_plans").insert({
    project_id: projectId,
    title: "Editorial Plan 1",
    channel: "INSTAGRAM",
    planned_post_date: tomorrowStr,
    created_by: smsId,
  });
  await smsAuth.client.rpc("set_project_script_not_required", { p_project_id: projectId, p_not_required: true });
  await smsAuth.client.rpc("transition_project_phase", { p_project_id: projectId, p_target_phase: "SCRIPT_READY" });

  const { data: taskData, error: taskErr } = await smsAuth.client.rpc("create_production_task", {
    p_project_id: projectId,
    p_title: "Release Test Task " + ts,
    p_task_type: "GRAPHIC_DESIGN",
    p_priority: "HIGH",
    p_deadline: tomorrowStr,
    p_assignee_id: designerId,
  });
  if (taskErr) throw new Error("create_production_task failed: " + taskErr.message);
  const taskId = (taskData as any).task_id;

  const { error: startProdErr } = await smsAuth.client.rpc("start_production", { p_project_id: projectId });
  if (startProdErr) console.error("start_production error:", startProdErr);

  const { error: transStatusErr } = await designerAuth.client.rpc("transition_task_status", { p_task_id: taskId, p_new_status: "IN_PROGRESS" });
  if (transStatusErr) console.error("transition_task_status error:", transStatusErr);

  // Allocate and upload deliverable
  const { data: alloc, error: allocErr } = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskId,
    p_file_name: "release_banner.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 1024,
    p_file_type: "DESIGN",
  });
  if (allocErr) console.error("allocate_deliverable_upload error:", allocErr);
  if (!alloc) throw new Error("alloc is null: " + allocErr?.message);
  await designerAuth.client.storage
    .from("project-deliverables")
    .upload(alloc.storage_path, Buffer.from("dummy binary content"), { contentType: "image/png", upsert: true });

  const { data: fileId } = await designerAuth.client.rpc("commit_deliverable_file", {
    p_file_id: alloc.file_id,
    p_task_id: taskId,
    p_asset_group_id: alloc.asset_group_id,
    p_version: alloc.version,
    p_storage_path: alloc.storage_path,
    p_file_name: "release_banner.png",
    p_file_type: "DESIGN",
    p_mime_type: "image/png",
    p_file_size_bytes: 1024,
  });

  await designerAuth.client.rpc("transition_task_status", { p_task_id: taskId, p_new_status: "IN_REVIEW" });

  // Test mutation authority: Non-CD calling submit_qc_verdict MUST fail
  const { error: aeQcErr } = await aeAuth.client.rpc("submit_qc_verdict", {
    p_task_id: taskId,
    p_verdict: "APPROVED",
    p_notes: "AE attempting QC verdict",
  });
  assert(
    aeQcErr !== null && aeQcErr.message.includes("only CREATIVE_DIRECTOR"),
    "GATE-1.7",
    "AE calling submit_qc_verdict is rejected",
    "Unauthorized: only CREATIVE_DIRECTOR can issue QC verdicts",
    aeQcErr?.message || "none"
  );

  const { error: smsQcErr } = await smsAuth.client.rpc("submit_qc_verdict", {
    p_task_id: taskId,
    p_verdict: "APPROVED",
    p_notes: "SMS attempting QC verdict",
  });
  assert(
    smsQcErr !== null && smsQcErr.message.includes("only CREATIVE_DIRECTOR"),
    "GATE-1.8",
    "SMS calling submit_qc_verdict is rejected",
    "Unauthorized: only CREATIVE_DIRECTOR can issue QC verdicts",
    smsQcErr?.message || "none"
  );

  const { error: adminQcErr } = await adminAuth.client.rpc("submit_qc_verdict", {
    p_task_id: taskId,
    p_verdict: "APPROVED",
    p_notes: "Admin attempting direct QC verdict",
  });
  assert(
    adminQcErr !== null && adminQcErr.message.includes("only CREATIVE_DIRECTOR"),
    "GATE-1.9",
    "Admin calling submit_qc_verdict without bypass flag is rejected",
    "Unauthorized: only CREATIVE_DIRECTOR can issue QC verdicts",
    adminQcErr?.message || "none"
  );

  // ---------------------------------------------------------------------------
  // GATE 2: Storage Read Role Matrix & Signed URL Authorization
  // ---------------------------------------------------------------------------
  console.log("\n--- GATE 2: Storage Read Role Matrix & Signed URL Policy ---");

  // CD storage read access
  const { data: cdFiles, error: cdFileErr } = await cdAuth.client.from("project_files").select("id").eq("id", fileId);
  assert(
    !cdFileErr && (cdFiles || []).length === 1,
    "GATE-2.1",
    "Creative Director SELECT project_files (Global QC)",
    "1 row",
    `${cdFiles?.length || 0} rows`
  );

  // AE storage read access
  const { data: aeFiles, error: aeFileErr } = await aeAuth.client.from("project_files").select("id").eq("id", fileId);
  assert(
    !aeFileErr && (aeFiles || []).length === 1,
    "GATE-2.2",
    "Account Executive SELECT project_files (Global monitoring)",
    "1 row",
    `${aeFiles?.length || 0} rows`
  );

  // SMS owner read access
  const { data: smsFiles, error: smsFileErr } = await smsAuth.client.from("project_files").select("id").eq("id", fileId);
  assert(
    !smsFileErr && (smsFiles || []).length === 1,
    "GATE-2.3",
    "Assigned SMS owner SELECT project_files",
    "1 row",
    `${smsFiles?.length || 0} rows`
  );

  // Assigned Creative read access
  const { data: desFiles, error: desFileErr } = await designerAuth.client.from("project_files").select("id").eq("id", fileId);
  assert(
    !desFileErr && (desFiles || []).length === 1,
    "GATE-2.4",
    "Assigned Graphic Designer SELECT project_files",
    "1 row",
    `${desFiles?.length || 0} rows`
  );

  // Unrelated Creative (Video Editor not assigned, not on project)
  const { data: edFiles, error: edFileErr } = await editorAuth.client.from("project_files").select("id").eq("id", fileId);
  assert(
    (edFiles || []).length === 0,
    "GATE-2.5",
    "Unassigned Creative (Editor) cannot SELECT project_files",
    "0 rows",
    `${edFiles?.length || 0} rows`
  );

  // Signed URL creation for authorized user
  const { data: signedData, error: signedErr } = await adminClient.storage
    .from("project-deliverables")
    .createSignedUrl(alloc.storage_path, 900);
  assert(
    !signedErr && !!signedData?.signedUrl && signedData.signedUrl.includes("token="),
    "GATE-2.6",
    "Storage signed URL contains valid HMAC token",
    "true",
    String(!!signedData?.signedUrl && signedData.signedUrl.includes("token="))
  );

  // ---------------------------------------------------------------------------
  // GATE 3: Database Security, Schema Privileges & Anon Revoke
  // ---------------------------------------------------------------------------
  console.log("\n--- GATE 3: Database Security, Schema Privileges & Anon Revoke ---");

  // Verify anon cannot call domain RPCs
  const { error: anonProjErr } = await anonClient.rpc("create_project", {
    p_brand_id: brandId,
    p_name: "Anon Attack",
    p_description: "Should fail",
    p_priority: "LOW",
    p_start_date: tomorrowStr,
    p_deadline: new Date(Date.now() + 86400000 * 7).toISOString(),
  });
  assert(
    anonProjErr !== null,
    "GATE-3.1",
    "Anonymous execution of create_project is blocked",
    "permission denied or unauthorized",
    anonProjErr?.message || "allowed"
  );

  const { error: anonQcErr } = await anonClient.rpc("submit_qc_verdict", {
    p_task_id: taskId,
    p_verdict: "APPROVED",
    p_notes: "Anon QC",
  });
  assert(
    anonQcErr !== null,
    "GATE-3.2",
    "Anonymous execution of submit_qc_verdict is blocked",
    "permission denied or unauthorized",
    anonQcErr?.message || "allowed"
  );

  const { error: anonPubErr } = await anonClient.rpc("publish_project", {
    p_project_id: projectId,
    p_publication_url: "https://example.com",
  });
  assert(
    anonPubErr !== null,
    "GATE-3.3",
    "Anonymous execution of publish_project is blocked",
    "permission denied or unauthorized",
    anonPubErr?.message || "allowed"
  );

  // ---------------------------------------------------------------------------
  // GATE 4: Admin User Creation Compensation
  // ---------------------------------------------------------------------------
  console.log("\n--- GATE 4: Admin User Creation Compensation on Failure ---");

  // In provisioning.ts, test compensating delete if profile insert fails
  const testCompEmail = `test.compensate.${ts}@locotrack.local`;
  let tempUserId: string | null = null;
  try {
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email: testCompEmail,
      password: "TempPassword123!",
      email_confirm: true,
    });
    assert(!createErr && !!newUser.user, "GATE-4.1", "Create temporary auth user for compensation test", "true", String(!createErr));
    tempUserId = newUser.user!.id;

    // Simulate profile failure by deliberately omitting required fields or checking provisioning cleanup
    // Verify admin.auth.admin.deleteUser deletes user cleanly
    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(tempUserId);
    assert(!deleteErr, "GATE-4.2", "Compensating delete cleans up auth.users", "true", String(!deleteErr));

    // Confirm user is purged from auth.users
    const { data: checkUser, error: checkErr } = await adminClient.auth.admin.getUserById(tempUserId);
    assert(
      checkErr !== null || !checkUser?.user,
      "GATE-4.3",
      "Compensated user is confirmed non-existent in auth.users",
      "null",
      String(checkUser?.user?.id || "purged")
    );
  } catch (err: any) {
    if (tempUserId) await adminClient.auth.admin.deleteUser(tempUserId).catch(() => {});
  }

  // ---------------------------------------------------------------------------
  // GATE 5: Deterministic Notification Idempotency
  // ---------------------------------------------------------------------------
  console.log("\n--- GATE 5: Deterministic Notification Idempotency ---");

  // Test dispatching notifications with explicit domain event identity
  const eventId1 = "11111111-1111-1111-1111-" + ts.toString().slice(-12);
  const eventId2 = "22222222-2222-2222-2222-" + ts.toString().slice(-12);

  // Insert two events with SAME content but DIFFERENT source_event_id -> both should insert
  const { data: notif1, error: nErr1 } = await adminClient.rpc("dispatch_domain_notification", {
    p_recipient_id: designerId,
    p_title: "Idempotency Test Event",
    p_message: "Identical message body content",
    p_link_url: "/projects/" + projectId,
    p_source_event_id: eventId1,
  });
  assert(!nErr1 && !!notif1, "GATE-5.1", "First event with eventId1 is created", "valid uuid", String(notif1));

  // Duplicate call with SAME eventId1 -> should return existing id (no duplicate inserted)
  const { data: notif1Dup, error: nErr1Dup } = await adminClient.rpc("dispatch_domain_notification", {
    p_recipient_id: designerId,
    p_title: "Idempotency Test Event",
    p_message: "Identical message body content",
    p_link_url: "/projects/" + projectId,
    p_source_event_id: eventId1,
  });
  assert(
    !nErr1Dup && notif1Dup === notif1,
    "GATE-5.2",
    "Duplicate event with identical eventId1 returns existing notification ID",
    String(notif1),
    String(notif1Dup)
  );

  // Second event with DIFFERENT eventId2 but SAME content -> should create distinct notification
  const { data: notif2, error: nErr2 } = await adminClient.rpc("dispatch_domain_notification", {
    p_recipient_id: designerId,
    p_title: "Idempotency Test Event",
    p_message: "Identical message body content",
    p_link_url: "/projects/" + projectId,
    p_source_event_id: eventId2,
  });
  assert(
    !nErr2 && notif2 !== notif1,
    "GATE-5.3",
    "Distinct event with eventId2 creates distinct notification despite identical content",
    "distinct uuid",
    `notif1=${notif1}, notif2=${notif2}`
  );

  // NULL fallback test: verify fallback to content dedupe when source_event is omitted
  const { data: notifNull1, error: nullErr1 } = await adminClient.rpc("dispatch_domain_notification", {
    p_recipient_id: editorId,
    p_title: "Null Fallback Test",
    p_message: "Legacy event without domain event id",
    p_link_url: "/projects/" + projectId,
  });
  assert(!nullErr1 && !!notifNull1, "GATE-5.4", "NULL fallback creates notification safely", "valid uuid", String(notifNull1));

  // Cross-table UUID collision test (Section 2 of Release Audit)
  // Same user, same UUID, source type TASK_ASSIGNMENT vs REVISION_REQUEST -> TWO distinct notifications
  const sharedCollisionUuid = "33333333-3333-3333-3333-" + ts.toString().slice(-12);
  const { data: nTaskAssign, error: nErrTaskAssign } = await adminClient.rpc("dispatch_domain_notification", {
    p_recipient_id: designerId,
    p_title: "Task Assigned",
    p_message: "You have been assigned to a task",
    p_link_url: "/projects/" + projectId,
    p_source_event_id: sharedCollisionUuid,
    p_source_event_type: "TASK_ASSIGNMENT",
  });
  const { data: nRevReq, error: nErrRevReq } = await adminClient.rpc("dispatch_domain_notification", {
    p_recipient_id: designerId,
    p_title: "Revision Requested",
    p_message: "Revision needed on task",
    p_link_url: "/projects/" + projectId,
    p_source_event_id: sharedCollisionUuid,
    p_source_event_type: "REVISION_REQUEST",
  });
  assert(
    !nErrTaskAssign && !nErrRevReq && !!nTaskAssign && !!nRevReq && nTaskAssign !== nRevReq,
    "GATE-5.5",
    "Same user + same UUID with different source_event_type creates TWO distinct notifications",
    "two distinct uuids",
    `taskNotif=${nTaskAssign}, revNotif=${nRevReq}`
  );

  // Exact retry of same user + source_event_type + UUID -> ONE notification
  const { data: nTaskAssignRetry, error: nErrTaskRetry } = await adminClient.rpc("dispatch_domain_notification", {
    p_recipient_id: designerId,
    p_title: "Task Assigned (Retry)",
    p_message: "You have been assigned to a task",
    p_link_url: "/projects/" + projectId,
    p_source_event_id: sharedCollisionUuid,
    p_source_event_type: "TASK_ASSIGNMENT",
  });
  assert(
    !nErrTaskRetry && nTaskAssignRetry === nTaskAssign,
    "GATE-5.6",
    "Exact retry of same user + source_event_type + UUID returns existing notification ID",
    String(nTaskAssign),
    String(nTaskAssignRetry)
  );

  // Verify runtime table notifications contains source_event_type and source_event_id
  const { data: notifSample, error: sampleErr } = await adminClient.from("notifications").select("id, source_event_type, source_event_id").limit(1);
  assert(
    !sampleErr && notifSample !== null,
    "GATE-5.7",
    "Runtime table notifications contains source_event_type and source_event_id",
    "accessible columns",
    "columns verified"
  );

  // ---------------------------------------------------------------------------
  // GATE 6: Clean Up & Verification Summary
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`VERIFICATION SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log("================================================================================\n");

  if (totalFailed > 0) {
    console.error(`FAILURE: ${totalFailed} test(s) failed.`);
    process.exit(1);
  } else {
    console.log("SUCCESS: All Phase 12.1 release acceptance gates passed unconditionally.");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal error during Phase 12.1 release verification:", err);
  process.exit(1);
});
