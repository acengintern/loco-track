import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

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
  section: string;
  name: string;
  expected: string;
  actual: string;
  passed: boolean;
}

const testResults: TestResult[] = [];

function assert(condition: boolean, section: string, name: string, expected: string, actual: string) {
  testResults.push({ section, name, expected, actual, passed: condition });
  if (condition) {
    console.log(`  [PASS] [${section}] ${name} -> ${actual}`);
    totalPassed++;
  } else {
    console.error(`  [FAIL] [${section}] ${name} -> Expected: ${expected} | Actual: ${actual}`);
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
  console.log("===============================================================================");
  console.log("PHASE 10 VERIFICATION: CLIENT REVIEW, CLIENT REVISION LOOP, APPROVAL & PUBLICATION");
  console.log("===============================================================================\n");

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const adminAuth = await createAuthClient("admin@locotrack.local");
  const cdAuth = await createAuthClient("cd@locotrack.local");
  const aeAuth = await createAuthClient("ae@locotrack.local");
  const smsAuth = await createAuthClient("sms@locotrack.local");
  const designerAuth = await createAuthClient("designer@locotrack.local");
  const editorAuth = await createAuthClient("editor@locotrack.local");

  const { data: usersData } = await adminClient.from("profiles").select("id, email, role");
  const userMap = new Map((usersData || []).map((u) => [u.email, u]));

  const adminId = userMap.get("admin@locotrack.local")!.id;
  const smsId = userMap.get("sms@locotrack.local")!.id;
  const editorId = userMap.get("editor@locotrack.local")!.id;

  type AuthClientResult = Awaited<ReturnType<typeof createAuthClient>>;

  // Create or retrieve secondary SMS user for unauthorized role testing
  let otherSmsId: string;
  let otherSmsClient: AuthClientResult["client"];
  const otherSmsEmail = "sms_alt@locotrack.local";
  const existingOther = userMap.get(otherSmsEmail);
  if (existingOther) {
    otherSmsId = existingOther.id;
    const authRes = await createAuthClient(otherSmsEmail);
    otherSmsClient = authRes.client;
  } else {
    const { data: authUser, error: authErr } = await adminClient.auth.admin.createUser({
      email: otherSmsEmail,
      password: "password123",
      email_confirm: true,
      user_metadata: { full_name: "Alt SMS User", role: "SOCIAL_MEDIA_SPECIALIST" },
    });
    if (authErr || !authUser.user) {
      throw new Error(`Failed to create secondary SMS: ${authErr?.message}`);
    }
    otherSmsId = authUser.user.id;
    await adminClient.from("profiles").insert({
      id: otherSmsId,
      email: otherSmsEmail,
      full_name: "Alt SMS User",
      role: "SOCIAL_MEDIA_SPECIALIST",
    });
    const authRes = await createAuthClient(otherSmsEmail);
    otherSmsClient = authRes.client;
  }

  void otherSmsId;

  // Helper to commit deliverable
  async function uploadAndCommitDeliverable(
    uploaderAuth: AuthClientResult,
    taskId: string,
    fileName: string,
    mimeType: string,
    fileSize: number,
    fileType: "DESIGN" | "VIDEO"
  ): Promise<string> {
    const { data: alloc, error: allocErr } = await uploaderAuth.client.rpc("allocate_deliverable_upload", {
      p_task_id: taskId,
      p_file_name: fileName,
      p_file_type: fileType,
      p_mime_type: mimeType,
      p_file_size_bytes: fileSize,
    });
    if (allocErr || !alloc) throw new Error(allocErr?.message || "Upload allocation failed");

    // Upload to storage using admin client to ensure binary exists
    await adminClient.storage
      .from("project-deliverables")
      .upload(alloc.storage_path, Buffer.from("mock-binary-content-phase10"), {
        contentType: mimeType,
        upsert: true,
      });

    const { error: commitErr } = await uploaderAuth.client.rpc("commit_deliverable_file", {
      p_file_id: alloc.file_id,
      p_task_id: taskId,
      p_asset_group_id: alloc.asset_group_id,
      p_version: alloc.version,
      p_storage_path: alloc.storage_path,
      p_file_name: fileName,
      p_file_type: fileType,
      p_mime_type: mimeType,
      p_file_size_bytes: fileSize,
    });
    if (commitErr) {
      throw new Error(`Failed to commit deliverable file: ${commitErr.message}`);
    }

    return alloc.file_id;
  }

  // ---------------------------------------------------------------------------
  // 1. SETUP: Create Project and Advance to INTERNAL_QC with 2 Approved Tasks
  // ---------------------------------------------------------------------------
  console.log("1. Setting up Phase 10 test project through to INTERNAL_QC...");

  const { data: brand } = await adminClient
    .from("brands")
    .select("id, client_id")
    .is("deleted_at", null)
    .limit(1)
    .single();

  if (!brand) {
    throw new Error("No brand found in database. Seed data required.");
  }

  const { data: projData, error: projErr } = await smsAuth.client.rpc("create_project", {
    p_brand_id: brand.id,
    p_name: "Phase 10 Client Review Test Project",
    p_description: "Project for verifying Phase 10 Client Review, Revisions, Approval & Publication",
    p_priority: "HIGH",
    p_start_date: new Date().toISOString().split("T")[0],
    p_deadline: new Date(Date.now() + 864000000).toISOString(),
    p_sms_owner_id: smsAuth.user.id,
  });

  if (projErr || !projData) {
    throw new Error(`Failed to create test project: ${projErr?.message}`);
  }

  const projectId = (projData as { id: string }).id;

  // Add members
  await adminClient.from("project_members").insert([
    { project_id: projectId, user_id: cdAuth.user.id, role: "MEMBER" },
    { project_id: projectId, user_id: aeAuth.user.id, role: "MEMBER" },
    { project_id: projectId, user_id: designerAuth.user.id, role: "MEMBER" },
    { project_id: projectId, user_id: editorAuth.user.id, role: "MEMBER" },
  ]);

  // Brief
  await smsAuth.client.from("briefs").insert({
    project_id: projectId,
    objective: "Verify Phase 10 Client Review Workflow",
    target_audience: "Brand Consumers",
    key_message: "Client review and publication workflows are strictly bounded",
    deliverables_summary: "Graphics and Videos",
    created_by: smsAuth.user.id,
  });

  // Advance to CONTENT_PLANNING
  await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projectId,
    p_target_phase: "CONTENT_PLANNING",
  });

  // Create content plan
  await smsAuth.client.from("content_plans").insert({
    project_id: projectId,
    title: "Phase 10 Editorial Plan",
    channel: "Instagram",
    planned_post_date: "2026-09-25",
    copy_draft: "Phase 10 caption copy draft",
    status: "APPROVED",
    created_by: smsAuth.user.id,
  });

  // Mark script not required
  await smsAuth.client.rpc("set_project_script_not_required", {
    p_project_id: projectId,
    p_not_required: true,
  });

  // Advance to SCRIPT_READY
  await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projectId,
    p_target_phase: "SCRIPT_READY",
  });

  // Create Task 1 (Graphic Design -> Designer) & Task 2 (Video Editing -> Editor)
  const { data: t1Data, error: t1Err } = await smsAuth.client.rpc("create_production_task", {
    p_project_id: projectId,
    p_title: "Task 1 - Feed Graphic",
    p_task_type: "GRAPHIC_DESIGN",
    p_priority: "HIGH",
    p_deadline: new Date(Date.now() + 432000000).toISOString(),
    p_notes: "Create hero post graphic",
    p_content_plan_id: null,
    p_script_id: null,
    p_assignee_id: designerAuth.user.id,
  });
  if (t1Err || !t1Data) throw new Error(`Task 1 creation failed: ${t1Err?.message}`);
  const task1Id = (t1Data as { task_id: string }).task_id;

  const { data: t2Data, error: t2Err } = await smsAuth.client.rpc("create_production_task", {
    p_project_id: projectId,
    p_title: "Task 2 - Reel Edit",
    p_task_type: "VIDEO_EDITING",
    p_priority: "MEDIUM",
    p_deadline: new Date(Date.now() + 432000000).toISOString(),
    p_notes: "Edit promotional reel",
    p_content_plan_id: null,
    p_script_id: null,
    p_assignee_id: editorAuth.user.id,
  });
  if (t2Err || !t2Data) throw new Error(`Task 2 creation failed: ${t2Err?.message}`);
  const task2Id = (t2Data as { task_id: string }).task_id;

  // Advance to PRODUCTION
  const { error: startProdErr } = await smsAuth.client.rpc("start_production", { p_project_id: projectId });
  assert(!startProdErr, "SETUP", "Start Production RPC", "Success", startProdErr ? startProdErr.message : "Success");

  // Move Task 1 to IN_PROGRESS, upload v1, submit to IN_REVIEW
  await designerAuth.client.rpc("transition_task_status", { p_task_id: task1Id, p_new_status: "IN_PROGRESS" });
  const t1File1Id = await uploadAndCommitDeliverable(designerAuth, task1Id, "task1_v1.png", "image/png", 102400, "DESIGN");
  await designerAuth.client.rpc("transition_task_status", { p_task_id: task1Id, p_new_status: "IN_REVIEW" });

  // Move Task 2 to IN_PROGRESS, upload v1, submit to IN_REVIEW
  await editorAuth.client.rpc("transition_task_status", { p_task_id: task2Id, p_new_status: "IN_PROGRESS" });
  await uploadAndCommitDeliverable(editorAuth, task2Id, "task2_v1.mp4", "video/mp4", 1048576, "VIDEO");
  await editorAuth.client.rpc("transition_task_status", { p_task_id: task2Id, p_new_status: "IN_REVIEW" });

  // Project automatically enters INTERNAL_QC
  const { data: projQcState } = await adminClient.from("projects").select("status").eq("id", projectId).single();
  assert(projQcState?.status === "INTERNAL_QC", "SETUP", "Project entered INTERNAL_QC", "INTERNAL_QC", projQcState?.status || "null");

  // CD approves Task 1 v1 and Task 2 v1
  const cdApprove1 = await cdAuth.client.rpc("submit_qc_verdict", { p_task_id: task1Id, p_verdict: "APPROVED", p_notes: "Task 1 OK" });
  assert(cdApprove1.error === null, "SETUP", "CD Approves Task 1", "Success", cdApprove1.error ? cdApprove1.error.message : "Success");

  const cdApprove2 = await cdAuth.client.rpc("submit_qc_verdict", { p_task_id: task2Id, p_verdict: "APPROVED", p_notes: "Task 2 OK" });
  assert(cdApprove2.error === null, "SETUP", "CD Approves Task 2", "Success", cdApprove2.error ? cdApprove2.error.message : "Success");


  // ---------------------------------------------------------------------------
  // 2. GATE 1: START CLIENT REVIEW (INTERNAL_QC -> CLIENT_REVIEW)
  // ---------------------------------------------------------------------------
  console.log("\n2. Testing start_client_review authority and validation...");

  // Non-SMS callers cannot start client review
  const designerStart = await designerAuth.client.rpc("start_client_review", { p_project_id: projectId });
  assert(designerStart.error !== null && designerStart.error.message.includes("only assigned project SMS owner"), "GATE 1", "Designer cannot start client review", "Unauthorized", designerStart.error?.message || "Allowed");

  const editorStart = await editorAuth.client.rpc("start_client_review", { p_project_id: projectId });
  assert(editorStart.error !== null && editorStart.error.message.includes("only assigned project SMS owner"), "GATE 1", "Editor cannot start client review", "Unauthorized", editorStart.error?.message || "Allowed");

  const cdStart = await cdAuth.client.rpc("start_client_review", { p_project_id: projectId });
  assert(cdStart.error !== null && cdStart.error.message.includes("only assigned project SMS owner"), "GATE 1", "CD cannot start client review", "Unauthorized", cdStart.error?.message || "Allowed");

  const aeStart = await aeAuth.client.rpc("start_client_review", { p_project_id: projectId });
  assert(aeStart.error !== null && aeStart.error.message.includes("only assigned project SMS owner"), "GATE 1", "AE cannot start client review", "Unauthorized", aeStart.error?.message || "Allowed");

  const otherSmsStart = await otherSmsClient.rpc("start_client_review", { p_project_id: projectId });
  assert(otherSmsStart.error !== null && otherSmsStart.error.message.includes("only assigned project SMS owner"), "GATE 1", "Non-owner SMS cannot start client review", "Unauthorized", otherSmsStart.error?.message || "Allowed");

  // Owning SMS starts client review successfully
  const smsStart = await smsAuth.client.rpc("start_client_review", { p_project_id: projectId });
  assert(smsStart.error === null, "GATE 1", "Owning SMS starts client review", "Success", smsStart.error ? smsStart.error.message : "Success");

  // Verify project macro transition
  const { data: projAfterStart } = await adminClient.from("projects").select("status").eq("id", projectId).single();
  assert(projAfterStart?.status === "CLIENT_REVIEW", "GATE 1", "Project status is CLIENT_REVIEW", "CLIENT_REVIEW", projAfterStart?.status || "null");

  // Exactly ONE project_status_history row for INTERNAL_QC -> CLIENT_REVIEW
  const { data: statusHistoryStart } = await adminClient
    .from("project_status_history")
    .select("id")
    .eq("project_id", projectId)
    .eq("from_status", "INTERNAL_QC")
    .eq("to_status", "CLIENT_REVIEW");
  assert(statusHistoryStart?.length === 1, "GATE 1", "Exactly ONE project_status_history row for CLIENT_REVIEW transition", "1", String(statusHistoryStart?.length));

  // Client review round 1 header created
  const { data: clientRevRound1 } = await adminClient
    .from("client_reviews")
    .select("id, round_number, overall_verdict, submitted_by")
    .eq("project_id", projectId)
    .eq("round_number", 1)
    .single();
  assert(clientRevRound1?.round_number === 1, "GATE 1", "Client review round 1 created", "1", String(clientRevRound1?.round_number));
  assert(clientRevRound1?.overall_verdict === "PENDING", "GATE 1", "Round 1 verdict starts as PENDING", "PENDING", clientRevRound1?.overall_verdict || "null");
  assert(clientRevRound1?.submitted_by === smsId, "GATE 1", "Submitted by is owning SMS", smsId, clientRevRound1?.submitted_by || "null");

  // Activity log recorded
  const { data: startLog } = await adminClient
    .from("activity_logs")
    .select("event_type")
    .eq("project_id", projectId)
    .eq("event_type", "CLIENT_REVIEW_STARTED")
    .limit(1)
    .maybeSingle();
  assert(startLog?.event_type === "CLIENT_REVIEW_STARTED", "GATE 1", "Activity event CLIENT_REVIEW_STARTED logged", "CLIENT_REVIEW_STARTED", startLog?.event_type || "null");

  // Starting another review round while round 1 is PENDING blocked
  const duplicateStart = await smsAuth.client.rpc("start_client_review", { p_project_id: projectId });
  assert(duplicateStart.error !== null, "GATE 1", "Duplicate start_client_review blocked while round pending", "Blocked", duplicateStart.error?.message || "Allowed");


  // ---------------------------------------------------------------------------
  // 3. GATE 2: CLIENT VERDICTS RECORDING & REVISION LOOP TRIGGER
  // ---------------------------------------------------------------------------
  console.log("\n3. Testing client verdicts recording and client revision loop...");

  const round1Id = clientRevRound1!.id;

  // Non-SMS callers cannot record client verdicts
  const designerVerdict = await designerAuth.client.rpc("record_client_item_verdict", {
    p_review_id: round1Id,
    p_task_id: task1Id,
    p_verdict: "APPROVED",
  });
  assert(designerVerdict.error !== null && designerVerdict.error.message.includes("only assigned project SMS owner"), "GATE 2", "Designer cannot record client verdict", "Unauthorized", designerVerdict.error?.message || "Allowed");

  const otherSmsVerdict = await otherSmsClient.rpc("record_client_item_verdict", {
    p_review_id: round1Id,
    p_task_id: task1Id,
    p_verdict: "APPROVED",
  });
  assert(otherSmsVerdict.error !== null && otherSmsVerdict.error.message.includes("only assigned project SMS owner"), "GATE 2", "Non-owner SMS cannot record client verdict", "Unauthorized", otherSmsVerdict.error?.message || "Allowed");

  // Owning SMS records APPROVED on Task 1 (v1)
  const smsApproveT1 = await smsAuth.client.rpc("record_client_item_verdict", {
    p_review_id: round1Id,
    p_task_id: task1Id,
    p_verdict: "APPROVED",
  });
  assert(smsApproveT1.error === null, "GATE 2", "SMS records client APPROVED on Task 1", "Success", smsApproveT1.error ? smsApproveT1.error.message : "Success");

  // Task 1 remains APPROVED
  const { data: t1State } = await adminClient.from("tasks").select("status").eq("id", task1Id).single();
  assert(t1State?.status === "APPROVED", "GATE 2", "Task 1 status remains APPROVED", "APPROVED", t1State?.status || "null");

  // Activity log recorded
  const { data: t1ApproveLog } = await adminClient
    .from("activity_logs")
    .select("event_type")
    .eq("project_id", projectId)
    .eq("event_type", "CLIENT_APPROVED_ITEM")
    .limit(1)
    .maybeSingle();
  assert(t1ApproveLog?.event_type === "CLIENT_APPROVED_ITEM", "GATE 2", "Activity event CLIENT_APPROVED_ITEM logged", "CLIENT_APPROVED_ITEM", t1ApproveLog?.event_type || "null");

  // Duplicate verdict on same task in same round blocked
  const duplicateT1 = await smsAuth.client.rpc("record_client_item_verdict", {
    p_review_id: round1Id,
    p_task_id: task1Id,
    p_verdict: "APPROVED",
  });
  assert(duplicateT1.error !== null && duplicateT1.error.message.includes("Verdict already recorded"), "GATE 2", "Duplicate verdict on task in same round blocked", "Blocked", duplicateT1.error?.message || "Allowed");

  // Client revision without feedback notes rejected
  const emptyFeedback = await smsAuth.client.rpc("record_client_item_verdict", {
    p_review_id: round1Id,
    p_task_id: task2Id,
    p_verdict: "REVISION_REQUESTED",
    p_feedback: "   ",
  });
  assert(emptyFeedback.error !== null && emptyFeedback.error.message.includes("feedback notes are required"), "GATE 2", "Client revision without feedback notes rejected", "Rejected", emptyFeedback.error?.message || "Allowed");

  // Client revision on Task 2 with valid feedback
  const clientFeedback = "Klien meminta font judul diperbesar dan warna aksen disesuaikan dengan panduan brand.";
  const smsReviseT2 = await smsAuth.client.rpc("record_client_item_verdict", {
    p_review_id: round1Id,
    p_task_id: task2Id,
    p_verdict: "REVISION_REQUESTED",
    p_feedback: clientFeedback,
  });
  assert(smsReviseT2.error === null, "GATE 2", "SMS records client REVISION_REQUESTED on Task 2", "Success", smsReviseT2.error ? smsReviseT2.error.message : "Success");

  // Task 2 transitions APPROVED -> REVISION_REQUESTED
  const { data: t2StateAfterRev } = await adminClient.from("tasks").select("status").eq("id", task2Id).single();
  assert(t2StateAfterRev?.status === "REVISION_REQUESTED", "GATE 2", "Task 2 transitions to REVISION_REQUESTED", "REVISION_REQUESTED", t2StateAfterRev?.status || "null");

  // Verify revision_requests record created with source = 'CLIENT'
  const { data: clientRevReq } = await adminClient
    .from("revision_requests")
    .select("id, source, status, notes, assigned_to, round_number")
    .eq("task_id", task2Id)
    .eq("source", "CLIENT")
    .single();
  assert(clientRevReq?.source === "CLIENT", "GATE 2", "revision_requests source is CLIENT", "CLIENT", clientRevReq?.source || "null");
  assert(clientRevReq?.status === "OPEN", "GATE 2", "revision_requests status is OPEN", "OPEN", clientRevReq?.status || "null");
  assert(clientRevReq?.assigned_to === editorId, "GATE 2", "revision assigned to task PIC (Editor)", editorId, clientRevReq?.assigned_to || "null");
  assert(clientRevReq?.notes === clientFeedback, "GATE 2", "revision notes match client feedback", clientFeedback, clientRevReq?.notes || "null");

  // Activity log logged
  const { data: revLog } = await adminClient
    .from("activity_logs")
    .select("event_type")
    .eq("project_id", projectId)
    .eq("event_type", "CLIENT_REVISION_REQUESTED")
    .limit(1)
    .maybeSingle();
  assert(revLog?.event_type === "CLIENT_REVISION_REQUESTED", "GATE 2", "Activity event CLIENT_REVISION_REQUESTED logged", "CLIENT_REVISION_REQUESTED", revLog?.event_type || "null");

  // Since both tasks are now evaluated in round 1, round 1 overall_verdict automatically finalized as REVISION_REQUESTED
  const { data: round1Final } = await adminClient.from("client_reviews").select("overall_verdict").eq("id", round1Id).single();
  assert(round1Final?.overall_verdict === "REVISION_REQUESTED", "GATE 2", "Round 1 auto-finalized as REVISION_REQUESTED", "REVISION_REQUESTED", round1Final?.overall_verdict || "null");

  // Invariant: Project macro state remains CLIENT_REVIEW throughout revision loop
  const { data: projDuringRev } = await adminClient.from("projects").select("status").eq("id", projectId).single();
  assert(projDuringRev?.status === "CLIENT_REVIEW", "GATE 2", "Project remains in CLIENT_REVIEW during task revisions", "CLIENT_REVIEW", projDuringRev?.status || "null");


  // ---------------------------------------------------------------------------
  // 4. GATE 3: CREATIVE RESUMPTION & NEW DELIVERABLE VERSION ENFORCEMENT
  // ---------------------------------------------------------------------------
  console.log("\n4. Testing creative revision resumption and new version gate...");

  // Editor resumes revision work
  const resumeRes = await editorAuth.client.rpc("transition_task_status", {
    p_task_id: task2Id,
    p_new_status: "IN_PROGRESS",
  });
  assert(resumeRes.error === null, "GATE 3", "Editor transitions Task 2 to IN_PROGRESS", "Success", resumeRes.error ? resumeRes.error.message : "Success");

  // Revision request moved to IN_PROGRESS
  const { data: revReqProg } = await adminClient.from("revision_requests").select("status").eq("id", clientRevReq!.id).single();
  assert(revReqProg?.status === "IN_PROGRESS", "GATE 3", "revision_requests moved to IN_PROGRESS", "IN_PROGRESS", revReqProg?.status || "null");

  // Editor attempts to resubmit to IN_REVIEW WITHOUT uploading a new deliverable version (current is still v1)
  const staleResubmit = await editorAuth.client.rpc("transition_task_status", {
    p_task_id: task2Id,
    p_new_status: "IN_REVIEW",
  });
  assert(staleResubmit.error !== null && staleResubmit.error.message.includes("without uploading a new version"), "GATE 3", "Resubmission without new version blocked", "Blocked", staleResubmit.error?.message || "Allowed");

  // Editor uploads v2 deliverable
  const t2File2Id = await uploadAndCommitDeliverable(editorAuth, task2Id, "task2_v2.mp4", "video/mp4", 1048576, "VIDEO");
  assert(t2File2Id !== null, "GATE 3", "Editor commits Task 2 v2 deliverable", "Committed", t2File2Id);

  // Editor resubmits with v2
  const validResubmit = await editorAuth.client.rpc("transition_task_status", {
    p_task_id: task2Id,
    p_new_status: "IN_REVIEW",
  });
  assert(validResubmit.error === null, "GATE 3", "Resubmission with v2 deliverable succeeds", "Success", validResubmit.error ? validResubmit.error.message : "Success");

  // Client revision request transitioned to RESOLVED atomically
  const { data: revReqResolved } = await adminClient.from("revision_requests").select("status, resolved_at").eq("id", clientRevReq!.id).single();
  assert(revReqResolved?.status === "RESOLVED", "GATE 3", "revision_requests transitioned to RESOLVED", "RESOLVED", revReqResolved?.status || "null");
  assert(revReqResolved?.resolved_at !== null, "GATE 3", "resolved_at timestamp set", "Set", revReqResolved?.resolved_at ? "Set" : "null");


  // ---------------------------------------------------------------------------
  // 5. GATE 4: DECISION D-002: MANDATORY CD RE-QC BEFORE RE-PRESENTATION
  // ---------------------------------------------------------------------------
  console.log("\n5. Testing Decision D-002: Mandatory CD re-QC before re-presentation...");

  // SMS attempting to start client re-presentation while Task 2 is in IN_REVIEW must be rejected
  const prematureRePresent = await smsAuth.client.rpc("start_client_re_presentation", {
    p_project_id: projectId,
  });
  assert(prematureRePresent.error !== null && prematureRePresent.error.message.includes("not internally APPROVED"), "GATE 4", "Re-presentation blocked while task in IN_REVIEW", "Blocked", prematureRePresent.error?.message || "Allowed");

  // Internal QC loop during client revision:
  // Suppose CD reviews Task 2 v2 and requests an internal adjustment first
  const cdRejectV2 = await cdAuth.client.rpc("submit_qc_verdict", {
    p_task_id: task2Id,
    p_verdict: "REVISION_REQUESTED",
    p_notes: "CD note: Sesuaikan transisi detik ke-3.",
  });
  assert(cdRejectV2.error === null, "GATE 4", "CD requests internal revision on v2", "Success", cdRejectV2.error ? cdRejectV2.error.message : "Success");

  // Task 2 moves back to REVISION_REQUESTED (source = INTERNAL_QC)
  const { data: t2StateIntRev } = await adminClient.from("tasks").select("status").eq("id", task2Id).single();
  assert(t2StateIntRev?.status === "REVISION_REQUESTED", "GATE 4", "Task 2 in REVISION_REQUESTED from internal QC", "REVISION_REQUESTED", t2StateIntRev?.status || "null");

  // Editor resumes, uploads v3, and resubmits
  await editorAuth.client.rpc("transition_task_status", { p_task_id: task2Id, p_new_status: "IN_PROGRESS" });
  await uploadAndCommitDeliverable(editorAuth, task2Id, "task2_v3.mp4", "video/mp4", 1048576, "VIDEO");
  await editorAuth.client.rpc("transition_task_status", { p_task_id: task2Id, p_new_status: "IN_REVIEW" });

  // CD approves Task 2 v3
  const cdApproveV3 = await cdAuth.client.rpc("submit_qc_verdict", {
    p_task_id: task2Id,
    p_verdict: "APPROVED",
    p_notes: "CD Approved v3",
  });
  assert(cdApproveV3.error === null, "GATE 4", "CD approves Task 2 v3", "Success", cdApproveV3.error ? cdApproveV3.error.message : "Success");

  // Both Task 1 and Task 2 are now internally APPROVED
  const { data: allApprovedTasks } = await adminClient
    .from("tasks")
    .select("id, status")
    .eq("project_id", projectId)
    .eq("status", "APPROVED");
  assert(allApprovedTasks?.length === 2, "GATE 4", "Both tasks are now internally APPROVED", "2", String(allApprovedTasks?.length));


  // ---------------------------------------------------------------------------
  // 6. GATE 5: RE-PRESENTATION TO CLIENT (ROUND 2)
  // ---------------------------------------------------------------------------
  console.log("\n6. Testing re-presentation to client (Round 2)...");

  // Non-SMS callers cannot start re-presentation
  const designerRePresent = await designerAuth.client.rpc("start_client_re_presentation", { p_project_id: projectId });
  assert(designerRePresent.error !== null && designerRePresent.error.message.includes("only assigned project SMS owner"), "GATE 5", "Designer cannot start re-presentation", "Unauthorized", designerRePresent.error?.message || "Allowed");

  // Owning SMS starts re-presentation
  const smsRePresent = await smsAuth.client.rpc("start_client_re_presentation", { p_project_id: projectId });
  assert(smsRePresent.error === null, "GATE 5", "SMS starts client re-presentation", "Success", smsRePresent.error ? smsRePresent.error.message : "Success");

  // Round 2 created
  const { data: clientRevRound2 } = await adminClient
    .from("client_reviews")
    .select("id, round_number, overall_verdict")
    .eq("project_id", projectId)
    .eq("round_number", 2)
    .single();
  assert(clientRevRound2?.round_number === 2, "GATE 5", "Client review round 2 created", "2", String(clientRevRound2?.round_number));
  assert(clientRevRound2?.overall_verdict === "PENDING", "GATE 5", "Round 2 overall_verdict is PENDING", "PENDING", clientRevRound2?.overall_verdict || "null");

  // Activity log CLIENT_REVIEW_RESUBMITTED recorded
  const { data: resubmitLog } = await adminClient
    .from("activity_logs")
    .select("event_type")
    .eq("project_id", projectId)
    .eq("event_type", "CLIENT_REVIEW_RESUBMITTED")
    .limit(1)
    .maybeSingle();
  assert(resubmitLog?.event_type === "CLIENT_REVIEW_RESUBMITTED", "GATE 5", "Activity event CLIENT_REVIEW_RESUBMITTED logged", "CLIENT_REVIEW_RESUBMITTED", resubmitLog?.event_type || "null");

  const round2Id = clientRevRound2!.id;

  // SMS records client verdict for Task 1 (v1) in round 2: APPROVED
  const r2ApproveT1 = await smsAuth.client.rpc("record_client_item_verdict", {
    p_review_id: round2Id,
    p_task_id: task1Id,
    p_verdict: "APPROVED",
  });
  assert(r2ApproveT1.error === null, "GATE 5", "Client approves Task 1 in round 2", "Success", r2ApproveT1.error ? r2ApproveT1.error.message : "Success");

  // SMS records client verdict for Task 2 (v3) in round 2: APPROVED
  const r2ApproveT2 = await smsAuth.client.rpc("record_client_item_verdict", {
    p_review_id: round2Id,
    p_task_id: task2Id,
    p_verdict: "APPROVED",
    p_feedback: "Klien menyetujui versi 3 sepenuhnya.",
  });
  assert(r2ApproveT2.error === null, "GATE 5", "Client approves Task 2 v3 in round 2", "Success", r2ApproveT2.error ? r2ApproveT2.error.message : "Success");

  // Round 2 auto-finalizes as APPROVED
  const { data: round2Final } = await adminClient.from("client_reviews").select("overall_verdict").eq("id", round2Id).single();
  assert(round2Final?.overall_verdict === "APPROVED", "GATE 5", "Round 2 auto-finalized as APPROVED", "APPROVED", round2Final?.overall_verdict || "null");


  // ---------------------------------------------------------------------------
  // 7. GATE 6: PROJECT FINAL APPROVAL (CLIENT_REVIEW -> APPROVED)
  // ---------------------------------------------------------------------------
  console.log("\n7. Testing finalize_client_approval...");

  // Non-SMS callers cannot finalize approval
  const designerFinalize = await designerAuth.client.rpc("finalize_client_approval", { p_project_id: projectId });
  assert(designerFinalize.error !== null && designerFinalize.error.message.includes("only assigned project SMS owner"), "GATE 6", "Designer cannot finalize client approval", "Unauthorized", designerFinalize.error?.message || "Allowed");

  const cdFinalize = await cdAuth.client.rpc("finalize_client_approval", { p_project_id: projectId });
  assert(cdFinalize.error !== null && cdFinalize.error.message.includes("only assigned project SMS owner"), "GATE 6", "CD cannot finalize client approval", "Unauthorized", cdFinalize.error?.message || "Allowed");

  // Owning SMS finalizes client approval
  const smsFinalize = await smsAuth.client.rpc("finalize_client_approval", { p_project_id: projectId });
  assert(smsFinalize.error === null, "GATE 6", "Owning SMS finalizes client approval", "Success", smsFinalize.error ? smsFinalize.error.message : "Success");

  // Project transitions to APPROVED
  const { data: projApproved } = await adminClient.from("projects").select("status").eq("id", projectId).single();
  assert(projApproved?.status === "APPROVED", "GATE 6", "Project status is APPROVED", "APPROVED", projApproved?.status || "null");

  // Exactly ONE project_status_history row for CLIENT_REVIEW -> APPROVED
  const { data: statusHistoryApprove } = await adminClient
    .from("project_status_history")
    .select("id")
    .eq("project_id", projectId)
    .eq("from_status", "CLIENT_REVIEW")
    .eq("to_status", "APPROVED");
  assert(statusHistoryApprove?.length === 1, "GATE 6", "Exactly ONE project_status_history row for APPROVED transition", "1", String(statusHistoryApprove?.length));

  // Activity log CLIENT_APPROVED recorded
  const { data: clientApprovedLog } = await adminClient
    .from("activity_logs")
    .select("event_type")
    .eq("project_id", projectId)
    .eq("event_type", "CLIENT_APPROVED")
    .limit(1)
    .maybeSingle();
  assert(clientApprovedLog?.event_type === "CLIENT_APPROVED", "GATE 6", "Activity event CLIENT_APPROVED logged", "CLIENT_APPROVED", clientApprovedLog?.event_type || "null");

  // Idempotency: Calling finalize_client_approval again succeeds cleanly
  const idempotentFinalize = await smsAuth.client.rpc("finalize_client_approval", { p_project_id: projectId });
  assert(idempotentFinalize.error === null, "GATE 6", "Idempotent finalize_client_approval succeeds", "Success", idempotentFinalize.error ? idempotentFinalize.error.message : "Success");


  // ---------------------------------------------------------------------------
  // 8. GATE 7: PUBLICATION WORKFLOW (APPROVED -> PUBLISHED)
  // ---------------------------------------------------------------------------
  console.log("\n8. Testing publish_project and publication immutability...");

  // Non-SMS callers cannot publish
  const designerPublish = await designerAuth.client.rpc("publish_project", {
    p_project_id: projectId,
    p_publication_url: "https://instagram.com/p/test12345",
  });
  assert(designerPublish.error !== null && designerPublish.error.message.includes("only assigned project SMS owner"), "GATE 7", "Designer cannot publish project", "Unauthorized", designerPublish.error?.message || "Allowed");

  // Invalid publication URLs rejected
  const emptyUrlPublish = await smsAuth.client.rpc("publish_project", {
    p_project_id: projectId,
    p_publication_url: "",
  });
  assert(emptyUrlPublish.error !== null && emptyUrlPublish.error.message.includes("Publication URL is required"), "GATE 7", "Empty publication URL rejected", "Rejected", emptyUrlPublish.error?.message || "Allowed");

  const badProtoPublish = await smsAuth.client.rpc("publish_project", {
    p_project_id: projectId,
    p_publication_url: "javascript:alert(1)",
  });
  assert(badProtoPublish.error !== null && badProtoPublish.error.message.includes("Invalid publication URL"), "GATE 7", "Javascript protocol URL rejected", "Rejected", badProtoPublish.error?.message || "Allowed");

  const invalidDomainPublish = await smsAuth.client.rpc("publish_project", {
    p_project_id: projectId,
    p_publication_url: "not-a-valid-url",
  });
  assert(invalidDomainPublish.error !== null && invalidDomainPublish.error.message.includes("Invalid publication URL"), "GATE 7", "Non-web URL rejected", "Rejected", invalidDomainPublish.error?.message || "Allowed");

  // Valid publication URL succeeds
  const validPubUrl = "https://instagram.com/p/Cxyz12345678";
  const validPubNote = "Konten tayang sesuai jadwal pukul 19:00 WIB";
  const smsPublish = await smsAuth.client.rpc("publish_project", {
    p_project_id: projectId,
    p_publication_url: validPubUrl,
    p_publish_note: validPubNote,
  });
  assert(smsPublish.error === null, "GATE 7", "SMS publishes project successfully", "Success", smsPublish.error ? smsPublish.error.message : "Success");

  // Verify project in PUBLISHED status and publication fields populated
  const { data: projPublished } = await adminClient
    .from("projects")
    .select("status, publication_url, publish_note, published_at, published_by")
    .eq("id", projectId)
    .single();
  assert(projPublished?.status === "PUBLISHED", "GATE 7", "Project status is PUBLISHED", "PUBLISHED", projPublished?.status || "null");
  assert(projPublished?.publication_url === validPubUrl, "GATE 7", "publication_url matches input", validPubUrl, projPublished?.publication_url || "null");
  assert(projPublished?.publish_note === validPubNote, "GATE 7", "publish_note matches input", validPubNote, projPublished?.publish_note || "null");
  assert(projPublished?.published_by === smsId, "GATE 7", "published_by is SMS user", smsId, projPublished?.published_by || "null");
  assert(projPublished?.published_at !== null, "GATE 7", "published_at timestamp set", "Set", projPublished?.published_at ? "Set" : "null");

  // Exactly ONE project_status_history row for APPROVED -> PUBLISHED
  const { data: statusHistoryPublish } = await adminClient
    .from("project_status_history")
    .select("id")
    .eq("project_id", projectId)
    .eq("from_status", "APPROVED")
    .eq("to_status", "PUBLISHED");
  assert(statusHistoryPublish?.length === 1, "GATE 7", "Exactly ONE project_status_history row for PUBLISHED transition", "1", String(statusHistoryPublish?.length));

  // Activity log PROJECT_PUBLISHED recorded
  const { data: publishedLog } = await adminClient
    .from("activity_logs")
    .select("event_type")
    .eq("project_id", projectId)
    .eq("event_type", "PROJECT_PUBLISHED")
    .limit(1)
    .maybeSingle();
  assert(publishedLog?.event_type === "PROJECT_PUBLISHED", "GATE 7", "Activity event PROJECT_PUBLISHED logged", "PROJECT_PUBLISHED", publishedLog?.event_type || "null");

  // Idempotency: Calling publish_project on already PUBLISHED project succeeds cleanly
  const idempotentPublish = await smsAuth.client.rpc("publish_project", {
    p_project_id: projectId,
    p_publication_url: validPubUrl,
  });
  assert(idempotentPublish.error === null, "GATE 7", "Idempotent publish_project succeeds", "Success", idempotentPublish.error ? idempotentPublish.error.message : "Success");


  // ---------------------------------------------------------------------------
  // 9. GATE 8: IMMUTABILITY & ANTI-MUTATION BOUNDARIES
  // ---------------------------------------------------------------------------
  console.log("\n9. Testing immutability & audit integrity triggers...");

  // Status reversion of a PUBLISHED project blocked
  const revertStatus = await smsAuth.client
    .from("projects")
    .update({ status: "APPROVED" })
    .eq("id", projectId);
  assert(revertStatus.error !== null && revertStatus.error.message.includes("Cannot revert or change status of a PUBLISHED project"), "GATE 8", "Reverting status of PUBLISHED project blocked", "Blocked", revertStatus.error?.message || "Allowed");

  // Direct UPDATE on publication_url by non-admin blocked
  const tamperUrl = await smsAuth.client
    .from("projects")
    .update({ publication_url: "https://tampered.com" })
    .eq("id", projectId);
  assert(tamperUrl.error !== null && tamperUrl.error.message.includes("publication_url is immutable once project is published"), "GATE 8", "Tampering publication_url by non-admin blocked", "Blocked", tamperUrl.error?.message || "Allowed");

  // Soft deletion of deliverable file when project in PUBLISHED blocked
  const deleteFileInPub = await smsAuth.client.rpc("soft_delete_project_file", {
    p_file_id: t1File1Id,
  });
  assert(deleteFileInPub.error !== null && (deleteFileInPub.error.message.includes("Cannot delete deliverable file that has been presented") || deleteFileInPub.error.message.includes("PUBLISHED")), "GATE 8", "Soft deletion of client-presented deliverable in PUBLISHED blocked", "Blocked", deleteFileInPub.error?.message || "Allowed");

  // Physical DELETE on client_reviews blocked
  const deleteClientReview = await smsAuth.client
    .from("client_reviews")
    .delete()
    .eq("id", round1Id);
  assert(deleteClientReview.error !== null && deleteClientReview.error.message.includes("Physical DELETE on client_reviews is strictly forbidden"), "GATE 8", "Physical DELETE on client_reviews blocked", "Blocked", deleteClientReview.error?.message || "Allowed");

  // Direct UPDATE on client_review_items blocked
  const updateReviewItem = await smsAuth.client
    .from("client_review_items")
    .update({ verdict: "REVISION_REQUESTED" })
    .eq("client_review_id", round1Id)
    .eq("task_id", task1Id);
  assert(updateReviewItem.error !== null && updateReviewItem.error.message.includes("append-only"), "GATE 8", "Direct UPDATE on client_review_items blocked", "Blocked", updateReviewItem.error?.message || "Allowed");

  // Direct DELETE on client_review_items blocked
  const deleteReviewItem = await smsAuth.client
    .from("client_review_items")
    .delete()
    .eq("client_review_id", round1Id)
    .eq("task_id", task1Id);
  assert(deleteReviewItem.error !== null && deleteReviewItem.error.message.includes("append-only"), "GATE 8", "Direct DELETE on client_review_items blocked", "Blocked", deleteReviewItem.error?.message || "Allowed");


  // ---------------------------------------------------------------------------
  // 10. GATE 9: ACTIVITY LOGS ANTI-FORGERY ACROSS ALL ROLES
  // ---------------------------------------------------------------------------
  console.log("\n10. Testing activity logs anti-forgery across all roles...");

  const protectedEvents = [
    "CLIENT_REVIEW_STARTED",
    "CLIENT_APPROVED_ITEM",
    "CLIENT_REVISION_REQUESTED",
    "CLIENT_REVIEW_RESUBMITTED",
    "CLIENT_APPROVED",
    "PROJECT_PUBLISHED",
  ];

  const roleClients = [
    { role: "ADMIN", client: adminAuth.client },
    { role: "CREATIVE_DIRECTOR", client: cdAuth.client },
    { role: "ACCOUNT_EXECUTIVE", client: aeAuth.client },
    { role: "SOCIAL_MEDIA_SPECIALIST", client: smsAuth.client },
    { role: "DESIGNER", client: designerAuth.client },
    { role: "VIDEO_EDITOR", client: editorAuth.client },
  ];

  for (const { role, client } of roleClients) {
    for (const evt of protectedEvents) {
      const forgeryAttempt = await client.from("activity_logs").insert({
        project_id: projectId,
        user_id: userMap.get(`${role.toLowerCase()}@locotrack.local`)?.id || adminId,
        event_type: evt,
        metadata: { forged: true },
      });
      assert(
        forgeryAttempt.error !== null,
        "GATE 9",
        `${role} direct insert of ${evt} blocked`,
        "Blocked by trigger",
        forgeryAttempt.error ? "Blocked by trigger" : "Allowed"
      );
    }
  }

  // ---------------------------------------------------------------------------
  // FINAL REPORT
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log(`PHASE 10 VERIFICATION COMPLETE: ${totalPassed} Passed, ${totalFailed} Failed`);
  console.log("===============================================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unhandled error in Phase 10 verification:", err);
  process.exit(1);
});
