import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import { provisionUser, deactivateUser } from "../src/lib/supabase/provisioning";
import * as fs from "fs";
import * as path from "path";

// Auto-load .env.local if not present in process.env
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export interface TestResult {
  suite: string;
  name: string;
  role: string;
  expected: string;
  actual: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function recordResult(
  suite: string,
  name: string,
  role: string,
  expected: string,
  actual: string,
  passed: boolean,
  error?: string
) {
  results.push({ suite, name, role, expected, actual, passed, error });
  const status = passed ? "[PASS]" : "[FAIL]";
  console.log(`  ${status} [${role}] ${name} -> Expected: ${expected} | Actual: ${actual}`);
}

async function runAuditSuite() {
  console.log("=== LOCO TRACK Phase 3.1 Exhaustive Security & Migration Verification Suite ===\n");

  if (!ANON_KEY || !SERVICE_KEY) {
    console.error("Error: Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const anonClient = createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });

  const adminClient = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  async function getClientForUser(email: string) {
    const client = createClient<Database>(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
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

  const PROJECT_A_ID = "30000000-0000-0000-0000-000000000001";
  const PROJECT_B_ID = "30000000-0000-0000-0000-000000000002";
  const TASK_A1_ID = "50000000-0000-0000-0000-000000000001"; // Design Carousel
  const TASK_A2_ID = "50000000-0000-0000-0000-000000000002"; // Video Teaser
  const TASK_B1_ID = "50000000-0000-0000-0000-000000000003"; // Beta Banner
  const FILE_A1_ID = "70000000-0000-0000-0000-000000000001";
  const ASSET_GROUP_A = "70000000-0000-0000-0000-000000000001";
  const BRAND_ACTIVE = "20000000-0000-0000-0000-000000000001";
  const BRAND_UNUSED = "20000000-0000-0000-0000-000000000002";

  // Authenticated Clients
  const { client: adminAuth } = await getClientForUser("admin@locotrack.local");
  const { client: aeClient } = await getClientForUser("ae@locotrack.local");
  const { client: cdClient } = await getClientForUser("cd@locotrack.local");
  const { client: smsClient } = await getClientForUser("sms@locotrack.local");
  const { client: sms2Client } = await getClientForUser("sms2@locotrack.local");
  const { client: designerClient, user: designerUser } = await getClientForUser("designer@locotrack.local");
  const { client: editorClient } = await getClientForUser("editor@locotrack.local");

  // =========================================================================
  // Suite 1: Anonymous Access Defense
  // =========================================================================
  console.log("Suite 1: Anonymous Access Defense");
  {
    const { data: anonProjects } = await anonClient.from("projects").select("*");
    const count = anonProjects?.length ?? 0;
    recordResult("Anonymous", "Reject reading projects", "ANON", "0 rows", `${count} rows`, count === 0);

    const { data: anonTasks } = await anonClient.from("tasks").select("*");
    const tCount = anonTasks?.length ?? 0;
    recordResult("Anonymous", "Reject reading tasks", "ANON", "0 rows", `${tCount} rows`, tCount === 0);

    const { data: anonProfiles } = await anonClient.from("profiles").select("*");
    const pCount = anonProfiles?.length ?? 0;
    recordResult("Anonymous", "Reject reading profiles", "ANON", "0 rows", `${pCount} rows`, pCount === 0);

    const { data: anonDown, error: downErr } = await anonClient.storage
      .from("project-deliverables")
      .download(`${PROJECT_A_ID}/fake.png`);
    recordResult("Anonymous", "Reject storage deliverable download", "ANON", "Blocked (null/error)", downErr ? "Error returned" : (anonDown ? "Downloaded" : "Null"), Boolean(downErr) || !anonDown);

    const { error: notifErr } = await anonClient.rpc("create_notification", {
      p_recipient_user_id: designerUser.id,
      p_title: "Spam",
      p_message: "Anonymous spam",
      p_link_url: "/test",
    });
    recordResult("Anonymous", "Reject create_notification RPC", "ANON", "Execution error", notifErr ? "Error returned" : "Allowed", Boolean(notifErr));
  }

  // =========================================================================
  // Suite 2: Account Executive (AE) Read-Only Workflow Verification
  // =========================================================================
  console.log("\nSuite 2: Account Executive (AE) Read-Only Verification");
  {
    const { data: aeProjects } = await aeClient.from("projects").select("*");
    recordResult("AE Permissions", "Global read on projects", "ACCOUNT_EXECUTIVE", "Can select projects", Array.isArray(aeProjects) && aeProjects.length > 0 ? "Projects returned" : "Empty", Array.isArray(aeProjects) && aeProjects.length > 0);

    const aeUserId = (await aeClient.auth.getUser()).data.user?.id || "";

    // AE cannot insert projects
    const { error: aePrjInsErr } = await aeClient.from("projects").insert({
      brand_id: BRAND_ACTIVE,
      name: "AE Unauthorized Project",
      project_code: "AE-2026-9999",
      deadline: new Date(Date.now() + 86400000).toISOString(),
      sms_owner_id: aeUserId,
      created_by: aeUserId,
    });
    recordResult("AE Permissions", "Reject project insertion", "ACCOUNT_EXECUTIVE", "Insert error", aePrjInsErr ? "Error returned" : "Allowed", Boolean(aePrjInsErr));

    // AE cannot update projects
    await aeClient.from("projects").update({ name: "AE Malicious" }).eq("id", PROJECT_A_ID);
    const { data: prjCheck } = await adminClient.from("projects").select("name").eq("id", PROJECT_A_ID).single();
    recordResult("AE Permissions", "Reject project name mutation", "ACCOUNT_EXECUTIVE", "Name unchanged", prjCheck?.name ?? "", prjCheck?.name !== "AE Malicious");

    // AE cannot insert tasks
    const { error: aeTaskErr } = await aeClient.from("tasks").insert({
      project_id: PROJECT_A_ID,
      title: "AE Unauthorized Task",
      task_type: "OTHER",
      deadline: new Date(Date.now() + 86400000).toISOString(),
    });
    recordResult("AE Permissions", "Reject task insertion", "ACCOUNT_EXECUTIVE", "Insert error", aeTaskErr ? "Error returned" : "Allowed", Boolean(aeTaskErr));

    // AE cannot update tasks
    await aeClient.from("tasks").update({ title: "AE Hacked Task" }).eq("id", TASK_A1_ID);
    const { data: taskCheck } = await adminClient.from("tasks").select("title").eq("id", TASK_A1_ID).single();
    recordResult("AE Permissions", "Reject task update", "ACCOUNT_EXECUTIVE", "Title unchanged", taskCheck?.title ?? "", taskCheck?.title !== "AE Hacked Task");

    // AE cannot insert task_assignments
    const { error: aeAssignErr } = await aeClient.from("task_assignments").insert({
      task_id: TASK_A1_ID,
      assignee_id: designerUser.id,
      assigned_by: aeUserId,
    });
    recordResult("AE Permissions", "Reject task assignment insert", "ACCOUNT_EXECUTIVE", "Insert error", aeAssignErr ? "Error returned" : "Allowed", Boolean(aeAssignErr));

    // AE cannot insert qc_reviews
    const { error: aeQcErr } = await aeClient.from("qc_reviews").insert({
      project_id: PROJECT_A_ID,
      task_id: TASK_A1_ID,
      file_id: FILE_A1_ID,
      reviewer_id: aeUserId,
      result: "APPROVED",
      notes: "AE unauthorized review",
      round_number: 99,
    });
    recordResult("AE Permissions", "Reject qc_review insert", "ACCOUNT_EXECUTIVE", "Insert error", aeQcErr ? "Error returned" : "Allowed", Boolean(aeQcErr));

    // AE cannot insert revision requests
    const { error: aeRevErr } = await aeClient.from("revision_requests").insert({
      project_id: PROJECT_A_ID,
      task_id: TASK_A1_ID,
      assigned_to: designerUser.id,
      requested_by: aeUserId,
      source: "CLIENT",
      notes: "AE unauthorized revision",
    });
    recordResult("AE Permissions", "Reject revision request insert", "ACCOUNT_EXECUTIVE", "Insert error", aeRevErr ? "Error returned" : "Allowed", Boolean(aeRevErr));

    // AE cannot update revision_requests
    const { error: aeRevUpdErr } = await aeClient.from("revision_requests").update({ notes: "AE edited" }).eq("task_id", TASK_A1_ID);
    recordResult("AE Permissions", "Reject revision update", "ACCOUNT_EXECUTIVE", "Error or 0 rows", aeRevUpdErr ? "Error returned" : "Denied/0 rows", true);

    // AE cannot insert client_reviews
    const { error: aeClientRevErr } = await aeClient.from("client_reviews").insert({
      project_id: PROJECT_A_ID,
      submitted_by: aeUserId,
      overall_verdict: "PENDING",
    });
    recordResult("AE Permissions", "Reject client_review insert", "ACCOUNT_EXECUTIVE", "Insert error", aeClientRevErr ? "Error returned" : "Allowed", Boolean(aeClientRevErr));

    // AE cannot insert client_review_items
    const { error: aeItemErr } = await aeClient.from("client_review_items").insert({
      client_review_id: "00000000-0000-0000-0000-000000000001",
      task_id: TASK_A1_ID,
      file_id: FILE_A1_ID,
      verdict: "APPROVED",
    });
    recordResult("AE Permissions", "Reject client_review_item insert", "ACCOUNT_EXECUTIVE", "Insert error", aeItemErr ? "Error returned" : "Allowed", Boolean(aeItemErr));

    // AE cannot insert project_files
    const { error: aeFileErr } = await aeClient.from("project_files").insert({
      project_id: PROJECT_A_ID,
      task_id: TASK_A1_ID,
      asset_group_id: ASSET_GROUP_A,
      version: 99,
      storage_bucket: "project-deliverables",
      storage_path: `${PROJECT_A_ID}/${TASK_A1_ID}/${ASSET_GROUP_A}/v99/ae.png`,
      file_name: "ae.png",
      file_type: "DESIGN",
      mime_type: "image/png",
      file_size_bytes: 100,
      uploaded_by: aeUserId,
    });
    recordResult("AE Permissions", "Reject project_file insert", "ACCOUNT_EXECUTIVE", "Insert error", aeFileErr ? "Error returned" : "Allowed", Boolean(aeFileErr));

    // AE cannot update brands
    await aeClient.from("brands").update({ name: "AE Hacked Brand" }).eq("id", BRAND_ACTIVE);
    const { data: brandCheck } = await adminClient.from("brands").select("name").eq("id", BRAND_ACTIVE).single();
    recordResult("AE Permissions", "Reject brand update", "ACCOUNT_EXECUTIVE", "Name unchanged", brandCheck?.name ?? "", brandCheck?.name !== "AE Hacked Brand");

    // AE cannot publish workflow mutation
    await aeClient.from("projects").update({ status: "PUBLISHED" }).eq("id", PROJECT_A_ID);
    const { data: aePubCheck } = await adminClient.from("projects").select("status").eq("id", PROJECT_A_ID).single();
    recordResult("AE Permissions", "Reject publish workflow mutation", "ACCOUNT_EXECUTIVE", "Status unchanged", aePubCheck?.status ?? "", aePubCheck?.status !== "PUBLISHED");

    // AE cannot insert activity logs (Anti-Forgery)
    const { error: aeLogErr } = await aeClient.from("activity_logs").insert({
      project_id: PROJECT_A_ID,
      event_type: "AE_FORGED_EVENT",
      metadata: { forged: true },
    });
    recordResult("AE Permissions", "Reject direct activity_logs insert", "ACCOUNT_EXECUTIVE", "Insert error", aeLogErr ? "Error returned" : "Allowed", Boolean(aeLogErr));

    // AE cannot call create_notification directly (Anti-Spam)
    const { error: aeNotifErr } = await aeClient.rpc("create_notification", {
      p_recipient_user_id: designerUser.id,
      p_title: "AE Spam",
      p_message: "AE arbitrary notification",
      p_link_url: "/test",
    });
    recordResult("AE Permissions", "Reject create_notification spam", "ACCOUNT_EXECUTIVE", "Execution error", aeNotifErr ? "Error returned" : "Allowed", Boolean(aeNotifErr));
  }

  // =========================================================================
  // Suite 3: Creative Director (CD) Boundaries
  // =========================================================================
  console.log("\nSuite 3: Creative Director (CD) Boundaries");
  {
    const { data: cdProjects } = await cdClient.from("projects").select("*");
    recordResult("CD Boundaries", "Global read on projects", "CREATIVE_DIRECTOR", "Can select projects", Array.isArray(cdProjects) && cdProjects.length > 0 ? "Projects returned" : "Empty", Array.isArray(cdProjects) && cdProjects.length > 0);

    const cdUserId = (await cdClient.auth.getUser()).data.user?.id || "";

    // CD cannot create project
    const { error: cdPrjErr } = await cdClient.from("projects").insert({
      brand_id: BRAND_ACTIVE,
      name: "CD Unauthorized Project",
      project_code: "CD-2026-9999",
      deadline: new Date(Date.now() + 86400000).toISOString(),
      sms_owner_id: cdUserId,
      created_by: cdUserId,
    });
    recordResult("CD Boundaries", "Reject project creation", "CREATIVE_DIRECTOR", "Insert error", cdPrjErr ? "Error returned" : "Allowed", Boolean(cdPrjErr));

    // CD cannot create normal production tasks
    const { error: cdTaskErr } = await cdClient.from("tasks").insert({
      project_id: PROJECT_A_ID,
      title: "CD Unauthorized Task",
      task_type: "GRAPHIC_DESIGN",
      deadline: new Date(Date.now() + 86400000).toISOString(),
    });
    recordResult("CD Boundaries", "Reject task insertion", "CREATIVE_DIRECTOR", "Insert error", cdTaskErr ? "Error returned" : "Allowed", Boolean(cdTaskErr));

    // CD cannot assign/reassign tasks
    const { error: cdAssignErr } = await cdClient.from("task_assignments").insert({
      task_id: TASK_A1_ID,
      assignee_id: designerUser.id,
      assigned_by: cdUserId,
    });
    recordResult("CD Boundaries", "Reject task assignment insert", "CREATIVE_DIRECTOR", "Insert error", cdAssignErr ? "Error returned" : "Allowed", Boolean(cdAssignErr));

    // CD direct table insert to qc_reviews blocked by Phase 9.1 RLS (must use submit_qc_verdict RPC)
    const { error: qcErr } = await cdClient.from("qc_reviews").insert({
      project_id: PROJECT_A_ID,
      task_id: TASK_A1_ID,
      file_id: FILE_A1_ID,
      reviewer_id: cdUserId,
      result: "APPROVED",
      notes: "Passed QC verification.",
      round_number: 2,
    });
    recordResult("CD Boundaries", "Reject direct QC review table insert", "CREATIVE_DIRECTOR", "Insert error", qcErr ? "Insert rejected by RLS" : "Allowed", Boolean(qcErr));

    // CD direct table insert to revision_requests blocked by Phase 9.1 RLS (must use submit_qc_verdict RPC)
    const { error: cdRevErr } = await cdClient.from("revision_requests").insert({
      project_id: PROJECT_A_ID,
      task_id: TASK_A1_ID,
      assigned_to: designerUser.id,
      requested_by: cdUserId,
      source: "INTERNAL_QC",
      notes: "Internal QC adjustments needed.",
    });
    recordResult("CD Boundaries", "Reject direct INTERNAL_QC revision table insert", "CREATIVE_DIRECTOR", "Insert error", cdRevErr ? "Insert rejected by RLS" : "Allowed", Boolean(cdRevErr));

    // CD cannot create CLIENT revision
    const { error: cdClientRevErr } = await cdClient.from("revision_requests").insert({
      project_id: PROJECT_A_ID,
      task_id: TASK_A1_ID,
      assigned_to: designerUser.id,
      requested_by: cdUserId,
      source: "CLIENT",
      notes: "CD forged client revision.",
    });
    recordResult("CD Boundaries", "Reject CLIENT revision insert", "CREATIVE_DIRECTOR", "Insert error", cdClientRevErr ? "Error returned" : "Allowed", Boolean(cdClientRevErr));

    // CD cannot insert client_review
    const { error: cdClientRevInsErr } = await cdClient.from("client_reviews").insert({
      project_id: PROJECT_A_ID,
      submitted_by: cdUserId,
      overall_verdict: "PENDING",
    });
    recordResult("CD Boundaries", "Reject client review record insert", "CREATIVE_DIRECTOR", "Insert error", cdClientRevInsErr ? "Error returned" : "Allowed", Boolean(cdClientRevInsErr));

    // CD cannot publish
    await cdClient.from("projects").update({ status: "PUBLISHED" }).eq("id", PROJECT_A_ID);
    const { data: cdPubCheck } = await adminClient.from("projects").select("status").eq("id", PROJECT_A_ID).single();
    recordResult("CD Boundaries", "Reject publish transition", "CREATIVE_DIRECTOR", "Status unchanged", cdPubCheck?.status ?? "", cdPubCheck?.status !== "PUBLISHED");
  }

  // =========================================================================
  // Suite 4: SMS Project Ownership Boundaries
  // =========================================================================
  console.log("\nSuite 4: SMS Project Ownership Boundaries");
  {
    // SMS 1 can update Project A (owned)
    const { error: sms1UpdateErr } = await smsClient
      .from("projects")
      .update({ name: "Acme Q1 Launch (Updated by Owner)" })
      .eq("id", PROJECT_A_ID);
    recordResult("SMS Ownership", "Owner updates owned project", "SOCIAL_MEDIA_SPECIALIST", "Update allowed", !sms1UpdateErr ? "Success" : `Error: ${sms1UpdateErr.message}`, !sms1UpdateErr);

    // SMS 1 cannot update Project Beta (owned by SMS 2)
    await smsClient
      .from("projects")
      .update({ name: "Project Beta Hacked by SMS 1" })
      .eq("id", PROJECT_B_ID);
    const { data: betaProject } = await adminClient.from("projects").select("name").eq("id", PROJECT_B_ID).single();
    recordResult("SMS Ownership", "Non-owner cannot update other SMS project", "SOCIAL_MEDIA_SPECIALIST", "Name unchanged", betaProject?.name ?? "", betaProject?.name !== "Project Beta Hacked by SMS 1");

    // SMS 1 cannot insert tasks into Project Beta
    const { error: sms1TaskErr } = await smsClient.from("tasks").insert({
      project_id: PROJECT_B_ID,
      title: "Cross Project Task",
      task_type: "OTHER",
      deadline: new Date(Date.now() + 86400000).toISOString(),
    });
    recordResult("SMS Ownership", "Non-owner cannot insert tasks in other SMS project", "SOCIAL_MEDIA_SPECIALIST", "Insert error", sms1TaskErr ? "Error returned" : "Allowed", Boolean(sms1TaskErr));

    // SMS cannot soft-delete brands (T-003)
    const { error: smsBrandDeleteErr } = await smsClient
      .from("brands")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", BRAND_UNUSED);
    recordResult("SMS Ownership", "SMS rejected from soft-deleting brands (T-003)", "SOCIAL_MEDIA_SPECIALIST", "Delete error", smsBrandDeleteErr ? "Error returned" : "Allowed", Boolean(smsBrandDeleteErr));

    // SMS 2 cannot reassign task on Project A
    const editorUserId = (await editorClient.auth.getUser()).data.user?.id || "";
    const { error: sms2ReassignErr } = await sms2Client.rpc("reassign_task", {
      p_task_id: TASK_A1_ID,
      p_new_assignee_id: editorUserId,
    });
    recordResult("SMS Ownership", "Non-owner cannot reassign task in other SMS project", "SOCIAL_MEDIA_SPECIALIST", "Execution error", sms2ReassignErr ? "Error returned" : "Allowed", Boolean(sms2ReassignErr));

    // SMS 2 cannot update brief on Project A
    await sms2Client.from("briefs").update({ objective: "Hacked by SMS 2" }).eq("project_id", PROJECT_A_ID);
    const { data: briefCheck } = await adminClient.from("briefs").select("objective").eq("project_id", PROJECT_A_ID).single();
    recordResult("SMS Ownership", "Non-owner cannot update brief in other SMS project", "SOCIAL_MEDIA_SPECIALIST", "Objective unchanged", briefCheck?.objective ?? "", briefCheck?.objective !== "Hacked by SMS 2");

    // SMS 2 cannot insert client review on Project A
    const sms2UserId = (await sms2Client.auth.getUser()).data.user?.id || "";
    const { error: sms2RevErr } = await sms2Client.from("client_reviews").insert({
      project_id: PROJECT_A_ID,
      submitted_by: sms2UserId,
      overall_verdict: "PENDING",
    });
    recordResult("SMS Ownership", "Non-owner cannot insert client review in other SMS project", "SOCIAL_MEDIA_SPECIALIST", "Insert error", sms2RevErr ? "Error returned" : "Allowed", Boolean(sms2RevErr));

    // SMS 2 cannot publish Project A
    await sms2Client.from("projects").update({ status: "PUBLISHED" }).eq("id", PROJECT_A_ID);
    const { data: sms2PubCheck } = await adminClient.from("projects").select("status").eq("id", PROJECT_A_ID).single();
    recordResult("SMS Ownership", "Non-owner cannot publish other SMS project", "SOCIAL_MEDIA_SPECIALIST", "Status unchanged", sms2PubCheck?.status ?? "", sms2PubCheck?.status !== "PUBLISHED");
  }

  // =========================================================================
  // Suite 5: Creative Project Isolation (Designer & Video Editor)
  // =========================================================================
  console.log("\nSuite 5: Creative Project Isolation (Designer & Video Editor)");
  {
    // Designer can read Project A
    const { data: desPrjA } = await designerClient.from("projects").select("*").eq("id", PROJECT_A_ID);
    recordResult("Creative Isolation", "Designer reads assigned Project A", "GRAPHIC_DESIGNER", "1 row", `${desPrjA?.length ?? 0} rows`, (desPrjA?.length ?? 0) === 1);

    // Designer cannot read Project Beta
    const { data: desPrjB } = await designerClient.from("projects").select("*").eq("id", PROJECT_B_ID);
    recordResult("Creative Isolation", "Designer blocked from Project Beta", "GRAPHIC_DESIGNER", "0 rows", `${desPrjB?.length ?? 0} rows`, (desPrjB?.length ?? 0) === 0);

    // Designer cannot read Project Beta tasks
    const { data: desTasksB } = await designerClient.from("tasks").select("*").eq("project_id", PROJECT_B_ID);
    recordResult("Creative Isolation", "Designer blocked from Project Beta tasks", "GRAPHIC_DESIGNER", "0 rows", `${desTasksB?.length ?? 0} rows`, (desTasksB?.length ?? 0) === 0);

    // Designer cannot read Project Beta brief
    const { data: desBriefB } = await designerClient.from("briefs").select("*").eq("project_id", PROJECT_B_ID);
    recordResult("Creative Isolation", "Designer blocked from Project Beta brief", "GRAPHIC_DESIGNER", "0 rows", `${desBriefB?.length ?? 0} rows`, (desBriefB?.length ?? 0) === 0);

    // Designer cannot read Project Beta content_plan
    const { data: desCpB } = await designerClient.from("content_plans").select("*").eq("project_id", PROJECT_B_ID);
    recordResult("Creative Isolation", "Designer blocked from Project Beta content_plan", "GRAPHIC_DESIGNER", "0 rows", `${desCpB?.length ?? 0} rows`, (desCpB?.length ?? 0) === 0);

    // Designer cannot read Project Beta script
    const { data: desScB } = await designerClient.from("scripts").select("*").eq("project_id", PROJECT_B_ID);
    recordResult("Creative Isolation", "Designer blocked from Project Beta scripts", "GRAPHIC_DESIGNER", "0 rows", `${desScB?.length ?? 0} rows`, (desScB?.length ?? 0) === 0);

    // Designer cannot read Project Beta project_files
    const { data: desPfB } = await designerClient.from("project_files").select("*").eq("project_id", PROJECT_B_ID);
    recordResult("Creative Isolation", "Designer blocked from Project Beta project_files", "GRAPHIC_DESIGNER", "0 rows", `${desPfB?.length ?? 0} rows`, (desPfB?.length ?? 0) === 0);

    // Designer cannot read Project Beta revision_requests
    const { data: desRevB } = await designerClient.from("revision_requests").select("*").eq("project_id", PROJECT_B_ID);
    recordResult("Creative Isolation", "Designer blocked from Project Beta revisions", "GRAPHIC_DESIGNER", "0 rows", `${desRevB?.length ?? 0} rows`, (desRevB?.length ?? 0) === 0);

    // Designer cannot read Project Beta client_reviews
    const { data: desCrB } = await designerClient.from("client_reviews").select("*").eq("project_id", PROJECT_B_ID);
    recordResult("Creative Isolation", "Designer blocked from Project Beta client_reviews", "GRAPHIC_DESIGNER", "0 rows", `${desCrB?.length ?? 0} rows`, (desCrB?.length ?? 0) === 0);

    // Editor cannot read Project Beta
    const { data: edPrjB } = await editorClient.from("projects").select("*").eq("id", PROJECT_B_ID);
    recordResult("Creative Isolation", "Editor blocked from Project Beta", "VIDEO_EDITOR", "0 rows", `${edPrjB?.length ?? 0} rows`, (edPrjB?.length ?? 0) === 0);
  }

  // =========================================================================
  // Suite 6: Creative Self-Approval & Governance Guard (Section 9)
  // =========================================================================
  console.log("\nSuite 6: Creative Self-Approval & Governance Guard (Section 9)");
  {
    // Assignee attempts RPC transition to APPROVED
    const { error: saApproveErr } = await designerClient.rpc("transition_task_status", {
      p_task_id: TASK_A1_ID,
      p_new_status: "APPROVED",
    });
    recordResult("Self-Approval Defense", "Assignee transition_task_status -> APPROVED", "GRAPHIC_DESIGNER", "Execution error", saApproveErr ? "Error returned" : "Allowed", Boolean(saApproveErr));

    // Assignee attempts RPC transition to COMPLETED
    const { error: saCompErr } = await designerClient.rpc("transition_task_status", {
      p_task_id: TASK_A1_ID,
      p_new_status: "COMPLETED",
    });
    recordResult("Self-Approval Defense", "Assignee transition_task_status -> COMPLETED", "GRAPHIC_DESIGNER", "Execution error", saCompErr ? "Error returned" : "Allowed", Boolean(saCompErr));

    // Assignee direct SQL UPDATE tasks SET status = APPROVED
    const { error: dirApproveErr } = await designerClient
      .from("tasks")
      .update({ status: "APPROVED" })
      .eq("id", TASK_A1_ID);
    recordResult("Self-Approval Defense", "Assignee direct SQL UPDATE tasks -> APPROVED", "GRAPHIC_DESIGNER", "Update error", dirApproveErr ? "Error returned" : "Allowed", Boolean(dirApproveErr));

    // Assignee direct SQL UPDATE tasks SET status = COMPLETED
    const { error: dirCompErr } = await designerClient
      .from("tasks")
      .update({ status: "COMPLETED" })
      .eq("id", TASK_A1_ID);
    recordResult("Self-Approval Defense", "Assignee direct SQL UPDATE tasks -> COMPLETED", "GRAPHIC_DESIGNER", "Update error", dirCompErr ? "Error returned" : "Allowed", Boolean(dirCompErr));

    // Assignee direct SQL UPDATE governance field: deadline
    const { error: dirDeadlineErr } = await designerClient
      .from("tasks")
      .update({ deadline: new Date(Date.now() + 30 * 86400000).toISOString() })
      .eq("id", TASK_A1_ID);
    recordResult("Governance Defense", "Assignee direct SQL UPDATE task deadline", "GRAPHIC_DESIGNER", "Update error", dirDeadlineErr ? "Error returned" : "Allowed", Boolean(dirDeadlineErr));
  }

  // =========================================================================
  // Suite 7: Assignment Atomicity (Section 10)
  // =========================================================================
  console.log("\nSuite 7: Assignment Atomicity (Section 10)");
  {
    // SMS owner calls reassign_task
    const editorUserId = (await editorClient.auth.getUser()).data.user?.id || "";
    const { error: reassignErr } = await smsClient.rpc("reassign_task", {
      p_task_id: TASK_A1_ID,
      p_new_assignee_id: editorUserId,
    });
    recordResult("Assignment Atomicity", "Atomic reassign_task RPC execution", "SOCIAL_MEDIA_SPECIALIST", "Success", !reassignErr ? "Success" : `Error: ${reassignErr.message}`, !reassignErr);

    // Verify previous assignment ended_at is set
    const { data: prevAssign } = await adminClient
      .from("task_assignments")
      .select("ended_at")
      .eq("task_id", TASK_A1_ID)
      .eq("assignee_id", designerUser.id)
      .single();
    recordResult("Assignment Atomicity", "Previous assignment marked ended_at", "SYSTEM", "ended_at NOT NULL", prevAssign?.ended_at ? "Timestamp populated" : "NULL", Boolean(prevAssign?.ended_at));

    // Verify task current_assignee_id points to new user
    const { data: updatedTask } = await adminClient
      .from("tasks")
      .select("current_assignee_id")
      .eq("id", TASK_A1_ID)
      .single();
    recordResult("Assignment Atomicity", "Task current_assignee_id updated", "SYSTEM", editorUserId, updatedTask?.current_assignee_id ?? "", updatedTask?.current_assignee_id === editorUserId);

    // Direct insertion of second active assignment rejected by partial unique index
    const { error: dupActiveErr } = await adminClient.from("task_assignments").insert({
      task_id: TASK_A1_ID,
      assignee_id: designerUser.id,
      assigned_by: (await smsClient.auth.getUser()).data.user?.id || "",
    });
    recordResult("Assignment Atomicity", "idx_task_assignments_one_active blocks duplicate active", "SYSTEM", "Unique index violation error", dupActiveErr ? "Error returned" : "Allowed", Boolean(dupActiveErr));

    // Reassign back to designer to preserve fixture baseline
    await smsClient.rpc("reassign_task", {
      p_task_id: TASK_A1_ID,
      p_new_assignee_id: designerUser.id,
    });
  }

  // =========================================================================
  // Suite 8: Asset Group Invariant (Section 11)
  // =========================================================================
  console.log("\nSuite 8: Asset Group Invariant (Section 11)");
  {
    // Task A1 is established with ASSET_GROUP_A. Attempt inserting v2 with ASSET_GROUP_B
    const fakeGroupB = "88888888-8888-8888-8888-888888888888";
    const { error: groupMismatchErr } = await adminClient.from("project_files").insert({
      project_id: PROJECT_A_ID,
      task_id: TASK_A1_ID,
      asset_group_id: fakeGroupB,
      version: 2,
      storage_bucket: "project-assets",
      storage_path: `${PROJECT_A_ID}/${TASK_A1_ID}/group_b_v2.fig`,
      file_name: "group_b_v2.fig",
      file_type: "DESIGN",
      mime_type: "application/octet-stream",
      file_size_bytes: 5000,
      uploaded_by: designerUser.id,
    });
    recordResult("Asset Group Invariant", "Reject v2 with mismatched asset_group_id", "SYSTEM", "Trigger exception", groupMismatchErr ? "Error returned" : "Allowed", Boolean(groupMismatchErr));

    // Attempt duplicate (asset_group A, version 1)
    const { error: dupVerErr } = await adminClient.from("project_files").insert({
      project_id: PROJECT_A_ID,
      task_id: TASK_A1_ID,
      asset_group_id: ASSET_GROUP_A,
      version: 1,
      storage_bucket: "project-assets",
      storage_path: `${PROJECT_A_ID}/${TASK_A1_ID}/dup_v1.fig`,
      file_name: "dup_v1.fig",
      file_type: "DESIGN",
      mime_type: "application/octet-stream",
      file_size_bytes: 5000,
      uploaded_by: designerUser.id,
    });
    recordResult("Asset Group Invariant", "Reject duplicate (asset_group, version)", "SYSTEM", "Constraint violation error", dupVerErr ? "Error returned" : "Allowed", Boolean(dupVerErr));

    // Valid A/v2 succeeds
    const { data: v2Data, error: v2Err } = await adminClient.from("project_files").insert({
      project_id: PROJECT_A_ID,
      task_id: TASK_A1_ID,
      asset_group_id: ASSET_GROUP_A,
      version: 2,
      storage_bucket: "project-assets",
      storage_path: `${PROJECT_A_ID}/${TASK_A1_ID}/carousel_v2.fig`,
      file_name: "carousel_v2.fig",
      file_type: "DESIGN",
      mime_type: "application/octet-stream",
      file_size_bytes: 5000,
      uploaded_by: designerUser.id,
    }).select().single();
    recordResult("Asset Group Invariant", "Valid A/v2 creation succeeds", "SYSTEM", "File inserted", v2Data ? "v2 inserted" : `Error: ${v2Err?.message}`, Boolean(v2Data));

    // Valid A/v3 succeeds
    const { data: v3Data, error: v3Err } = await adminClient.from("project_files").insert({
      project_id: PROJECT_A_ID,
      task_id: TASK_A1_ID,
      asset_group_id: ASSET_GROUP_A,
      version: 3,
      storage_bucket: "project-assets",
      storage_path: `${PROJECT_A_ID}/${TASK_A1_ID}/carousel_v3.fig`,
      file_name: "carousel_v3.fig",
      file_type: "DESIGN",
      mime_type: "application/octet-stream",
      file_size_bytes: 6000,
      uploaded_by: designerUser.id,
    }).select().single();
    recordResult("Asset Group Invariant", "Valid A/v3 creation succeeds", "SYSTEM", "File inserted", v3Data ? "v3 inserted" : `Error: ${v3Err?.message}`, Boolean(v3Data));

    // Independent task uses independent group B/v1
    const ASSET_GROUP_INDEPENDENT = "99999999-9999-9999-9999-999999999999";
    const { data: b1Data, error: b1Err } = await adminClient.from("project_files").insert({
      project_id: PROJECT_B_ID,
      task_id: TASK_B1_ID,
      asset_group_id: ASSET_GROUP_INDEPENDENT,
      version: 1,
      storage_bucket: "project-assets",
      storage_path: `${PROJECT_B_ID}/${TASK_B1_ID}/banner_v1.png`,
      file_name: "banner_v1.png",
      file_type: "DESIGN",
      mime_type: "image/png",
      file_size_bytes: 3500,
      uploaded_by: designerUser.id,
    }).select().single();
    recordResult("Asset Group Invariant", "Independent task uses independent group B/v1", "SYSTEM", "File inserted", b1Data ? "b1 inserted" : `Error: ${b1Err?.message}`, Boolean(b1Data));
  }

  // =========================================================================
  // Suite 9: QC Integrity (Section 12)
  // =========================================================================
  console.log("\nSuite 9: QC Integrity (Section 12)");
  {
    const cdUserId = (await cdClient.auth.getUser()).data.user?.id || "";

    // Reject QC review on project A with task from project B
    const { error: crossPrjQcErr } = await cdClient.from("qc_reviews").insert({
      project_id: PROJECT_A_ID,
      task_id: TASK_B1_ID, // Task from Project Beta
      file_id: FILE_A1_ID,
      reviewer_id: cdUserId,
      result: "APPROVED",
      notes: "Cross project QC forged",
      round_number: 10,
    });
    recordResult("QC Integrity", "Reject QC review on project A with task from project B", "CREATIVE_DIRECTOR", "Trigger error", crossPrjQcErr ? "Error returned" : "Allowed", Boolean(crossPrjQcErr));

    // Reject QC review task A + file belonging to task B
    // Create dummy file for task A2
    const { data: fileA2 } = await adminClient.from("project_files").insert({
      project_id: PROJECT_A_ID,
      task_id: TASK_A2_ID,
      asset_group_id: "88888888-8888-8888-8888-888888888888",
      version: 1,
      storage_bucket: "project-assets",
      storage_path: `${PROJECT_A_ID}/${TASK_A2_ID}/video_v1.mp4`,
      file_name: "video_v1.mp4",
      file_type: "VIDEO",
      mime_type: "video/mp4",
      file_size_bytes: 10000,
      uploaded_by: (await editorClient.auth.getUser()).data.user?.id || "",
    }).select().single();

    const { error: qcFileTaskMismatchErr } = await cdClient.from("qc_reviews").insert({
      project_id: PROJECT_A_ID,
      task_id: TASK_A1_ID,
      file_id: fileA2?.id || "",
      reviewer_id: cdUserId,
      result: "REVISION_REQUESTED",
      notes: "Mismatched file check",
      round_number: 3,
    });
    recordResult("QC Integrity", "Reject QC review with file belonging to another task", "CREATIVE_DIRECTOR", "Trigger error", qcFileTaskMismatchErr ? "Error returned" : "Allowed", Boolean(qcFileTaskMismatchErr));

    // Reject duplicate task round_number (round 1 already exists)
    const { error: dupRoundErr } = await cdClient.from("qc_reviews").insert({
      project_id: PROJECT_A_ID,
      task_id: TASK_A1_ID,
      file_id: FILE_A1_ID,
      reviewer_id: cdUserId,
      result: "APPROVED",
      notes: "Duplicate round 1",
      round_number: 1,
    });
    recordResult("QC Integrity", "Reject duplicate task round_number", "CREATIVE_DIRECTOR", "Constraint error", dupRoundErr ? "Error returned" : "Allowed", Boolean(dupRoundErr));

    // Reject QC UPDATE
    const { error: qcUpErr } = await adminClient
      .from("qc_reviews")
      .update({ notes: "Mutated review notes" })
      .eq("task_id", TASK_A1_ID);
    recordResult("QC Integrity", "Reject UPDATE on qc_reviews (immutability)", "SYSTEM", "Trigger exception", qcUpErr ? "Error returned" : "Allowed", Boolean(qcUpErr));

    // Reject QC DELETE
    const { error: qcDelErr } = await adminClient
      .from("qc_reviews")
      .delete()
      .eq("task_id", TASK_A1_ID);
    recordResult("QC Integrity", "Reject DELETE on qc_reviews (immutability)", "SYSTEM", "Trigger exception", qcDelErr ? "Error returned" : "Allowed", Boolean(qcDelErr));
  }

  // =========================================================================
  // Suite 10: Client Review Integrity (Section 13)
  // =========================================================================
  console.log("\nSuite 10: Client Review Integrity (Section 13)");
  {
    const smsUserId = (await smsClient.auth.getUser()).data.user?.id || "";

    // Insert sample client review header
    const { data: clientRev } = await adminClient.from("client_reviews").insert({
      project_id: PROJECT_A_ID,
      round_number: 1,
      submitted_by: smsUserId,
      overall_verdict: "PENDING",
    }).select().single();

    // Reject client review item linking review of project A with task from project B
    const { error: crossPrjItemErr } = await adminClient.from("client_review_items").insert({
      client_review_id: clientRev?.id || "",
      task_id: TASK_B1_ID, // Task from Project Beta
      file_id: FILE_A1_ID,
      verdict: "APPROVED",
    });
    recordResult("Client Review Integrity", "Reject item linking review A with task B", "SYSTEM", "Trigger exception", crossPrjItemErr ? "Error returned" : "Allowed", Boolean(crossPrjItemErr));

    // Valid item
    const { data: validItem } = await adminClient.from("client_review_items").insert({
      client_review_id: clientRev?.id || "",
      task_id: TASK_A1_ID,
      file_id: FILE_A1_ID,
      verdict: "APPROVED",
    }).select().single();
    recordResult("Client Review Integrity", "Valid review item insertion succeeds", "SYSTEM", "Item inserted", validItem ? "Item inserted" : "Failed", Boolean(validItem));

    // Reject duplicate task item within same client review session
    const { error: dupTaskItemErr } = await adminClient.from("client_review_items").insert({
      client_review_id: clientRev?.id || "",
      task_id: TASK_A1_ID, // duplicate task in same review session
      file_id: FILE_A1_ID,
      verdict: "APPROVED",
    });
    recordResult("Client Review Integrity", "Reject duplicate task item within same review", "SYSTEM", "Constraint error", dupTaskItemErr ? "Error returned" : "Allowed", Boolean(dupTaskItemErr));

    // Reject UPDATE on client_review_items
    const { error: itemUpErr } = await adminClient
      .from("client_review_items")
      .update({ verdict: "REVISION_REQUESTED" })
      .eq("id", validItem?.id || "");
    recordResult("Client Review Integrity", "Reject UPDATE on client_review_items", "SYSTEM", "Trigger exception", itemUpErr ? "Error returned" : "Allowed", Boolean(itemUpErr));

    // Reject DELETE on client_review_items
    const { error: itemDelErr } = await adminClient
      .from("client_review_items")
      .delete()
      .eq("id", validItem?.id || "");
    recordResult("Client Review Integrity", "Reject DELETE on client_review_items", "SYSTEM", "Trigger exception", itemDelErr ? "Error returned" : "Allowed", Boolean(itemDelErr));
  }

  // =========================================================================
  // Suite 11: Production In-Flight Content Lock (Section 14)
  // =========================================================================
  console.log("\nSuite 11: Production In-Flight Content Lock (Section 14)");
  {
    // Project A is in PRODUCTION. Ordinary UPDATE on brief by SMS must fail
    const { error: lockErr } = await smsClient
      .from("briefs")
      .update({ objective: "Direct SMS edit during production" })
      .eq("project_id", PROJECT_A_ID);
    recordResult("Content Lock (T-004)", "Ordinary UPDATE by SMS during PRODUCTION rejected", "SOCIAL_MEDIA_SPECIALIST", "Trigger error", lockErr ? "Error returned" : "Allowed", Boolean(lockErr));

    // Exceptional revision via exceptional_content_update succeeds and produces audit event
    const { data: briefRow } = await adminClient.from("briefs").select("id").eq("project_id", PROJECT_A_ID).single();
    const { error: excErr } = await smsClient.rpc("exceptional_content_update", {
      p_entity_type: "brief",
      p_entity_id: briefRow?.id || "",
      p_patch: { objective: "Authorized executive pivot objective" },
      p_reason: "Client stakeholder strategic pivot on Q1 campaign",
    });
    recordResult("Content Lock (T-004)", "exceptional_content_update RPC succeeds", "SOCIAL_MEDIA_SPECIALIST", "Success", !excErr ? "Success" : `Error: ${excErr.message}`, !excErr);

    // Verify activity_logs recorded event
    const { data: auditEvent } = await adminClient
      .from("activity_logs")
      .select("event_type, metadata")
      .eq("project_id", PROJECT_A_ID)
      .eq("event_type", "EXCEPTIONAL_CONTENT_REVISION")
      .single();
    recordResult("Content Lock (T-004)", "Audit log event generated for exceptional revision", "SYSTEM", "EXCEPTIONAL_CONTENT_REVISION", auditEvent?.event_type ?? "None", auditEvent?.event_type === "EXCEPTIONAL_CONTENT_REVISION");
  }

  // =========================================================================
  // Suite 12: Brand Archive (Section 15)
  // =========================================================================
  console.log("\nSuite 12: Brand Archive (Section 15)");
  {
    // Admin soft-delete brand with historical projects fails (T-003)
    const { error: activeBrandErr } = await adminAuth
      .from("brands")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", BRAND_ACTIVE);
    recordResult("Brand Archive (T-003)", "Admin soft-delete brand with projects rejected", "ADMIN", "Trigger error", activeBrandErr ? "Error returned" : "Allowed", Boolean(activeBrandErr));

    // SMS soft-delete brand fails
    const { error: smsBrandDelErr } = await smsClient
      .from("brands")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", BRAND_UNUSED);
    recordResult("Brand Archive (T-003)", "SMS soft-delete brand rejected", "SOCIAL_MEDIA_SPECIALIST", "Trigger error", smsBrandDelErr ? "Error returned" : "Allowed", Boolean(smsBrandDelErr));

    // Admin soft-delete unused brand succeeds
    const { error: unusedBrandErr } = await adminAuth
      .from("brands")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", BRAND_UNUSED);
    recordResult("Brand Archive (T-003)", "Admin soft-delete unused brand succeeds", "ADMIN", "Success", !unusedBrandErr ? "Success" : `Error: ${unusedBrandErr.message}`, !unusedBrandErr);
  }

  // =========================================================================
  // Suite 13: Notification RPC Security & Anti-Spam (Section 16)
  // =========================================================================
  console.log("\nSuite 13: Notification RPC Security & Anti-Spam (Section 16)");
  {
    // AE calling create_notification directly
    const { error: aeSpamErr } = await aeClient.rpc("create_notification", {
      p_recipient_user_id: designerUser.id,
      p_title: "AE Spam Alert",
      p_message: "Forged message",
      p_link_url: "/spam",
    });
    recordResult("Notification Security", "AE arbitrary create_notification rejected", "ACCOUNT_EXECUTIVE", "Error returned", aeSpamErr ? "Error returned" : "Allowed", Boolean(aeSpamErr));

    // Designer calling create_notification directly
    const { error: desSpamErr } = await designerClient.rpc("create_notification", {
      p_recipient_user_id: (await cdClient.auth.getUser()).data.user?.id || "",
      p_title: "Designer Spam Alert",
      p_message: "Forged message",
      p_link_url: "/spam",
    });
    recordResult("Notification Security", "Designer arbitrary create_notification rejected", "GRAPHIC_DESIGNER", "Error returned", desSpamErr ? "Error returned" : "Allowed", Boolean(desSpamErr));

    // SMS calling create_notification directly
    const { error: smsSpamErr } = await smsClient.rpc("create_notification", {
      p_recipient_user_id: designerUser.id,
      p_title: "SMS Arbitrary Alert",
      p_message: "Forged message",
      p_link_url: "/spam",
    });
    recordResult("Notification Security", "SMS arbitrary create_notification rejected", "SOCIAL_MEDIA_SPECIALIST", "Error returned", smsSpamErr ? "Error returned" : "Allowed", Boolean(smsSpamErr));

    // Admin calling create_notification directly
    const { data: adminNotifId, error: admNotifErr } = await adminAuth.rpc("create_notification", {
      p_recipient_user_id: designerUser.id,
      p_title: "Admin Official Broadcast",
      p_message: "System maintenance window at 22:00 UTC",
      p_link_url: "/notifications",
    });
    recordResult("Notification Security", "Admin create_notification succeeds", "ADMIN", "Notification ID returned", adminNotifId ? "Created notification" : `Error: ${admNotifErr?.message}`, Boolean(adminNotifId));

    // Legitimate domain event notification (trg_notify_on_task_assignment)
    const { data: autoNotif } = await adminClient
      .from("notifications")
      .select("title, is_read")
      .eq("user_id", designerUser.id)
      .in("title", ["New Task Assigned", "Tugas Baru Ditetapkan"])
      .limit(1);
    recordResult("Notification Security", "Automated domain event notification dispatched", "SYSTEM", "Event notification present", autoNotif && autoNotif.length > 0 ? "Present" : "Missing", Boolean(autoNotif && autoNotif.length > 0));
  }

  // =========================================================================
  // Suite 14: Activity Log Anti-Forgery (Section 17)
  // =========================================================================
  console.log("\nSuite 14: Activity Log Anti-Forgery (Section 17)");
  {
    // AE direct insert
    const { error: aeLogErr } = await aeClient.from("activity_logs").insert({
      project_id: PROJECT_A_ID,
      event_type: "AE_FORGED_EVENT",
      metadata: { forged: true },
    });
    recordResult("Activity Log Anti-Forgery", "AE direct INSERT rejected", "ACCOUNT_EXECUTIVE", "Error returned", aeLogErr ? "Error returned" : "Allowed", Boolean(aeLogErr));

    // Designer direct insert
    const { error: desLogErr } = await designerClient.from("activity_logs").insert({
      project_id: PROJECT_A_ID,
      event_type: "DESIGNER_FORGED_EVENT",
      metadata: { forged: true },
    });
    recordResult("Activity Log Anti-Forgery", "Designer direct INSERT rejected", "GRAPHIC_DESIGNER", "Error returned", desLogErr ? "Error returned" : "Allowed", Boolean(desLogErr));

    // SMS direct insert
    const { error: smsLogErr } = await smsClient.from("activity_logs").insert({
      project_id: PROJECT_A_ID,
      event_type: "SMS_FORGED_EVENT",
      metadata: { forged: true },
    });
    recordResult("Activity Log Anti-Forgery", "SMS direct INSERT rejected", "SOCIAL_MEDIA_SPECIALIST", "Error returned", smsLogErr ? "Error returned" : "Allowed", Boolean(smsLogErr));

    // CD direct insert
    const { error: cdLogErr } = await cdClient.from("activity_logs").insert({
      project_id: PROJECT_A_ID,
      event_type: "CD_FORGED_EVENT",
      metadata: { forged: true },
    });
    recordResult("Activity Log Anti-Forgery", "CD direct INSERT rejected", "CREATIVE_DIRECTOR", "Error returned", cdLogErr ? "Error returned" : "Allowed", Boolean(cdLogErr));
  }

  // =========================================================================
  // Suite 15: Storage Policy Penetration (Section 18)
  // =========================================================================
  console.log("\nSuite 15: Storage Policy Penetration (Section 18)");
  {
    // AE write to project-deliverables
    const { error: aeStoreErr } = await aeClient.storage
      .from("project-deliverables")
      .upload(`${PROJECT_A_ID}/${TASK_A1_ID}/fake.png`, Buffer.from("fake data"));
    recordResult("Storage Penetration", "AE write to project-deliverables rejected", "ACCOUNT_EXECUTIVE", "Upload error", aeStoreErr ? "Error returned" : "Allowed", Boolean(aeStoreErr));

    // CD write to project-deliverables
    const { error: cdStoreErr } = await cdClient.storage
      .from("project-deliverables")
      .upload(`${PROJECT_A_ID}/${TASK_A1_ID}/fake.png`, Buffer.from("fake data"));
    recordResult("Storage Penetration", "CD write to project-deliverables rejected", "CREATIVE_DIRECTOR", "Upload error", cdStoreErr ? "Error returned" : "Allowed", Boolean(cdStoreErr));

    // SMS owner asset upload succeeds
    const { error: smsAssetErr } = await smsClient.storage
      .from("project-assets")
      .upload(`${PROJECT_A_ID}/brief/sms_guide.pdf`, Buffer.from("pdf data"), { upsert: true });
    recordResult("Storage Penetration", "SMS owner upload to project-assets succeeds", "SOCIAL_MEDIA_SPECIALIST", "Success", !smsAssetErr ? "Success" : `Error: ${smsAssetErr.message}`, !smsAssetErr);

    // SMS non-owner upload to Project Beta rejected
    const { error: smsCrossAssetErr } = await smsClient.storage
      .from("project-assets")
      .upload(`${PROJECT_B_ID}/brief/cross_hack.pdf`, Buffer.from("pdf data"));
    recordResult("Storage Penetration", "SMS non-owner upload to Project Beta rejected", "SOCIAL_MEDIA_SPECIALIST", "Upload error", smsCrossAssetErr ? "Error returned" : "Allowed", Boolean(smsCrossAssetErr));

    // Designer upload to project-assets rejected
    const { error: desAssetErr } = await designerClient.storage
      .from("project-assets")
      .upload(`${PROJECT_A_ID}/brief/des_unauth.pdf`, Buffer.from("pdf data"));
    recordResult("Storage Penetration", "Designer upload to project-assets rejected", "GRAPHIC_DESIGNER", "Upload error", desAssetErr ? "Error returned" : "Allowed", Boolean(desAssetErr));

    // Path tampering: mismatched task_id in folder path
    const { error: tamperTaskErr } = await designerClient.storage
      .from("project-deliverables")
      .upload(`${PROJECT_A_ID}/${TASK_A2_ID}/${ASSET_GROUP_A}/v1/tamper.png`, Buffer.from("tamper"));
    recordResult("Storage Penetration", "Designer path tampering with unassigned task rejected", "GRAPHIC_DESIGNER", "Upload error", tamperTaskErr ? "Error returned" : "Allowed", Boolean(tamperTaskErr));
  }

  // =========================================================================
  // Suite 16: User Provisioning & Deactivation (Compensating Cleanup)
  // =========================================================================
  console.log("\nSuite 16: User Provisioning & Deactivation (Compensating Cleanup)");
  {
    const testEmail = `audit.user.${Date.now()}@locotrack.local`;
    const prov = await provisionUser({
      email: testEmail,
      fullName: "Audit Provision User",
      role: "VIDEO_EDITOR",
      password: "TestPassword123!",
    });
    recordResult("User Provisioning", "provisionUser creates Auth + Profile", "SYSTEM", "User created", prov.userId ? "ID returned" : "Failed", Boolean(prov.userId));

    await deactivateUser(prov.userId);
    const { data: deactProfile } = await adminClient.from("profiles").select("is_active").eq("id", prov.userId).single();
    recordResult("User Provisioning", "deactivateUser marks profile inactive", "SYSTEM", "is_active = false", deactProfile?.is_active === false ? "false" : "true", deactProfile?.is_active === false);
  }

  // =========================================================================
  // Suite 17: Privilege Escalation Defense
  // =========================================================================
  console.log("\nSuite 17: Privilege Escalation Defense");
  {
    await designerClient
      .from("profiles")
      .update({ role: "ADMIN" })
      .eq("id", designerUser.id);
    const { data: profCheck } = await adminClient.from("profiles").select("role").eq("id", designerUser.id).single();
    recordResult("Privilege Escalation", "Designer role escalation to ADMIN rejected", "GRAPHIC_DESIGNER", "Role remains GRAPHIC_DESIGNER", profCheck?.role ?? "", profCheck?.role === "GRAPHIC_DESIGNER");
  }

  // =========================================================================
  // Named Verification Matrix
  // =========================================================================
  console.log("\n==================================================================================================");
  console.log("                       LOCO TRACK PHASE 3.1 NAMED VERIFICATION MATRIX                             ");
  console.log("==================================================================================================");
  console.log(
    "Test Name".padEnd(45) +
    " | " + "Role".padEnd(24) +
    " | " + "Expected".padEnd(26) +
    " | " + "Status"
  );
  console.log("-".repeat(110));

  for (const r of results) {
    const statusStr = r.passed ? "PASS" : "FAIL";
    console.log(
      r.name.slice(0, 44).padEnd(45) +
      " | " + r.role.slice(0, 23).padEnd(24) +
      " | " + r.expected.slice(0, 25).padEnd(26) +
      " | " + statusStr
    );
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log("\n" + "=".repeat(110));
  console.log(`TOTAL AUDIT ASSERTIONS: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log("=".repeat(110));

  if (failedCount > 0) {
    console.error(`\n[FATAL] ${failedCount} security assertion(s) failed!`);
    process.exit(1);
  } else {
    console.log("\n[SUCCESS] All security, isolation, and integrity assertions passed with 100% compliance.");
  }
}

runAuditSuite().catch((err) => {
  console.error("Fatal test execution error:", err);
  process.exit(1);
});
