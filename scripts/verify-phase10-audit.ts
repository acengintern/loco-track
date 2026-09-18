/**
 * LOCO TRACK - Phase 10.1 Client Review, Publication & Concurrency Audit Verification Suite
 *
 * Exhaustively validates:
 * 1. Single active client review round invariant (partial unique index uq_client_reviews_one_active_per_project)
 * 2. Client review header mutation security (direct INSERT/UPDATE blocked, identity immutable)
 * 3. Exact presentation artifact binding (deliverable_file_id and version bound to QC-approved file)
 * 4. Newer unapproved version edge case (candidate does NOT silently become unapproved v4)
 * 5. Decision D-002 strict re-presentation lifecycle (v1 -> client rev -> v2 -> CD rev -> v3 -> CD app -> re-present v3)
 * 6. Client revision request lifecycle (OPEN -> IN_PROGRESS -> RESOLVED upon v_new resubmission)
 * 7. One active revision request across sources (uq_one_active_revision_per_task)
 * 8. Client item verdict immutability (direct UPDATE/DELETE blocked, repeated RPC blocked)
 * 9. Client verdict concurrency (APPROVED vs REVISION_REQUESTED: exactly one wins, state coherent)
 * 10. Approve vs Approve concurrency (two simultaneous approvals: 1 effective verdict, 0 duplicate logs)
 * 11. Mixed round semantics (Task A approved in R1, Task B revised in R2; final approval combines both)
 * 12. Final project approval derivation (rigorous multi-condition check)
 * 13. Project approval concurrency (two simultaneous finalize_client_approval: exactly 1 transition, +1 history, clean no-op)
 * 14. Client review start concurrency (two simultaneous start_client_review: exactly 1 round, clean failure)
 * 15. Status history single-source (+1 row per macro transition from trigger only)
 * 16. Activity idempotency (CLIENT_REVIEW_STARTED, CLIENT_APPROVED, PROJECT_PUBLISHED emitted once)
 * 17. Publication concurrency (two simultaneous publish_project: exactly 1 succeeds, clean no-op)
 * 18. Publication URL immutability (blocked for all roles including Admin via ordinary update)
 * 19. Invalid publication URL tests (reject empty, whitespace, javascript:, data:, file:, ftp:, malformed)
 * 20. Published terminal boundary (PUBLISHED -> DONE strictly unavailable)
 * 21. Task completion boundary (publication leaves tasks in APPROVED status, no auto-completion)
 * 22. Presented artifact protection (soft delete and physical delete blocked for client-presented files)
 * 23. Client review direct table security (direct INSERT, UPDATE, DELETE blocked across all roles)
 * 24. Client review RPC authority (owning SMS PASS; non-owner SMS, AE, CD, Designer, Editor, Admin FAIL)
 * 25. Activity forgery prevention across all roles (direct insert blocked for all client-review events)
 * 26. No client portal audit (codebase inspection)
 * 27. No DONE audit (codebase inspection)
 */

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

function assert(condition: boolean, section: string, name: string, expected: string, actual: string) {
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

async function runPhase10Audit() {
  console.log("===============================================================================");
  console.log("LOCO TRACK - Phase 10.1 Client Review, Publication & Concurrency Audit Suite");
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

  // Secondary SMS user for non-owner authority testing
  const otherSmsEmail = "sms2@locotrack.local";
  let otherSmsAuth: Awaited<ReturnType<typeof createAuthClient>>;
  try {
    otherSmsAuth = await createAuthClient(otherSmsEmail);
  } catch {
    const { data: authUser, error: authErr } = await adminClient.auth.admin.createUser({
      email: otherSmsEmail,
      password: "password123",
      email_confirm: true,
      user_metadata: { full_name: "Alt SMS User", role: "SOCIAL_MEDIA_SPECIALIST" },
    });
    if (authErr || !authUser.user) {
      throw new Error(`Failed to create secondary SMS: ${authErr?.message}`);
    }
    await adminClient.from("profiles").insert({
      id: authUser.user.id,
      email: otherSmsEmail,
      full_name: "Alt SMS User",
      role: "SOCIAL_MEDIA_SPECIALIST",
    });
    otherSmsAuth = await createAuthClient(otherSmsEmail);
  }

  // Helper to create a complete project with tasks in INTERNAL_QC phase
  async function createReadyProject(codeSuffix: string) {
    const { data: brand } = await adminClient.from("brands").select("id").limit(1).single();
    const projectCode = `AUD10-${Date.now().toString().slice(-4)}-${codeSuffix}`;

    const { data: project, error: projErr } = await adminClient
      .from("projects")
      .insert({
        name: `Audit Project ${projectCode}`,
        project_code: projectCode,
        brand_id: brand!.id,
        sms_owner_id: smsAuth.user.id,
        created_by: smsAuth.user.id,
        deadline: new Date(Date.now() + 864000000).toISOString(),
        status: "PRODUCTION",
      })
      .select()
      .single();

    if (projErr || !project) {
      throw new Error(`Failed to create project: ${projErr?.message}`);
    }

    // Add assigned creatives as project members so project-level RLS recognizes them
    await adminClient.from("project_members").insert([
      { project_id: project.id, user_id: designerAuth.user.id },
      { project_id: project.id, user_id: editorAuth.user.id },
    ]);

    // Task 1: Graphic Design
    const { data: task1, error: t1Err } = await adminClient
      .from("tasks")
      .insert({
        project_id: project.id,
        title: "Task 1 Design Deliverable",
        task_type: "GRAPHIC_DESIGN",
        status: "APPROVED",
        current_assignee_id: designerAuth.user.id,
        deadline: new Date(Date.now() + 432000000).toISOString(),
        requires_qc: true,
      })
      .select()
      .single();

    if (t1Err || !task1) throw new Error(`Failed to create task1: ${t1Err?.message}`);

    const assetGroupId1 = crypto.randomUUID();
    const { data: file1, error: f1Err } = await adminClient
      .from("project_files")
      .insert({
        project_id: project.id,
        task_id: task1.id,
        uploaded_by: designerAuth.user.id,
        asset_group_id: assetGroupId1,
        version: 1,
        file_name: "design_v1.png",
        storage_path: `projects/${project.id}/tasks/${task1.id}/design_v1.png`,
        storage_bucket: "deliverables",
        file_type: "DESIGN",
        mime_type: "image/png",
        file_size_bytes: 102400,
      })
      .select()
      .single();

    if (f1Err || !file1) throw new Error(`Failed to create file1: ${f1Err?.message}`);

    const { error: qc1Err } = await adminClient.from("qc_reviews").insert({
      project_id: project.id,
      task_id: task1.id,
      reviewer_id: cdAuth.user.id,
      file_id: file1.id,
      round_number: 1,
      result: "APPROVED",
      notes: "Approved design v1 for client presentation",
    });

    if (qc1Err) throw new Error(`Failed to create qc1: ${qc1Err.message}`);

    // Task 2: Video Editing
    const { data: task2, error: t2Err } = await adminClient
      .from("tasks")
      .insert({
        project_id: project.id,
        title: "Task 2 Video Deliverable",
        task_type: "VIDEO_EDITING",
        status: "APPROVED",
        current_assignee_id: editorAuth.user.id,
        deadline: new Date(Date.now() + 432000000).toISOString(),
        requires_qc: true,
      })
      .select()
      .single();

    if (t2Err || !task2) throw new Error(`Failed to create task2: ${t2Err?.message}`);

    const assetGroupId2 = crypto.randomUUID();
    const { data: file2, error: f2Err } = await adminClient
      .from("project_files")
      .insert({
        project_id: project.id,
        task_id: task2.id,
        uploaded_by: editorAuth.user.id,
        asset_group_id: assetGroupId2,
        version: 1,
        file_name: "video_v1.mp4",
        storage_path: `projects/${project.id}/tasks/${task2.id}/video_v1.mp4`,
        storage_bucket: "deliverables",
        file_type: "VIDEO",
        mime_type: "video/mp4",
        file_size_bytes: 204800,
      })
      .select()
      .single();

    if (f2Err || !file2) throw new Error(`Failed to create file2: ${f2Err?.message}`);

    const { error: qc2Err } = await adminClient.from("qc_reviews").insert({
      project_id: project.id,
      task_id: task2.id,
      reviewer_id: cdAuth.user.id,
      file_id: file2.id,
      round_number: 1,
      result: "APPROVED",
      notes: "Approved video v1 for client presentation",
    });

    if (qc2Err) throw new Error(`Failed to create qc2: ${qc2Err.message}`);

    // Transition project to INTERNAL_QC
    await adminClient.from("projects").update({ status: "INTERNAL_QC" }).eq("id", project.id);

    return { project, task1, task2, file1, file2 };
  }

  async function uploadAndCommitDeliverable(
    uploaderAuth: Awaited<ReturnType<typeof createAuthClient>>,
    taskId: string,
    fileName: string,
    mimeType: string,
    fileSize: number,
    fileType: "DESIGN" | "VIDEO"
  ): Promise<string> {
    const { data: rawAlloc, error: allocErr } = await uploaderAuth.client.rpc("allocate_deliverable_upload", {
      p_task_id: taskId,
      p_file_name: fileName,
      p_file_type: fileType,
      p_mime_type: mimeType,
      p_file_size_bytes: fileSize,
    });
    if (allocErr || !rawAlloc) throw new Error(allocErr?.message || "Upload allocation failed");
    const alloc = rawAlloc as {
      file_id: string;
      asset_group_id: string;
      version: number;
      storage_path: string;
    };

    await adminClient.storage
      .from("project-deliverables")
      .upload(alloc.storage_path, Buffer.from("mock-binary-content-phase10-audit"), {
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
  // 1. CLIENT REVIEW ROUND SINGLE-ACTIVE INVARIANT (Section 1)
  // ---------------------------------------------------------------------------
  console.log("1. Testing client review round single-active invariant...");
  const p1Setup = await createReadyProject("P1");
  const p1Id = p1Setup.project.id;

  // Owning SMS starts client review round 1
  const p1Start = await smsAuth.client.rpc("start_client_review", { p_project_id: p1Id });
  assert(p1Start.error === null, "SECTION 1", "SMS starts round 1 successfully", "Success", p1Start.error?.message || "Success");

  const { data: p1ActiveReview } = await adminClient
    .from("client_reviews")
    .select("id, overall_verdict, round_number")
    .eq("project_id", p1Id)
    .single();

  assert(p1ActiveReview?.overall_verdict === "PENDING", "SECTION 1", "Round 1 overall_verdict is PENDING", "PENDING", p1ActiveReview?.overall_verdict || "None");

  // Attempt RPC start_client_review while round 1 is pending -> MUST FAIL
  const p1DupStart = await smsAuth.client.rpc("start_client_review", { p_project_id: p1Id });
  assert(p1DupStart.error !== null, "SECTION 1", "RPC start_client_review rejected while round pending", "Rejected", p1DupStart.error?.message || "Allowed");

  // Attempt RPC start_client_re_presentation while round 1 is pending -> MUST FAIL
  const p1RePresentFail = await smsAuth.client.rpc("start_client_re_presentation", { p_project_id: p1Id });
  assert(p1RePresentFail.error !== null, "SECTION 1", "RPC start_client_re_presentation rejected while round pending", "Rejected", p1RePresentFail.error?.message || "Allowed");

  // Attempt direct SQL INSERT of another PENDING round for same project -> MUST FAIL (violates uq_client_reviews_one_active_per_project)
  const directPendingInsert = await adminClient.from("client_reviews").insert({
    project_id: p1Id,
    submitted_by: smsAuth.user.id,
    round_number: 99,
    overall_verdict: "PENDING",
  });
  assert(
    directPendingInsert.error !== null && directPendingInsert.error.message.includes("uq_client_reviews_one_active_per_project"),
    "SECTION 1",
    "Database partial unique index blocks duplicate active PENDING round",
    "Unique violation",
    directPendingInsert.error?.message || "Allowed"
  );

  // ---------------------------------------------------------------------------
  // 2. CLIENT REVIEW HEADER MUTATION SECURITY (Section 2 & 23)
  // ---------------------------------------------------------------------------
  console.log("\n2. Testing client review header mutation security...");
  const reviewId = p1ActiveReview!.id;

  // Direct UPDATE attempts by authenticated user must fail
  const directUpdateAttempt = await smsAuth.client
    .from("client_reviews")
    .update({ round_number: 10 })
    .eq("id", reviewId);
  assert(
    directUpdateAttempt.error !== null && directUpdateAttempt.error.message.includes("Direct UPDATE on client_reviews is strictly forbidden"),
    "SECTION 2",
    "Authenticated direct UPDATE on client_reviews blocked by trigger",
    "Blocked",
    directUpdateAttempt.error?.message || "Allowed"
  );

  const directVerdictUpdate = await smsAuth.client
    .from("client_reviews")
    .update({ overall_verdict: "APPROVED" })
    .eq("id", reviewId);
  assert(
    directVerdictUpdate.error !== null && directVerdictUpdate.error.message.includes("Direct UPDATE on client_reviews is strictly forbidden"),
    "SECTION 2",
    "Authenticated direct verdict update blocked",
    "Blocked",
    directVerdictUpdate.error?.message || "Allowed"
  );

  // Even inside adminClient, identity fields (project_id, round_number, submitted_by, created_at) are immutable
  const adminAlterProjectId = await adminClient
    .from("client_reviews")
    .update({ project_id: "00000000-0000-0000-0000-000000000099" })
    .eq("id", reviewId);
  assert(
    adminAlterProjectId.error !== null && adminAlterProjectId.error.message.includes("project_id is immutable"),
    "SECTION 2",
    "Immutable project_id column protected from alteration",
    "Immutable",
    adminAlterProjectId.error?.message || "Allowed"
  );

  const adminAlterRoundNum = await adminClient
    .from("client_reviews")
    .update({ round_number: 999 })
    .eq("id", reviewId);
  assert(
    adminAlterRoundNum.error !== null && adminAlterRoundNum.error.message.includes("round_number is immutable"),
    "SECTION 2",
    "Immutable round_number column protected from alteration",
    "Immutable",
    adminAlterRoundNum.error?.message || "Allowed"
  );

  // Direct DELETE on client_reviews blocked
  const directDeleteReview = await smsAuth.client.from("client_reviews").delete().eq("id", reviewId);
  assert(
    directDeleteReview.error !== null && directDeleteReview.error.message.includes("Physical DELETE on client_reviews is strictly forbidden"),
    "SECTION 2",
    "Physical DELETE on client_reviews strictly blocked",
    "Blocked",
    directDeleteReview.error?.message || "Allowed"
  );

  // ---------------------------------------------------------------------------
  // 3. EXACT PRESENTATION ARTIFACT & UNAPPROVED VERSION EDGE CASE (Sections 3 & 4)
  // ---------------------------------------------------------------------------
  console.log("\n3. Testing exact QC-approved presentation artifact binding & unapproved version edge case...");
  const p3Setup = await createReadyProject("P3");
  const p3Id = p3Setup.project.id;

  // Insert an anomalous unapproved v2 deliverable directly via adminClient
  const { data: unapprovedV2 } = await adminClient
    .from("project_files")
    .insert({
      project_id: p3Id,
      task_id: p3Setup.task1.id,
      uploaded_by: designerAuth.user.id,
      asset_group_id: p3Setup.file1.asset_group_id,
      version: 2,
      file_name: "design_v2_unapproved.png",
      storage_path: `projects/${p3Id}/tasks/${p3Setup.task1.id}/design_v2_unapproved.png`,
      storage_bucket: "deliverables",
      file_type: "DESIGN",
      mime_type: "image/png",
      file_size_bytes: 102400,
    })
    .select()
    .single();

  // 1. Invariant: When an unapproved deliverable version exists, start_client_review MUST fail
  const p3StartBlocked = await smsAuth.client.rpc("start_client_review", { p_project_id: p3Id });
  assert(
    p3StartBlocked.error !== null && p3StartBlocked.error.message.includes("lack approved QC verdict binding"),
    "SECTION 3 & 4",
    "Client review start blocked when a deliverable lacks QC approval",
    "Blocked",
    p3StartBlocked.error?.message || "Allowed"
  );

  // 2. Architectural Invariant: Creative cannot upload/commit deliverables while task is APPROVED
  const allocWhileApproved = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: p3Setup.task1.id,
    p_file_name: "design_v3.png",
    p_file_type: "DESIGN",
    p_mime_type: "image/png",
    p_file_size_bytes: 102400,
  });
  assert(
    allocWhileApproved.error !== null && allocWhileApproved.error.message.includes("Task must be IN_PROGRESS to upload deliverables"),
    "SECTION 3 & 4",
    "Architecture strictly prevents new version uploads while task is APPROVED",
    "Blocked",
    allocWhileApproved.error?.message || "Allowed"
  );

  // Mark the anomalous unapproved v2 as deleted so p3 can proceed
  await adminClient.from("project_files").update({ deleted_at: new Date().toISOString() }).eq("id", unapprovedV2!.id);

  // SMS starts client review for p3 cleanly
  const p3Start = await smsAuth.client.rpc("start_client_review", { p_project_id: p3Id });
  assert(p3Start.error === null, "SECTION 3 & 4", "SMS starts client review for P3 after unapproved version removed", "Success", p3Start.error?.message || "Success");
  const p3ReviewId = (p3Start.data as { client_review_id: string }).client_review_id;

  // Record client verdict for Task 1: Binds to QC-approved v1
  const p3Verdict = await smsAuth.client.rpc("record_client_item_verdict", {
    p_review_id: p3ReviewId,
    p_task_id: p3Setup.task1.id,
    p_verdict: "APPROVED",
    p_feedback: "Approved design artifact",
  });
  assert(p3Verdict.error === null, "SECTION 3 & 4", "Client verdict recorded for Task 1", "Success", p3Verdict.error?.message || "Success");

  const { data: p3Item } = await adminClient
    .from("client_review_items")
    .select("file_id, deliverable_version:file_id(version)")
    .eq("client_review_id", p3ReviewId)
    .eq("task_id", p3Setup.task1.id)
    .single();

  const boundFileId = p3Item?.file_id;
  const boundVersion = (p3Item?.deliverable_version as unknown as { version: number })?.version;

  assert(
    boundFileId === p3Setup.file1.id && boundVersion === 1,
    "SECTION 3 & 4",
    "Item strictly binds to QC-approved v1",
    `v1 (${p3Setup.file1.id})`,
    `v${boundVersion} (${boundFileId})`
  );

  // ---------------------------------------------------------------------------
  // 4. CLIENT REVISION REQUEST LIFECYCLE & RESOLUTION (Section 6)
  // ---------------------------------------------------------------------------
  console.log("\n4. Testing client revision request lifecycle...");
  // Record revision request on Task 2 in P3
  const p3RevVerdict = await smsAuth.client.rpc("record_client_item_verdict", {
    p_review_id: p3ReviewId,
    p_task_id: p3Setup.task2.id,
    p_verdict: "REVISION_REQUESTED",
    p_feedback: "Perlu revisi audio video",
  });
  assert(p3RevVerdict.error === null, "SECTION 6", "Client requests revision on Task 2", "Success", p3RevVerdict.error?.message || "Success");

  // Task 2 transitions to REVISION_REQUESTED
  const { data: t2State1 } = await adminClient.from("tasks").select("status").eq("id", p3Setup.task2.id).single();
  assert(t2State1?.status === "REVISION_REQUESTED", "SECTION 6", "Task 2 status is REVISION_REQUESTED", "REVISION_REQUESTED", t2State1?.status || "None");

  const { data: clientRevReq } = await adminClient
    .from("revision_requests")
    .select("id, status, source")
    .eq("task_id", p3Setup.task2.id)
    .eq("source", "CLIENT")
    .single();

  assert(clientRevReq?.status === "OPEN", "SECTION 6", "Client revision request created with status OPEN", "OPEN", clientRevReq?.status || "None");

  // Creative transitions task to IN_PROGRESS
  const t2StartWork = await editorAuth.client.rpc("transition_task_status", {
    p_task_id: p3Setup.task2.id,
    p_new_status: "IN_PROGRESS",
  });
  assert(t2StartWork.error === null, "SECTION 6", "Editor resumes revision work", "Success", t2StartWork.error?.message || "Success");

  const { data: clientRevReqProg } = await adminClient
    .from("revision_requests")
    .select("status")
    .eq("id", clientRevReq!.id)
    .single();
  assert(clientRevReqProg?.status === "IN_PROGRESS", "SECTION 6", "Client revision request transitioned to IN_PROGRESS", "IN_PROGRESS", clientRevReqProg?.status || "None");

  // Commit v2 deliverable
  await uploadAndCommitDeliverable(
    editorAuth,
    p3Setup.task2.id,
    "video_v2.mp4",
    "video/mp4",
    204800,
    "VIDEO"
  );

  // Submit v2 to review
  const t2Submit = await editorAuth.client.rpc("transition_task_status", {
    p_task_id: p3Setup.task2.id,
    p_new_status: "IN_REVIEW",
  });
  assert(t2Submit.error === null, "SECTION 6", "Editor submits v2 to review", "Success", t2Submit.error?.message || "Success");

  const { data: clientRevReqResolved } = await adminClient
    .from("revision_requests")
    .select("status, resolved_at")
    .eq("id", clientRevReq!.id)
    .single();

  assert(
    clientRevReqResolved?.status === "RESOLVED" && clientRevReqResolved.resolved_at !== null,
    "SECTION 6",
    "Client revision request transitioned to RESOLVED with timestamp",
    "RESOLVED",
    clientRevReqResolved?.status || "None"
  );

  // ---------------------------------------------------------------------------
  // 5. ONE ACTIVE REVISION REQUEST ACROSS SOURCES (Section 7)
  // ---------------------------------------------------------------------------
  console.log("\n5. Testing one active revision request across sources...");
  // Create an active INTERNAL_QC revision request on a task
  const p5Setup = await createReadyProject("P5");
  const p5Id = p5Setup.project.id;
  const p5TaskId = p5Setup.task1.id;

  const { data: qcRow } = await adminClient.from("qc_reviews").select("id").eq("task_id", p5TaskId).single();

  // Insert active INTERNAL_QC revision request
  const { data: internalRev, error: intRevErr } = await adminClient
    .from("revision_requests")
    .insert({
      project_id: p5Id,
      task_id: p5TaskId,
      assigned_to: designerAuth.user.id,
      qc_review_id: qcRow!.id,
      requested_by: cdAuth.user.id,
      source: "INTERNAL_QC",
      round_number: 1,
      notes: "Internal revision needed",
      status: "OPEN",
    })
    .select()
    .single();

  if (intRevErr || !internalRev) {
    throw new Error(`Failed to insert internal revision request: ${intRevErr?.message}`);
  }

  // Attempt to insert an active CLIENT revision request on the same task -> MUST FAIL
  const conflictingClientRev = await adminClient.from("revision_requests").insert({
    project_id: p5Id,
    task_id: p5TaskId,
    assigned_to: designerAuth.user.id,
    qc_review_id: null,
    requested_by: smsAuth.user.id,
    source: "CLIENT",
    round_number: 2,
    notes: "Conflicting client revision",
    status: "OPEN",
  });

  assert(
    conflictingClientRev.error !== null && conflictingClientRev.error.message.includes("uq_one_active_revision_per_task"),
    "SECTION 7",
    "Simultaneous active revision across sources blocked by unique index",
    "Unique violation",
    conflictingClientRev.error?.message || "Allowed"
  );

  // Clean up p5 setup
  await adminClient.from("revision_requests").delete().eq("id", internalRev!.id);

  // ---------------------------------------------------------------------------
  // 6. CLIENT ITEM VERDICT IMMUTABILITY & REPEATED CALLS (Section 8)
  // ---------------------------------------------------------------------------
  console.log("\n6. Testing client item verdict immutability and repeated calls...");
  // In p3, Task 1 already has a recorded verdict (APPROVED)
  const repeatVerdictCall = await smsAuth.client.rpc("record_client_item_verdict", {
    p_review_id: p3ReviewId,
    p_task_id: p3Setup.task1.id,
    p_verdict: "REVISION_REQUESTED",
    p_feedback: "Attempt to overwrite approved verdict",
  });
  assert(
    repeatVerdictCall.error !== null &&
      (repeatVerdictCall.error.message.includes("Verdict already recorded") ||
        repeatVerdictCall.error.message.includes("already finalized")),
    "SECTION 8",
    "Repeated RPC call cannot overwrite previously recorded client verdict",
    "Rejected",
    repeatVerdictCall.error?.message || "Allowed"
  );

  // Direct UPDATE on client_review_items must fail
  const directItemUpdate = await smsAuth.client
    .from("client_review_items")
    .update({ verdict: "REVISION_REQUESTED" })
    .eq("client_review_id", p3ReviewId)
    .eq("task_id", p3Setup.task1.id);
  assert(
    directItemUpdate.error !== null && directItemUpdate.error.message.includes("Operation denied: table client_review_items is strict append-only"),
    "SECTION 8",
    "Direct UPDATE on client_review_items blocked",
    "Blocked",
    directItemUpdate.error?.message || "Allowed"
  );

  // Direct DELETE on client_review_items must fail
  const directItemDelete = await smsAuth.client
    .from("client_review_items")
    .delete()
    .eq("client_review_id", p3ReviewId)
    .eq("task_id", p3Setup.task1.id);
  assert(
    directItemDelete.error !== null && directItemDelete.error.message.includes("Operation denied: table client_review_items is strict append-only"),
    "SECTION 8",
    "Direct DELETE on client_review_items blocked",
    "Blocked",
    directItemDelete.error?.message || "Allowed"
  );

  // ---------------------------------------------------------------------------
  // 7. CLIENT VERDICT CONCURRENCY: APPROVED VS REVISION (Section 9)
  // ---------------------------------------------------------------------------
  console.log("\n7. Testing client verdict concurrency: APPROVED vs REVISION_REQUESTED...");
  const p7Setup = await createReadyProject("P7");
  const p7Id = p7Setup.project.id;

  const p7Start = await smsAuth.client.rpc("start_client_review", { p_project_id: p7Id });
  const p7ReviewId = (p7Start.data as { client_review_id: string }).client_review_id;

  // Run simultaneous APPROVED vs REVISION_REQUESTED for Task 1
  const [resApprove, resRevise] = await Promise.all([
    smsAuth.client.rpc("record_client_item_verdict", {
      p_review_id: p7ReviewId,
      p_task_id: p7Setup.task1.id,
      p_verdict: "APPROVED",
      p_feedback: "Concurrent approval",
    }),
    smsAuth.client.rpc("record_client_item_verdict", {
      p_review_id: p7ReviewId,
      p_task_id: p7Setup.task1.id,
      p_verdict: "REVISION_REQUESTED",
      p_feedback: "Concurrent revision",
    }),
  ]);

  const appSuccess = resApprove.error === null;
  const revSuccess = resRevise.error === null;

  assert(
    (appSuccess && !revSuccess) || (!appSuccess && revSuccess),
    "SECTION 9",
    "Exactly one verdict succeeds in concurrency race",
    "1 Success, 1 Failure",
    `Approve: ${appSuccess ? "OK" : "FAIL"} | Revise: ${revSuccess ? "OK" : "FAIL"}`
  );

  // Verify coherence: exactly 1 item in client_review_items
  const { data: p7Items } = await adminClient
    .from("client_review_items")
    .select("verdict")
    .eq("client_review_id", p7ReviewId)
    .eq("task_id", p7Setup.task1.id);

  assert(p7Items?.length === 1, "SECTION 9", "Exactly one client_review_items row exists for task", "1", `${p7Items?.length || 0}`);

  // ---------------------------------------------------------------------------
  // 8. APPROVE VS APPROVE CLIENT CONCURRENCY (Section 10)
  // ---------------------------------------------------------------------------
  console.log("\n8. Testing simultaneous double approval concurrency...");
  // For Task 2 in P7, run two simultaneous approvals
  const [doubleApp1, doubleApp2] = await Promise.all([
    smsAuth.client.rpc("record_client_item_verdict", {
      p_review_id: p7ReviewId,
      p_task_id: p7Setup.task2.id,
      p_verdict: "APPROVED",
      p_feedback: "Double approval 1",
    }),
    smsAuth.client.rpc("record_client_item_verdict", {
      p_review_id: p7ReviewId,
      p_task_id: p7Setup.task2.id,
      p_verdict: "APPROVED",
      p_feedback: "Double approval 2",
    }),
  ]);

  const double1Ok = doubleApp1.error === null;
  const double2Ok = doubleApp2.error === null;

  assert(
    (double1Ok && !double2Ok) || (!double1Ok && double2Ok),
    "SECTION 10",
    "Exactly one of double approvals succeeds",
    "1 Success, 1 Failure",
    `Call 1: ${double1Ok ? "OK" : "FAIL"} | Call 2: ${double2Ok ? "OK" : "FAIL"}`
  );

  const { data: p7Task2Items } = await adminClient
    .from("client_review_items")
    .select("id")
    .eq("client_review_id", p7ReviewId)
    .eq("task_id", p7Setup.task2.id);

  assert(p7Task2Items?.length === 1, "SECTION 10", "No duplicate audit row in client_review_items", "1", `${p7Task2Items?.length || 0}`);

  // ---------------------------------------------------------------------------
  // 9. D-002 RE-PRESENTATION LIFECYCLE & MIXED ROUND RESOLUTION (Sections 5 & 11)
  // ---------------------------------------------------------------------------
  console.log("\n9. Testing D-002 re-presentation lifecycle and mixed round semantics...");
  const p9Setup = await createReadyProject("P9");
  const p9Id = p9Setup.project.id;

  const p9Start = await smsAuth.client.rpc("start_client_review", { p_project_id: p9Id });
  const p9Round1Id = (p9Start.data as { client_review_id: string }).client_review_id;

  // Round 1: Task 1 approved, Task 2 revision requested
  await smsAuth.client.rpc("record_client_item_verdict", {
    p_review_id: p9Round1Id,
    p_task_id: p9Setup.task1.id,
    p_verdict: "APPROVED",
    p_feedback: "Task 1 approved in round 1",
  });

  await smsAuth.client.rpc("record_client_item_verdict", {
    p_review_id: p9Round1Id,
    p_task_id: p9Setup.task2.id,
    p_verdict: "REVISION_REQUESTED",
    p_feedback: "Task 2 needs video cut revision",
  });

  // Project remains CLIENT_REVIEW
  const { data: p9ProjAfterR1 } = await adminClient.from("projects").select("status").eq("id", p9Id).single();
  assert(p9ProjAfterR1?.status === "CLIENT_REVIEW", "SECTION 11", "Project remains in CLIENT_REVIEW after mixed round 1", "CLIENT_REVIEW", p9ProjAfterR1?.status || "None");

  // Round 1 auto-finalized as REVISION_REQUESTED
  const { data: p9R1Header } = await adminClient.from("client_reviews").select("overall_verdict").eq("id", p9Round1Id).single();
  assert(p9R1Header?.overall_verdict === "REVISION_REQUESTED", "SECTION 11", "Round 1 header finalized as REVISION_REQUESTED", "REVISION_REQUESTED", p9R1Header?.overall_verdict || "None");

  // Creative performs revision on Task 2:
  // IN_PROGRESS -> commit v2 -> IN_REVIEW
  await editorAuth.client.rpc("transition_task_status", { p_task_id: p9Setup.task2.id, p_new_status: "IN_PROGRESS" });

  await uploadAndCommitDeliverable(
    editorAuth,
    p9Setup.task2.id,
    "video_v2.mp4",
    "video/mp4",
    204800,
    "VIDEO"
  );

  await editorAuth.client.rpc("transition_task_status", { p_task_id: p9Setup.task2.id, p_new_status: "IN_REVIEW" });

  // Attempt SMS re-presentation while Task 2 is in IN_REVIEW -> MUST FAIL
  const prematureRePresent = await smsAuth.client.rpc("start_client_re_presentation", { p_project_id: p9Id });
  assert(
    prematureRePresent.error !== null && prematureRePresent.error.message.includes("still undergoing revision or internal QC"),
    "SECTION 5",
    "Re-presentation strictly blocked while task in IN_REVIEW (Decision D-002)",
    "Blocked",
    prematureRePresent.error?.message || "Allowed"
  );

  // CD requests internal revision on v2
  const cdRevRes = await cdAuth.client.rpc("submit_qc_verdict", {
    p_task_id: p9Setup.task2.id,
    p_verdict: "REVISION_REQUESTED",
    p_notes: "Internal QC: color grading needs adjustment",
  });
  if (cdRevRes.error) {
    throw new Error(`submit_qc_verdict (revision) failed: ${cdRevRes.error.message}`);
  }

  // Creative uploads v3
  const t2ProgRes = await editorAuth.client.rpc("transition_task_status", { p_task_id: p9Setup.task2.id, p_new_status: "IN_PROGRESS" });
  if (t2ProgRes.error) {
    throw new Error(`transition_task_status (IN_PROGRESS) failed: ${t2ProgRes.error.message}`);
  }

  await uploadAndCommitDeliverable(
    editorAuth,
    p9Setup.task2.id,
    "video_v3.mp4",
    "video/mp4",
    204800,
    "VIDEO"
  );
  const t2RevRes = await editorAuth.client.rpc("transition_task_status", { p_task_id: p9Setup.task2.id, p_new_status: "IN_REVIEW" });
  if (t2RevRes.error) {
    throw new Error(`transition_task_status (IN_REVIEW) failed: ${t2RevRes.error.message}`);
  }

  // CD approves v3
  const cdAppRes = await cdAuth.client.rpc("submit_qc_verdict", {
    p_task_id: p9Setup.task2.id,
    p_verdict: "APPROVED",
    p_notes: "Color grading approved on v3",
  });
  if (cdAppRes.error) {
    throw new Error(`submit_qc_verdict (approve) failed: ${cdAppRes.error.message}`);
  }

  // Now SMS re-presentation MUST PASS
  const p9RePresentPass = await smsAuth.client.rpc("start_client_re_presentation", { p_project_id: p9Id });
  assert(p9RePresentPass.error === null, "SECTION 5", "Re-presentation succeeds after CD re-QC approval", "Success", p9RePresentPass.error?.message || "Success");
  const p9Round2Id = (p9RePresentPass.data as { client_review_id: string }).client_review_id;

  // Record client approval on Task 2 in Round 2
  const p9R2Item = await smsAuth.client.rpc("record_client_item_verdict", {
    p_review_id: p9Round2Id,
    p_task_id: p9Setup.task2.id,
    p_verdict: "APPROVED",
    p_feedback: "Client approved video v3",
  });
  assert(p9R2Item.error === null, "SECTION 5", "Client approves Task 2 in Round 2", "Success", p9R2Item.error?.message || "Success");

  // Verify that new review item bound to v3 (not v1 or v2)
  const { data: r2BoundItem } = await adminClient
    .from("client_review_items")
    .select("file_id, deliverable_version:file_id(version)")
    .eq("client_review_id", p9Round2Id)
    .eq("task_id", p9Setup.task2.id)
    .single();

  const r2Version = (r2BoundItem?.deliverable_version as unknown as { version: number })?.version;
  assert(r2Version === 3, "SECTION 5", "Round 2 review item strictly bound to v3", "3", `${r2Version}`);

  // Final project approval combines: Task 1 (approved in R1) + Task 2 (approved in R2)
  const p9Finalize = await smsAuth.client.rpc("finalize_client_approval", { p_project_id: p9Id });
  assert(p9Finalize.error === null, "SECTION 11 & 12", "Final project approval succeeds with mixed round resolution", "Success", p9Finalize.error?.message || "Success");

  const { data: p9FinalStatus } = await adminClient.from("projects").select("status").eq("id", p9Id).single();
  assert(p9FinalStatus?.status === "APPROVED", "SECTION 11 & 12", "Project status is now APPROVED", "APPROVED", p9FinalStatus?.status || "None");

  // ---------------------------------------------------------------------------
  // 10. PROJECT APPROVAL CONCURRENCY & DERIVATION (Sections 12 & 13)
  // ---------------------------------------------------------------------------
  console.log("\n10. Testing project approval concurrency and derivation...");
  const p10Setup = await createReadyProject("P10");
  const p10Id = p10Setup.project.id;

  // Premature finalize_client_approval while in INTERNAL_QC -> MUST FAIL
  const prematureFinalize = await smsAuth.client.rpc("finalize_client_approval", { p_project_id: p10Id });
  assert(prematureFinalize.error !== null, "SECTION 12", "Finalize approval rejected while project in INTERNAL_QC", "Rejected", prematureFinalize.error?.message || "Allowed");

  // Start review and approve all tasks
  const p10Start = await smsAuth.client.rpc("start_client_review", { p_project_id: p10Id });
  const p10RevId = (p10Start.data as { client_review_id: string }).client_review_id;

  await smsAuth.client.rpc("record_client_item_verdict", {
    p_review_id: p10RevId,
    p_task_id: p10Setup.task1.id,
    p_verdict: "APPROVED",
    p_feedback: "Task 1 approved",
  });
  await smsAuth.client.rpc("record_client_item_verdict", {
    p_review_id: p10RevId,
    p_task_id: p10Setup.task2.id,
    p_verdict: "APPROVED",
    p_feedback: "Task 2 approved",
  });

  // Run simultaneous finalize_client_approval calls
  const [fin1, fin2] = await Promise.all([
    smsAuth.client.rpc("finalize_client_approval", { p_project_id: p10Id }),
    smsAuth.client.rpc("finalize_client_approval", { p_project_id: p10Id }),
  ]);

  assert(fin1.error === null && fin2.error === null, "SECTION 13", "Both concurrent finalize calls return clean responses (no crash)", "Clean", "Clean");

  // Exactly ONE project_status_history row for CLIENT_REVIEW -> APPROVED transition
  const { data: p10HistApproved } = await adminClient
    .from("project_status_history")
    .select("id")
    .eq("project_id", p10Id)
    .eq("to_status", "APPROVED");

  assert(p10HistApproved?.length === 1, "SECTION 13 & 15", "Exactly ONE project_status_history row for APPROVED transition", "1", `${p10HistApproved?.length || 0}`);

  // Exactly ONE CLIENT_APPROVED activity log event
  const { data: p10ClientApprovedEvents } = await adminClient
    .from("activity_logs")
    .select("id")
    .eq("project_id", p10Id)
    .eq("event_type", "CLIENT_APPROVED");

  assert(p10ClientApprovedEvents?.length === 1, "SECTION 13 & 16", "Exactly ONE CLIENT_APPROVED activity event emitted", "1", `${p10ClientApprovedEvents?.length || 0}`);

  // ---------------------------------------------------------------------------
  // 11. PUBLICATION CONCURRENCY, VALIDATION & IMMUTABILITY (Sections 17, 18, 19, 20, 21)
  // ---------------------------------------------------------------------------
  console.log("\n11. Testing publication validation, concurrency, and immutability...");
  // Invalid publication URL tests
  const invalidUrls = [
    { url: "", desc: "Empty URL" },
    { url: "   ", desc: "Whitespace URL" },
    { url: "javascript:alert(1)", desc: "Javascript scheme" },
    { url: "data:text/html;base64,PHNjcmlwdD4=", desc: "Data scheme" },
    { url: "file:///etc/passwd", desc: "File scheme" },
    { url: "ftp://files.example.com", desc: "FTP scheme" },
    { url: "not-a-valid-url", desc: "Malformed non-URL string" },
  ];

  for (const item of invalidUrls) {
    const res = await smsAuth.client.rpc("publish_project", {
      p_project_id: p10Id,
      p_publication_url: item.url,
      p_publish_note: "Test note",
    });
    assert(res.error !== null, "SECTION 19", `Invalid URL rejected: ${item.desc}`, "Rejected", res.error?.message || "Allowed");
  }

  // Valid publication URL concurrency test
  const validUrl = "https://instagram.com/p/Cxyz_audit_test";
  const [pub1, pub2] = await Promise.all([
    smsAuth.client.rpc("publish_project", {
      p_project_id: p10Id,
      p_publication_url: validUrl,
      p_publish_note: "Official live release",
    }),
    smsAuth.client.rpc("publish_project", {
      p_project_id: p10Id,
      p_publication_url: validUrl,
      p_publish_note: "Duplicate live release",
    }),
  ]);

  assert(pub1.error === null && pub2.error === null, "SECTION 17", "Concurrent publish calls succeed/no-op cleanly", "Clean", "Clean");

  // Project status is PUBLISHED
  const { data: p10Published } = await adminClient.from("projects").select("status, publication_url").eq("id", p10Id).single();
  assert(p10Published?.status === "PUBLISHED", "SECTION 17", "Project status is PUBLISHED", "PUBLISHED", p10Published?.status || "None");
  assert(p10Published?.publication_url === validUrl, "SECTION 17", "publication_url matches canonical input", validUrl, p10Published?.publication_url || "None");

  // Exactly ONE project_status_history row for PUBLISHED transition
  const { data: p10HistPublished } = await adminClient
    .from("project_status_history")
    .select("id")
    .eq("project_id", p10Id)
    .eq("to_status", "PUBLISHED");
  assert(p10HistPublished?.length === 1, "SECTION 15 & 17", "Exactly ONE project_status_history row for PUBLISHED transition", "1", `${p10HistPublished?.length || 0}`);

  // Exactly ONE PROJECT_PUBLISHED activity event
  const { data: p10PubEvents } = await adminClient
    .from("activity_logs")
    .select("id")
    .eq("project_id", p10Id)
    .eq("event_type", "PROJECT_PUBLISHED");
  assert(p10PubEvents?.length === 1, "SECTION 16 & 17", "Exactly ONE PROJECT_PUBLISHED activity log event", "1", `${p10PubEvents?.length || 0}`);

  // Publication URL Immutability (Section 18): ordinary project updates cannot alter publication_url
  const smsUrlTamper = await smsAuth.client.from("projects").update({ publication_url: "https://tampered.com" }).eq("id", p10Id);
  assert(smsUrlTamper.error !== null && smsUrlTamper.error.message.includes("publication_url is immutable"), "SECTION 18", "SMS ordinary update cannot alter publication_url", "Blocked", smsUrlTamper.error?.message || "Allowed");

  const aeUrlTamper = await aeAuth.client.from("projects").update({ publication_url: "https://tampered.com" }).eq("id", p10Id).select();
  const { data: pCheckAfterAe } = await adminClient.from("projects").select("publication_url").eq("id", p10Id).single();
  const aeBlocked = aeUrlTamper.error !== null || ((aeUrlTamper.data as unknown[] | null)?.length === 0 && pCheckAfterAe?.publication_url === validUrl);
  assert(aeBlocked, "SECTION 18", "AE cannot alter publication_url", "Blocked", aeBlocked ? "Blocked" : "Allowed");

  const cdUrlTamper = await cdAuth.client.from("projects").update({ publication_url: "https://tampered.com" }).eq("id", p10Id).select();
  const { data: pCheckAfterCd } = await adminClient.from("projects").select("publication_url").eq("id", p10Id).single();
  const cdBlocked = cdUrlTamper.error !== null || ((cdUrlTamper.data as unknown[] | null)?.length === 0 && pCheckAfterCd?.publication_url === validUrl);
  assert(cdBlocked, "SECTION 18", "CD cannot alter publication_url", "Blocked", cdBlocked ? "Blocked" : "Allowed");

  const designerUrlTamper = await designerAuth.client.from("projects").update({ publication_url: "https://tampered.com" }).eq("id", p10Id).select();
  const { data: pCheckAfterDesigner } = await adminClient.from("projects").select("publication_url").eq("id", p10Id).single();
  const designerBlocked = designerUrlTamper.error !== null || ((designerUrlTamper.data as unknown[] | null)?.length === 0 && pCheckAfterDesigner?.publication_url === validUrl);
  assert(designerBlocked, "SECTION 18", "Designer cannot alter publication_url", "Blocked", designerBlocked ? "Blocked" : "Allowed");

  const adminUrlTamper = await adminAuth.client.from("projects").update({ publication_url: "https://tampered.com" }).eq("id", p10Id);
  assert(
    adminUrlTamper.error !== null && adminUrlTamper.error.message.includes("publication_url is immutable"),
    "SECTION 18",
    "Admin cannot alter publication_url via ordinary update",
    "Blocked",
    adminUrlTamper.error?.message || "Allowed"
  );

  // Status revert of PUBLISHED project blocked
  const statusRevert = await adminClient.from("projects").update({ status: "APPROVED" }).eq("id", p10Id);
  assert(
    statusRevert.error !== null && statusRevert.error.message.includes("Cannot revert or change status of a PUBLISHED project"),
    "SECTION 18",
    "Status revert from PUBLISHED strictly blocked",
    "Blocked",
    statusRevert.error?.message || "Allowed"
  );

  // PUBLISHED -> DONE is strictly blocked (Section 20)
  const doneAttempt = await adminClient.from("projects").update({ status: "DONE" as unknown as "PUBLISHED" }).eq("id", p10Id);
  assert(doneAttempt.error !== null, "SECTION 20", "Direct transition to DONE is strictly rejected", "Rejected", doneAttempt.error?.message || "Allowed");

  // Task Completion Boundary (Section 21): Tasks remain APPROVED, not silently COMPLETED
  const { data: p10TasksAfterPub } = await adminClient.from("tasks").select("id, status").eq("project_id", p10Id);
  const allTasksApproved = (p10TasksAfterPub || []).every((t) => t.status === "APPROVED");
  assert(allTasksApproved, "SECTION 21", "Tasks remain in APPROVED status after project publication (no auto-completion)", "All APPROVED", allTasksApproved ? "All APPROVED" : "Changed");

  // ---------------------------------------------------------------------------
  // 12. PRESENTED ARTIFACT PROTECTION (Section 22)
  // ---------------------------------------------------------------------------
  console.log("\n12. Testing presented deliverable artifact protection...");
  const presentedFileId = p10Setup.file1.id;

  // Soft deletion attempt via soft_delete_project_file RPC -> MUST FAIL
  const softDelPresented = await smsAuth.client.rpc("soft_delete_project_file", { p_file_id: presentedFileId });
  assert(
    softDelPresented.error !== null && softDelPresented.error.message.includes("Cannot delete deliverable file that has been presented for client review"),
    "SECTION 22",
    "soft_delete_project_file blocked for client-presented deliverable",
    "Blocked",
    softDelPresented.error?.message || "Allowed"
  );

  // Physical DELETE on project_files table -> MUST FAIL
  const physDelFile = await adminClient.from("project_files").delete().eq("id", presentedFileId);
  assert(
    physDelFile.error !== null && physDelFile.error.message.includes("Physical DELETE on project_files is strictly forbidden"),
    "SECTION 22",
    "Physical DELETE on project_files table blocked",
    "Blocked",
    physDelFile.error?.message || "Allowed"
  );

  // ---------------------------------------------------------------------------
  // 13. CLIENT REVIEW DIRECT TABLE SECURITY ACROSS ALL ROLES (Section 23)
  // ---------------------------------------------------------------------------
  console.log("\n13. Testing direct table security on client_reviews & client_review_items across all roles...");
  const testRoles = [
    { role: "ADMIN", client: adminAuth.client },
    { role: "CREATIVE_DIRECTOR", client: cdAuth.client },
    { role: "ACCOUNT_EXECUTIVE", client: aeAuth.client },
    { role: "SOCIAL_MEDIA_SPECIALIST (Owner)", client: smsAuth.client },
    { role: "SOCIAL_MEDIA_SPECIALIST (Non-owner)", client: otherSmsAuth.client },
    { role: "GRAPHIC_DESIGNER", client: designerAuth.client },
    { role: "VIDEO_EDITOR", client: editorAuth.client },
  ];

  for (const r of testRoles) {
    // Direct INSERT into client_reviews
    const insCr = await r.client.from("client_reviews").insert({
      project_id: p10Id,
      submitted_by: smsAuth.user.id,
      round_number: 99,
      overall_verdict: "PENDING",
    });
    assert(insCr.error !== null, "SECTION 23", `${r.role} direct INSERT on client_reviews blocked`, "Blocked", insCr.error?.message || "Allowed");

    // Direct UPDATE on client_reviews
    const upCr = await r.client.from("client_reviews").update({ overall_verdict: "APPROVED" }).eq("id", p10RevId);
    assert(upCr.error !== null, "SECTION 23", `${r.role} direct UPDATE on client_reviews blocked`, "Blocked", upCr.error?.message || "Allowed");

    // Direct DELETE on client_reviews
    const delCr = await r.client.from("client_reviews").delete().eq("id", p10RevId);
    assert(delCr.error !== null, "SECTION 23", `${r.role} direct DELETE on client_reviews blocked`, "Blocked", delCr.error?.message || "Allowed");

    // Direct INSERT into client_review_items
    const insCri = await r.client.from("client_review_items").insert({
      client_review_id: p10RevId,
      task_id: p10Setup.task1.id,
      file_id: presentedFileId,
      verdict: "APPROVED",
      feedback_notes: "Direct forgery attempt",
    });
    assert(insCri.error !== null, "SECTION 23", `${r.role} direct INSERT on client_review_items blocked`, "Blocked", insCri.error?.message || "Allowed");

    // Direct UPDATE on client_review_items
    const upCri = await r.client.from("client_review_items").update({ feedback_notes: "Forged feedback" }).eq("client_review_id", p10RevId);
    assert(upCri.error !== null, "SECTION 23", `${r.role} direct UPDATE on client_review_items blocked`, "Blocked", upCri.error?.message || "Allowed");

    // Direct DELETE on client_review_items
    const delCri = await r.client.from("client_review_items").delete().eq("client_review_id", p10RevId);
    assert(delCri.error !== null, "SECTION 23", `${r.role} direct DELETE on client_review_items blocked`, "Blocked", delCri.error?.message || "Allowed");
  }

  // ---------------------------------------------------------------------------
  // 14. CLIENT REVIEW RPC AUTHORITY (Section 24)
  // ---------------------------------------------------------------------------
  console.log("\n14. Testing client review RPC authority across all roles...");
  const p14Setup = await createReadyProject("P14");
  const p14Id = p14Setup.project.id;

  // Non-owner callers attempting start_client_review
  const rpcCallers = [
    { role: "GRAPHIC_DESIGNER", client: designerAuth.client },
    { role: "VIDEO_EDITOR", client: editorAuth.client },
    { role: "CREATIVE_DIRECTOR", client: cdAuth.client },
    { role: "ACCOUNT_EXECUTIVE", client: aeAuth.client },
    { role: "SOCIAL_MEDIA_SPECIALIST (Non-owner)", client: otherSmsAuth.client },
    { role: "ADMIN", client: adminAuth.client },
  ];

  for (const caller of rpcCallers) {
    const startAttempt = await caller.client.rpc("start_client_review", { p_project_id: p14Id });
    assert(
      startAttempt.error !== null && startAttempt.error.message.includes("only assigned project SMS owner"),
      "SECTION 24",
      `${caller.role} cannot start client review`,
      "Unauthorized",
      startAttempt.error?.message || "Allowed"
    );
  }

  // Owning SMS starts review successfully
  const sms14Start = await smsAuth.client.rpc("start_client_review", { p_project_id: p14Id });
  assert(sms14Start.error === null, "SECTION 24", "Owning SMS starts client review successfully", "Success", sms14Start.error?.message || "Success");
  const p14RevId = (sms14Start.data as { client_review_id: string }).client_review_id;

  // Non-owner callers attempting record_client_item_verdict
  for (const caller of rpcCallers) {
    const verdictAttempt = await caller.client.rpc("record_client_item_verdict", {
      p_review_id: p14RevId,
      p_task_id: p14Setup.task1.id,
      p_verdict: "APPROVED",
      p_feedback: "Unauthorized attempt",
    });
    assert(
      verdictAttempt.error !== null && verdictAttempt.error.message.includes("only assigned project SMS owner"),
      "SECTION 24",
      `${caller.role} cannot record client feedback`,
      "Unauthorized",
      verdictAttempt.error?.message || "Allowed"
    );
  }

  // ---------------------------------------------------------------------------
  // 15. ACTIVITY FORGERY ACROSS ALL ROLES (Section 25)
  // ---------------------------------------------------------------------------
  console.log("\n15. Testing activity log anti-forgery across all roles...");
  const protectedEvents = [
    "CLIENT_REVIEW_STARTED",
    "CLIENT_APPROVED_ITEM",
    "CLIENT_REVISION_REQUESTED",
    "CLIENT_REVIEW_RESUBMITTED",
    "CLIENT_APPROVED",
    "PROJECT_PUBLISHED",
  ];

  for (const r of testRoles) {
    for (const evt of protectedEvents) {
      const forgeRes = await r.client.from("activity_logs").insert({
        project_id: p14Id,
        user_id: r.client === adminAuth.client ? adminAuth.user.id : smsAuth.user.id,
        event_type: evt,
        metadata: { forged: true },
      });
      assert(
        forgeRes.error !== null && forgeRes.error.message.includes("Direct insertion of protected activity events is forbidden"),
        "SECTION 25",
        `${r.role} direct insert of ${evt} blocked by trigger`,
        "Blocked",
        forgeRes.error?.message || "Allowed"
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 16. STATIC AUDIT FOR ZERO CLIENT PORTAL & ZERO DONE (Sections 26 & 27)
  // ---------------------------------------------------------------------------
  console.log("\n16. Running static code inspections for client portal and DONE boundaries...");
  const srcDir = path.resolve(process.cwd(), "src");

  function scanDirectory(dir: string, fileList: string[] = []) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const fullPath = path.join(dir, f);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scanDirectory(fullPath, fileList);
      } else if (f.endsWith(".ts") || f.endsWith(".tsx")) {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  const allSrcFiles = scanDirectory(srcDir);

  // Check 1: Zero client portal routes
  const portalRoutes = allSrcFiles.filter(
    (p) =>
      p.includes("client-portal") ||
      p.includes("external-client") ||
      p.includes("public-review") ||
      p.includes("magic-link")
  );
  assert(portalRoutes.length === 0, "SECTION 26", "Zero client portal or magic link routes exist", "0", `${portalRoutes.length}`);

  // Check 2: Zero anonymous review endpoints
  let foundAnonAuth = 0;
  for (const f of allSrcFiles) {
    const content = fs.readFileSync(f, "utf-8");
    if (content.includes("auth.signInAnonymously") || content.includes("client_access_token")) {
      foundAnonAuth++;
    }
  }
  assert(foundAnonAuth === 0, "SECTION 26", "Zero anonymous client authentication methods exist", "0", `${foundAnonAuth}`);

  // Check 3: Zero DONE status transitions in client-review feature
  const clientReviewFiles = allSrcFiles.filter((p) => p.includes("features\\client-review") || p.includes("features/client-review"));
  let foundDoneTransitions = 0;
  for (const f of clientReviewFiles) {
    const content = fs.readFileSync(f, "utf-8");
    if (content.includes('"DONE"') || content.includes("'DONE'")) {
      foundDoneTransitions++;
    }
  }
  assert(foundDoneTransitions === 0, "SECTION 27", "Zero DONE transitions in client review feature", "0", `${foundDoneTransitions}`);

  console.log("\n===============================================================================");
  console.log(`PHASE 10.1 AUDIT VERIFICATION COMPLETE: ${totalPassed} Passed, ${totalFailed} Failed`);
  console.log("===============================================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runPhase10Audit().catch((err) => {
  console.error("FATAL: Unhandled error in verify-phase10-audit.ts:", err);
  process.exit(1);
});
