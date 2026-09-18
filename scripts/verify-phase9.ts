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

async function runPhase9Verification() {
  console.log("===============================================================================");
  console.log("LOCO TRACK - Phase 9 Creative Director Internal QC & Revision Loop Test Suite");
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

  // Helper function to allocate, upload binary, and commit deliverable
  async function uploadAndCommitDeliverable(
    uploaderAuth: Awaited<ReturnType<typeof createAuthClient>>,
    taskId: string,
    fileName: string,
    mimeType: string,
    fileSize: number,
    fileType: "DESIGN" | "VIDEO"
  ) {
    const { data: allocData, error: allocErr } = await uploaderAuth.client.rpc("allocate_deliverable_upload", {
      p_task_id: taskId,
      p_file_name: fileName,
      p_mime_type: mimeType,
      p_file_size_bytes: fileSize,
      p_file_type: fileType,
    });
    if (allocErr || !allocData) {
      throw new Error(`Failed to allocate deliverable upload: ${allocErr?.message}`);
    }
    const alloc = allocData as {
      file_id: string;
      asset_group_id: string;
      version: number;
      storage_path: string;
    };

    // Upload to storage using admin client to ensure binary exists
    await adminClient.storage
      .from("project-deliverables")
      .upload(alloc.storage_path, Buffer.from("mock-binary-content-phase9"), {
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
    return { fileId: alloc.file_id, version: alloc.version, storagePath: alloc.storage_path, assetGroupId: alloc.asset_group_id };
  }

  // Fetch active test brand
  const { data: brand } = await adminClient
    .from("brands")
    .select("id, client_id")
    .limit(1)
    .single();

  if (!brand) {
    throw new Error("No brand found in database. Seed data required.");
  }

  // =========================================================================
  // SETUP: Create dedicated Project Phase 9 and Tasks
  // =========================================================================
  console.log("1. Setting up Phase 9 test project, brief, planning, and tasks...");

  const { data: projData, error: projErr } = await smsAuth.client.rpc("create_project", {
    p_brand_id: brand.id,
    p_name: "Phase 9 Internal QC Test Project",
    p_description: "Project for verifying Phase 9 Creative Director QC & Revision Loop",
    p_priority: "HIGH",
    p_start_date: new Date().toISOString().split("T")[0],
    p_deadline: new Date(Date.now() + 864000000).toISOString(),
    p_sms_owner_id: smsAuth.user.id,
  });

  if (projErr || !projData) {
    throw new Error(`Failed to create test project: ${projErr?.message}`);
  }

  const projectId = (projData as { id: string }).id;

  // Add project members
  await adminClient.from("project_members").insert([
    { project_id: projectId, user_id: cdAuth.user.id, role: "MEMBER" },
    { project_id: projectId, user_id: aeAuth.user.id, role: "MEMBER" },
    { project_id: projectId, user_id: designerAuth.user.id, role: "MEMBER" },
    { project_id: projectId, user_id: editorAuth.user.id, role: "MEMBER" },
  ]);

  // Create brief
  const { error: briefErr } = await smsAuth.client.from("briefs").insert({
    project_id: projectId,
    objective: "Verify Phase 9 Internal QC Workflow",
    target_audience: "Production Team",
    key_message: "QC approval and revision loops are strictly bounded",
    deliverables_summary: "Graphics and Videos",
    created_by: smsAuth.user.id,
  });
  if (briefErr) {
    throw new Error(`Failed to create brief: ${briefErr.message}`);
  }

  // Advance to CONTENT_PLANNING
  const { error: planPhaseErr } = await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projectId,
    p_target_phase: "CONTENT_PLANNING",
  });
  if (planPhaseErr) {
    throw new Error(`Failed to advance to CONTENT_PLANNING: ${planPhaseErr.message}`);
  }

  // Create content plan
  const { error: cpErr } = await smsAuth.client.from("content_plans").insert({
    project_id: projectId,
    title: "Phase 9 Editorial Plan",
    channel: "Instagram",
    planned_post_date: "2026-09-25",
    copy_draft: "Phase 9 caption copy draft",
    status: "APPROVED",
    created_by: smsAuth.user.id,
  });
  if (cpErr) {
    throw new Error(`Failed to create content plan: ${cpErr.message}`);
  }

  // Mark script not required
  const { error: scriptErr } = await smsAuth.client.rpc("set_project_script_not_required", {
    p_project_id: projectId,
    p_not_required: true,
  });
  if (scriptErr) {
    throw new Error(`Failed to set script not required: ${scriptErr.message}`);
  }

  // Advance to SCRIPT_READY
  const { error: scriptReadyErr } = await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projectId,
    p_target_phase: "SCRIPT_READY",
  });
  if (scriptReadyErr) {
    throw new Error(`Failed to advance to SCRIPT_READY: ${scriptReadyErr.message}`);
  }

  // Create Task 1 (Graphic Design, requires_qc = true, assigned to Designer)
  const { data: task1Data, error: task1Err } = await smsAuth.client.rpc("create_production_task", {
    p_project_id: projectId,
    p_title: "Task 1 - Social Graphic",
    p_task_type: "GRAPHIC_DESIGN",
    p_priority: "HIGH",
    p_deadline: new Date(Date.now() + 432000000).toISOString(),
    p_notes: "Create hero post graphic",
    p_content_plan_id: null,
    p_script_id: null,
    p_assignee_id: designerAuth.user.id,
  });

  if (task1Err || !task1Data) {
    throw new Error(`Failed to create Task 1: ${task1Err?.message}`);
  }
  const task1Id = (task1Data as { task_id: string }).task_id;

  // Create Task 2 (Video, requires_qc = true, assigned to Editor)
  const { data: task2Data, error: task2Err } = await smsAuth.client.rpc("create_production_task", {
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

  if (task2Err || !task2Data) {
    throw new Error(`Failed to create Task 2: ${task2Err?.message}`);
  }
  const task2Id = (task2Data as { task_id: string }).task_id;

  // Advance Project to PRODUCTION
  const { error: startProdErr } = await smsAuth.client.rpc("start_production", {
    p_project_id: projectId,
  });
  assert(!startProdErr, "SETUP", "Start Production RPC", "Success", startProdErr ? startProdErr.message : "Success");

  // Verify initial project phase is PRODUCTION
  const { data: initialProject } = await adminClient
    .from("projects")
    .select("status")
    .eq("id", projectId)
    .single();
  assert(initialProject?.status === "PRODUCTION", "SETUP", "Initial Project Phase", "PRODUCTION", initialProject?.status || "null");

  // =========================================================================
  // GATE 1: QC CANNOT BE PERFORMED ON NON-IN_REVIEW TASKS
  // =========================================================================
  console.log("\n2. Testing QC on non-IN_REVIEW states (TODO, IN_PROGRESS)...");

  // 1a. CD attempts QC on TODO task
  const { error: todoQcErr } = await cdAuth.client.rpc("submit_qc_verdict", {
    p_task_id: task1Id,
    p_verdict: "APPROVED",
    p_notes: "",
  });
  assert(!!todoQcErr, "GATE 1", "QC on TODO task rejected", "Error", todoQcErr ? todoQcErr.message : "Allowed");

  // 1b. Assignee moves Task 1 to IN_PROGRESS
  const { error: moveProgressErr } = await designerAuth.client.rpc("transition_task_status", {
    p_task_id: task1Id,
    p_new_status: "IN_PROGRESS",
  });
  assert(!moveProgressErr, "GATE 1", "Designer transitions Task 1 to IN_PROGRESS", "Success", moveProgressErr ? moveProgressErr.message : "Success");

  // 1c. CD attempts QC on IN_PROGRESS task
  const { error: progressQcErr } = await cdAuth.client.rpc("submit_qc_verdict", {
    p_task_id: task1Id,
    p_verdict: "APPROVED",
    p_notes: "",
  });
  assert(!!progressQcErr, "GATE 1", "QC on IN_PROGRESS task rejected", "Error", progressQcErr ? progressQcErr.message : "Allowed");

  // 1d. Designer attempts to submit to IN_REVIEW without deliverable
  const { error: noDeliverableSubmitErr } = await designerAuth.client.rpc("transition_task_status", {
    p_task_id: task1Id,
    p_new_status: "IN_REVIEW",
  });
  assert(!!noDeliverableSubmitErr, "GATE 1", "Submit to IN_REVIEW without deliverable rejected", "Error", noDeliverableSubmitErr ? noDeliverableSubmitErr.message : "Allowed");

  // =========================================================================
  // GATE 2: DELIVERABLE UPLOAD & SUBMISSION TO IN_REVIEW
  // =========================================================================
  console.log("\n3. Testing deliverable upload and transition to IN_REVIEW...");

  const file1 = await uploadAndCommitDeliverable(
    designerAuth,
    task1Id,
    "hero-v1.png",
    "image/png",
    1024,
    "DESIGN"
  );
  assert(!!file1.fileId, "GATE 2", "Designer commits v1 deliverable", "Valid file ID", file1.fileId);
  const file1Id = file1.fileId;

  // Designer transitions Task 1 to IN_REVIEW
  const { error: submitReviewErr } = await designerAuth.client.rpc("transition_task_status", {
    p_task_id: task1Id,
    p_new_status: "IN_REVIEW",
  });
  assert(!submitReviewErr, "GATE 2", "Designer transitions Task 1 to IN_REVIEW", "Success", submitReviewErr ? submitReviewErr.message : "Success");

  const { data: task1InReview } = await adminClient
    .from("tasks")
    .select("status")
    .eq("id", task1Id)
    .single();
  assert(task1InReview?.status === "IN_REVIEW", "GATE 2", "Task 1 status is IN_REVIEW", "IN_REVIEW", task1InReview?.status || "null");

  // Verify project is STILL in PRODUCTION (Task 2 is still TODO)
  const { data: projStillProd } = await adminClient
    .from("projects")
    .select("status")
    .eq("id", projectId)
    .single();
  assert(projStillProd?.status === "PRODUCTION", "GATE 2", "Project remains PRODUCTION while Task 2 in TODO", "PRODUCTION", projStillProd?.status || "null");

  // =========================================================================
  // GATE 3: QC AUTHORITY & ACCESS CONTROL
  // =========================================================================
  console.log("\n4. Testing QC authority and role restrictions...");

  // 3a. Designer (assigned creative) calls submit_qc_verdict
  const { error: designerQcErr } = await designerAuth.client.rpc("submit_qc_verdict", {
    p_task_id: task1Id,
    p_verdict: "APPROVED",
    p_notes: "",
  });
  assert(!!designerQcErr, "GATE 3", "Designer cannot issue QC verdict", "Error", designerQcErr ? designerQcErr.message : "Allowed");

  // 3b. Editor (other creative) calls submit_qc_verdict
  const { error: editorQcErr } = await editorAuth.client.rpc("submit_qc_verdict", {
    p_task_id: task1Id,
    p_verdict: "APPROVED",
    p_notes: "",
  });
  assert(!!editorQcErr, "GATE 3", "Editor cannot issue QC verdict", "Error", editorQcErr ? editorQcErr.message : "Allowed");

  // 3c. AE calls submit_qc_verdict
  const { error: aeQcErr } = await aeAuth.client.rpc("submit_qc_verdict", {
    p_task_id: task1Id,
    p_verdict: "APPROVED",
    p_notes: "",
  });
  assert(!!aeQcErr, "GATE 3", "Account Executive cannot issue QC verdict", "Error", aeQcErr ? aeQcErr.message : "Allowed");

  // 3d. SMS calls submit_qc_verdict
  const { error: smsQcErr } = await smsAuth.client.rpc("submit_qc_verdict", {
    p_task_id: task1Id,
    p_verdict: "APPROVED",
    p_notes: "",
  });
  assert(!!smsQcErr, "GATE 3", "Social Media Specialist cannot issue QC verdict", "Error", smsQcErr ? smsQcErr.message : "Allowed");

  // 3e. Admin calls submit_qc_verdict (governance only, not operational approver)
  const { error: adminQcErr } = await adminAuth.client.rpc("submit_qc_verdict", {
    p_task_id: task1Id,
    p_verdict: "APPROVED",
    p_notes: "",
  });
  assert(!!adminQcErr, "GATE 3", "Admin cannot issue operational QC verdict", "Error", adminQcErr ? adminQcErr.message : "Allowed");

  // 3f. Direct INSERT into qc_reviews by Designer
  const { error: directInsertDesignerErr } = await designerAuth.client.from("qc_reviews").insert({
    project_id: projectId,
    task_id: task1Id,
    file_id: file1Id,
    reviewer_id: designerAuth.user.id,
    result: "APPROVED",
    round_number: 1,
    notes: "Direct insert attempt",
  });
  assert(!!directInsertDesignerErr, "GATE 3", "Direct INSERT into qc_reviews by Designer blocked", "Error", directInsertDesignerErr ? directInsertDesignerErr.message : "Allowed");

  // 3g. Direct INSERT into qc_reviews by Editor blocked
  const { error: directInsertEditorErr } = await editorAuth.client.from("qc_reviews").insert({
    project_id: projectId,
    task_id: task1Id,
    file_id: file1Id,
    reviewer_id: editorAuth.user.id,
    result: "APPROVED",
    round_number: 1,
    notes: "Direct insert attempt by Editor",
  });
  assert(!!directInsertEditorErr, "GATE 3", "Direct INSERT into qc_reviews by Editor blocked", "Error", directInsertEditorErr ? directInsertEditorErr.message : "Allowed");

  // 3h. Direct INSERT into qc_reviews by SMS blocked
  const { error: directInsertSmsErr } = await smsAuth.client.from("qc_reviews").insert({
    project_id: projectId,
    task_id: task1Id,
    file_id: file1Id,
    reviewer_id: smsAuth.user.id,
    result: "APPROVED",
    round_number: 1,
    notes: "Direct insert attempt by SMS",
  });
  assert(!!directInsertSmsErr, "GATE 3", "Direct INSERT into qc_reviews by SMS blocked", "Error", directInsertSmsErr ? directInsertSmsErr.message : "Allowed");

  // =========================================================================
  // GATE 4: SELF-REVIEW PREVENTION
  // =========================================================================
  console.log("\n5. Testing self-review prevention (CD cannot QC own uploaded file)...");

  // Create Task 3 assigned to CD
  const { data: task3Data } = await smsAuth.client.rpc("create_production_task", {
    p_project_id: projectId,
    p_title: "Task 3 - Concept Art by CD",
    p_task_type: "GRAPHIC_DESIGN",
    p_priority: "HIGH",
    p_deadline: new Date(Date.now() + 432000000).toISOString(),
    p_notes: "CD creates concept art",
    p_content_plan_id: null,
    p_script_id: null,
    p_assignee_id: cdAuth.user.id,
  });
  const task3Id = (task3Data as { task_id: string }).task_id;

  // CD transitions Task 3 to IN_PROGRESS
  await cdAuth.client.rpc("transition_task_status", {
    p_task_id: task3Id,
    p_new_status: "IN_PROGRESS",
  });

  // CD uploads deliverable
  await uploadAndCommitDeliverable(
    cdAuth,
    task3Id,
    "concept-v1.png",
    "image/png",
    1024,
    "DESIGN"
  );

  // CD submits Task 3 to IN_REVIEW
  await cdAuth.client.rpc("transition_task_status", {
    p_task_id: task3Id,
    p_new_status: "IN_REVIEW",
  });

  // CD attempts to QC own upload
  const { error: cdSelfReviewErr } = await cdAuth.client.rpc("submit_qc_verdict", {
    p_task_id: task3Id,
    p_verdict: "APPROVED",
    p_notes: "",
  });
  assert(!!cdSelfReviewErr, "GATE 4", "CD self-review rejected (file.uploaded_by = auth.uid())", "Error", cdSelfReviewErr ? cdSelfReviewErr.message : "Allowed");

  // Soft-delete Task 3 so it doesn't block the macro project phase later
  await adminClient.from("tasks").update({ deleted_at: new Date().toISOString() }).eq("id", task3Id);

  // =========================================================================
  // GATE 5: CURRENT REVIEW FILE IMMUTABILITY DURING IN_REVIEW
  // =========================================================================
  console.log("\n6. Testing review file immutability during IN_REVIEW...");

  // 5a. Designer attempts to soft-delete v1 file while Task 1 is IN_REVIEW
  const { error: delV1DesignerErr } = await designerAuth.client.rpc("soft_delete_project_file", {
    p_file_id: file1Id,
  });
  assert(!!delV1DesignerErr, "GATE 5", "Designer cannot delete deliverable while task is IN_REVIEW", "Error", delV1DesignerErr ? delV1DesignerErr.message : "Allowed");

  // 5b. SMS attempts to soft-delete v1 file while Task 1 is IN_REVIEW
  const { error: delV1SmsErr } = await smsAuth.client.rpc("soft_delete_project_file", {
    p_file_id: file1Id,
  });
  assert(!!delV1SmsErr, "GATE 5", "SMS cannot delete latest deliverable while task is IN_REVIEW", "Error", delV1SmsErr ? delV1SmsErr.message : "Allowed");

  // 5c. Admin attempts to soft-delete v1 file while Task 1 is IN_REVIEW
  const { error: delV1AdminErr } = await adminAuth.client.rpc("soft_delete_project_file", {
    p_file_id: file1Id,
  });
  assert(!!delV1AdminErr, "GATE 5", "Admin cannot delete latest deliverable while task is IN_REVIEW", "Error", delV1AdminErr ? delV1AdminErr.message : "Allowed");

  // =========================================================================
  // GATE 6: REVISION VERDICT & REVISION REQUEST CREATION
  // =========================================================================
  console.log("\n7. Testing revision verdict and revision request linkage...");

  // 6a. Revision verdict with empty notes rejected
  const { error: emptyNotesErr } = await cdAuth.client.rpc("submit_qc_verdict", {
    p_task_id: task1Id,
    p_verdict: "REVISION_REQUESTED",
    p_notes: "",
  });
  assert(!!emptyNotesErr, "GATE 6", "Revision verdict with empty notes rejected", "Error", emptyNotesErr ? emptyNotesErr.message : "Allowed");

  // 6b. Revision verdict with whitespace notes rejected
  const { error: whitespaceNotesErr } = await cdAuth.client.rpc("submit_qc_verdict", {
    p_task_id: task1Id,
    p_verdict: "REVISION_REQUESTED",
    p_notes: "     ",
  });
  assert(!!whitespaceNotesErr, "GATE 6", "Revision verdict with whitespace notes rejected", "Error", whitespaceNotesErr ? whitespaceNotesErr.message : "Allowed");

  // 6c. Revision verdict with > 5000 chars rejected
  const { error: toolongNotesErr } = await cdAuth.client.rpc("submit_qc_verdict", {
    p_task_id: task1Id,
    p_verdict: "REVISION_REQUESTED",
    p_notes: "A".repeat(5001),
  });
  assert(!!toolongNotesErr, "GATE 6", "Revision verdict with > 5000 chars rejected", "Error", toolongNotesErr ? toolongNotesErr.message : "Allowed");

  // 6d. Valid revision request by CD
  const revisionComment = "Perbaiki kontras font headline dan sesuaikan margin layout 24px.";
  const { error: validRevErr } = await cdAuth.client.rpc("submit_qc_verdict", {
    p_task_id: task1Id,
    p_verdict: "REVISION_REQUESTED",
    p_notes: revisionComment,
  });
  assert(!validRevErr, "GATE 6", "CD submits valid REVISION_REQUESTED verdict", "Success", validRevErr ? validRevErr.message : "Success");

  // Verify task status is REVISION_REQUESTED
  const { data: task1AfterRev } = await adminClient
    .from("tasks")
    .select("status")
    .eq("id", task1Id)
    .single();
  assert(task1AfterRev?.status === "REVISION_REQUESTED", "GATE 6", "Task 1 status is REVISION_REQUESTED", "REVISION_REQUESTED", task1AfterRev?.status || "null");

  // Verify qc_reviews entry
  const { data: qcReview1 } = await adminClient
    .from("qc_reviews")
    .select("*")
    .eq("task_id", task1Id)
    .eq("round_number", 1)
    .single();
  assert(qcReview1?.result === "REVISION_REQUESTED", "GATE 6", "QC review round 1 verdict is REVISION_REQUESTED", "REVISION_REQUESTED", qcReview1?.result || "null");
  assert(qcReview1?.file_id === file1Id, "GATE 6", "QC review bound to file v1", file1Id, qcReview1?.file_id || "null");
  assert(qcReview1?.reviewer_id === cdAuth.user.id, "GATE 6", "QC review reviewer is CD", cdAuth.user.id, qcReview1?.reviewer_id || "null");

  // Verify revision_requests entry
  const { data: revReq1 } = await adminClient
    .from("revision_requests")
    .select("*")
    .eq("task_id", task1Id)
    .eq("qc_review_id", qcReview1?.id)
    .single();
  assert(revReq1?.source === "INTERNAL_QC", "GATE 6", "Revision request source is INTERNAL_QC", "INTERNAL_QC", revReq1?.source || "null");
  assert(revReq1?.status === "OPEN", "GATE 6", "Revision request initial status is OPEN", "OPEN", revReq1?.status || "null");
  assert(revReq1?.notes === revisionComment, "GATE 6", "Revision request notes match CD feedback", revisionComment, revReq1?.notes || "null");
  assert(revReq1?.assigned_to === designerAuth.user.id, "GATE 6", "Revision assigned to Task PIC (Designer)", designerAuth.user.id, revReq1?.assigned_to || "null");

  // Verify activity event QC_REVISION_REQUESTED logged
  const { data: revActEvent } = await adminClient
    .from("activity_logs")
    .select("event_type, metadata")
    .eq("project_id", projectId)
    .eq("event_type", "QC_REVISION_REQUESTED")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  assert(!!revActEvent, "GATE 6", "Activity event QC_REVISION_REQUESTED logged", "Found", revActEvent ? revActEvent.event_type : "None");

  // =========================================================================
  // GATE 7: QC REVIEWS APPEND-ONLY ENFORCEMENT
  // =========================================================================
  console.log("\n8. Testing append-only integrity on qc_reviews (UPDATE and DELETE blocked)...");

  // 7a. Direct UPDATE on qc_reviews fails
  const { error: updateQcErr } = await adminClient
    .from("qc_reviews")
    .update({ result: "APPROVED" })
    .eq("id", qcReview1?.id);
  assert(!!updateQcErr, "GATE 7", "Direct UPDATE on qc_reviews strictly blocked", "Error", updateQcErr ? updateQcErr.message : "Allowed");

  // 7b. Direct DELETE on qc_reviews fails
  const { error: deleteQcErr } = await adminClient
    .from("qc_reviews")
    .delete()
    .eq("id", qcReview1?.id);
  assert(!!deleteQcErr, "GATE 7", "Direct DELETE on qc_reviews strictly blocked", "Error", deleteQcErr ? deleteQcErr.message : "Allowed");

  // =========================================================================
  // GATE 8: CONTROLLED RESUMPTION (REVISION_REQUESTED -> IN_PROGRESS)
  // =========================================================================
  console.log("\n9. Testing controlled resumption of revision work...");

  // 8a. Editor (not assigned to task) tries to resume revision
  const { error: editorResumeErr } = await editorAuth.client.rpc("transition_task_status", {
    p_task_id: task1Id,
    p_new_status: "IN_PROGRESS",
  });
  assert(!!editorResumeErr, "GATE 8", "Non-assignee cannot resume revision work", "Error", editorResumeErr ? editorResumeErr.message : "Allowed");

  // 8b. Designer (assignee) resumes revision work
  const { error: designerResumeErr } = await designerAuth.client.rpc("transition_task_status", {
    p_task_id: task1Id,
    p_new_status: "IN_PROGRESS",
  });
  assert(!designerResumeErr, "GATE 8", "Designer successfully resumes revision (Mulai Revisi)", "Success", designerResumeErr ? designerResumeErr.message : "Success");

  // Verify task status is IN_PROGRESS
  const { data: task1Resumed } = await adminClient
    .from("tasks")
    .select("status")
    .eq("id", task1Id)
    .single();
  assert(task1Resumed?.status === "IN_PROGRESS", "GATE 8", "Task 1 status is IN_PROGRESS", "IN_PROGRESS", task1Resumed?.status || "null");

  // Verify revision_request status transitioned to IN_PROGRESS
  const { data: revReqResumed } = await adminClient
    .from("revision_requests")
    .select("status")
    .eq("id", revReq1?.id)
    .single();
  assert(revReqResumed?.status === "IN_PROGRESS", "GATE 8", "Revision request transitioned to IN_PROGRESS", "IN_PROGRESS", revReqResumed?.status || "null");

  // Verify activity event REVISION_STARTED logged
  const { data: revStartAct } = await adminClient
    .from("activity_logs")
    .select("event_type")
    .eq("project_id", projectId)
    .eq("event_type", "REVISION_STARTED")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  assert(!!revStartAct, "GATE 8", "Activity event REVISION_STARTED logged", "Found", revStartAct ? revStartAct.event_type : "None");

  // =========================================================================
  // GATE 9: RESUBMISSION WITHOUT NEW VERSION STRICTLY BLOCKED
  // =========================================================================
  console.log("\n10. Testing resubmission without new version blocked...");

  // 9a. Designer tries to move IN_PROGRESS -> IN_REVIEW without uploading v2
  const { error: resubmitSameVersionErr } = await designerAuth.client.rpc("transition_task_status", {
    p_task_id: task1Id,
    p_new_status: "IN_REVIEW",
  });
  assert(!!resubmitSameVersionErr, "GATE 9", "Resubmission without new deliverable version rejected", "Error", resubmitSameVersionErr ? resubmitSameVersionErr.message : "Allowed");

  // 9b. Designer uploads v2 deliverable
  const file2 = await uploadAndCommitDeliverable(
    designerAuth,
    task1Id,
    "hero-v2.png",
    "image/png",
    2048,
    "DESIGN"
  );
  assert(!!file2.fileId, "GATE 9", "Designer commits v2 deliverable", "Valid file ID", file2.fileId);
  const file2Id = file2.fileId;

  // 9c. Now resubmission to IN_REVIEW succeeds
  const { error: resubmitV2SuccessErr } = await designerAuth.client.rpc("transition_task_status", {
    p_task_id: task1Id,
    p_new_status: "IN_REVIEW",
  });
  assert(!resubmitV2SuccessErr, "GATE 9", "Resubmission with v2 deliverable succeeds", "Success", resubmitV2SuccessErr ? resubmitV2SuccessErr.message : "Success");

  // Verify revision_request is now RESOLVED
  const { data: revReqResolved } = await adminClient
    .from("revision_requests")
    .select("status")
    .eq("id", revReq1?.id)
    .single();
  assert(revReqResolved?.status === "RESOLVED", "GATE 9", "Revision request transitioned to RESOLVED upon resubmission", "RESOLVED", revReqResolved?.status || "null");

  // =========================================================================
  // GATE 10: APPROVAL VERDICT & ASSET BINDING
  // =========================================================================
  console.log("\n11. Testing QC approval verdict...");

  // CD approves Task 1 (v2)
  const { error: approveTask1Err } = await cdAuth.client.rpc("submit_qc_verdict", {
    p_task_id: task1Id,
    p_verdict: "APPROVED",
    p_notes: "Desain v2 sudah sangat baik dan sesuai brief.",
  });
  assert(!approveTask1Err, "GATE 10", "CD approves Task 1 (v2)", "Success", approveTask1Err ? approveTask1Err.message : "Success");

  // Verify Task 1 status is APPROVED
  const { data: task1Approved } = await adminClient
    .from("tasks")
    .select("status")
    .eq("id", task1Id)
    .single();
  assert(task1Approved?.status === "APPROVED", "GATE 10", "Task 1 status is APPROVED", "APPROVED", task1Approved?.status || "null");

  // Verify qc_reviews entry for round 2
  const { data: qcReview2 } = await adminClient
    .from("qc_reviews")
    .select("*")
    .eq("task_id", task1Id)
    .eq("round_number", 2)
    .single();
  assert(qcReview2?.result === "APPROVED", "GATE 10", "QC review round 2 verdict is APPROVED", "APPROVED", qcReview2?.result || "null");
  assert(qcReview2?.file_id === file2Id, "GATE 10", "QC review bound to file v2", file2Id, qcReview2?.file_id || "null");

  // Verify activity event QC_APPROVED logged
  const { data: approveAct } = await adminClient
    .from("activity_logs")
    .select("event_type")
    .eq("project_id", projectId)
    .eq("event_type", "QC_APPROVED")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  assert(!!approveAct, "GATE 10", "Activity event QC_APPROVED logged", "Found", approveAct ? approveAct.event_type : "None");

  // =========================================================================
  // GATE 11: APPROVED TASK FREEZE & IMMUTABILITY
  // =========================================================================
  console.log("\n12. Testing approved task freeze (reassignment, edits, deletes blocked)...");

  // 11a. Designer tries to move approved task
  const { error: moveApprovedErr } = await designerAuth.client.rpc("transition_task_status", {
    p_task_id: task1Id,
    p_new_status: "IN_PROGRESS",
  });
  assert(!!moveApprovedErr, "GATE 11", "Transition out of APPROVED blocked", "Error", moveApprovedErr ? moveApprovedErr.message : "Allowed");

  // 11b. SMS tries to reassign approved task
  const { error: reassignApprovedErr } = await smsAuth.client.rpc("reassign_task", {
    p_task_id: task1Id,
    p_new_assignee_id: editorAuth.user.id,
  });
  assert(!!reassignApprovedErr, "GATE 11", "Reassignment of APPROVED task blocked", "Error", reassignApprovedErr ? reassignApprovedErr.message : "Allowed");

  // 11c. SMS tries to edit approved task metadata
  const { error: editApprovedErr } = await smsAuth.client.rpc("update_task_metadata", {
    p_task_id: task1Id,
    p_title: "Renamed Approved Task",
    p_priority: "LOW",
    p_deadline: new Date(Date.now() + 99999999).toISOString(),
    p_notes: "Changed notes",
    p_task_type: "GRAPHIC_DESIGN",
  });
  assert(!!editApprovedErr, "GATE 11", "Metadata mutation of APPROVED task blocked", "Error", editApprovedErr ? editApprovedErr.message : "Allowed");

  // 11d. Designer tries to soft-delete approved file v2
  const { error: deleteApprovedFileErr } = await designerAuth.client.rpc("soft_delete_project_file", {
    p_file_id: file2Id,
  });
  assert(!!deleteApprovedFileErr, "GATE 11", "Soft delete of APPROVED deliverable blocked", "Error", deleteApprovedFileErr ? deleteApprovedFileErr.message : "Allowed");

  // 11e. Designer tries to upload new version to approved task
  const { error: allocApprovedErr } = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: task1Id,
    p_file_name: "hero-v3.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 2048,
    p_file_type: "DESIGN",
  });
  assert(!!allocApprovedErr, "GATE 11", "New deliverable allocation to APPROVED task blocked", "Error", allocApprovedErr ? allocApprovedErr.message : "Allowed");

  // =========================================================================
  // GATE 12: MACRO PROJECT TRANSITION (PRODUCTION -> INTERNAL_QC)
  // =========================================================================
  console.log("\n13. Testing project macro transition to INTERNAL_QC...");

  // Verify Project is STILL in PRODUCTION because Task 2 is still TODO
  const { data: projPreQc } = await adminClient
    .from("projects")
    .select("status")
    .eq("id", projectId)
    .single();
  assert(projPreQc?.status === "PRODUCTION", "GATE 12", "Project stays in PRODUCTION while Task 2 is in TODO", "PRODUCTION", projPreQc?.status || "null");

  // Editor moves Task 2: TODO -> IN_PROGRESS
  await editorAuth.client.rpc("transition_task_status", {
    p_task_id: task2Id,
    p_new_status: "IN_PROGRESS",
  });

  // Editor uploads v1 deliverable for Task 2
  const fileTask2V1 = await uploadAndCommitDeliverable(
    editorAuth,
    task2Id,
    "reel-v1.mp4",
    "video/mp4",
    51200,
    "VIDEO"
  );
  assert(!!fileTask2V1.fileId, "GATE 12", "Editor commits Task 2 v1 deliverable", "Valid file ID", fileTask2V1.fileId);

  // Editor submits Task 2 to IN_REVIEW
  // Since Task 1 is APPROVED and Task 2 is now IN_REVIEW, all active QC-required tasks have submitted!
  const { error: submitTask2Err } = await editorAuth.client.rpc("transition_task_status", {
    p_task_id: task2Id,
    p_new_status: "IN_REVIEW",
  });
  assert(!submitTask2Err, "GATE 12", "Editor submits Task 2 to IN_REVIEW", "Success", submitTask2Err ? submitTask2Err.message : "Success");

  // Verify project phase has transitioned to INTERNAL_QC
  const { data: projInQc } = await adminClient
    .from("projects")
    .select("status")
    .eq("id", projectId)
    .single();
  assert(projInQc?.status === "INTERNAL_QC", "GATE 12", "Project automatically transitioned to INTERNAL_QC", "INTERNAL_QC", projInQc?.status || "null");

  // Verify exactly ONE project_status_history row was created for PRODUCTION -> INTERNAL_QC
  const { data: statusHistoryRows } = await adminClient
    .from("project_status_history")
    .select("*")
    .eq("project_id", projectId)
    .eq("from_status", "PRODUCTION")
    .eq("to_status", "INTERNAL_QC");
  assert(statusHistoryRows?.length === 1, "GATE 12", "Exactly ONE project_status_history row for PRODUCTION -> INTERNAL_QC", "1", String(statusHistoryRows?.length || 0));

  // Verify activity event INTERNAL_QC_STARTED logged
  const { data: qcStartAct } = await adminClient
    .from("activity_logs")
    .select("event_type")
    .eq("project_id", projectId)
    .eq("event_type", "INTERNAL_QC_STARTED")
    .single();
  assert(!!qcStartAct, "GATE 12", "Activity event INTERNAL_QC_STARTED logged", "Found", qcStartAct ? qcStartAct.event_type : "None");

  // =========================================================================
  // GATE 13: PROJECT REMAINS IN INTERNAL_QC DURING REVISION CYCLES
  // =========================================================================
  console.log("\n14. Testing project phase stability during revision cycles...");

  // CD requests revision on Task 2
  await cdAuth.client.rpc("submit_qc_verdict", {
    p_task_id: task2Id,
    p_verdict: "REVISION_REQUESTED",
    p_notes: "Perbaiki audio leveling pada detik 00:05.",
  });

  // Verify project phase REMAINS INTERNAL_QC (does NOT revert to PRODUCTION)
  const { data: projDuringRev } = await adminClient
    .from("projects")
    .select("status")
    .eq("id", projectId)
    .single();
  assert(projDuringRev?.status === "INTERNAL_QC", "GATE 13", "Project remains INTERNAL_QC during REVISION_REQUESTED", "INTERNAL_QC", projDuringRev?.status || "null");

  // Editor resumes revision (IN_PROGRESS)
  await editorAuth.client.rpc("transition_task_status", {
    p_task_id: task2Id,
    p_new_status: "IN_PROGRESS",
  });

  // Verify project phase REMAINS INTERNAL_QC
  const { data: projDuringProgress } = await adminClient
    .from("projects")
    .select("status")
    .eq("id", projectId)
    .single();
  assert(projDuringProgress?.status === "INTERNAL_QC", "GATE 13", "Project remains INTERNAL_QC during revision IN_PROGRESS", "INTERNAL_QC", projDuringProgress?.status || "null");

  // Editor uploads v2 deliverable for Task 2
  await uploadAndCommitDeliverable(
    editorAuth,
    task2Id,
    "reel-v2.mp4",
    "video/mp4",
    51200,
    "VIDEO"
  );

  // Editor resubmits Task 2 to IN_REVIEW
  await editorAuth.client.rpc("transition_task_status", {
    p_task_id: task2Id,
    p_new_status: "IN_REVIEW",
  });

  // =========================================================================
  // GATE 14: FINAL QC COMPLETION & BOUNDARY PRESERVATION
  // =========================================================================
  console.log("\n15. Testing final QC completion and boundary preservation...");

  // CD approves Task 2
  const { error: approveTask2Err } = await cdAuth.client.rpc("submit_qc_verdict", {
    p_task_id: task2Id,
    p_verdict: "APPROVED",
    p_notes: "Audio sudah jernih dan sesuai standar.",
  });
  assert(!approveTask2Err, "GATE 14", "CD approves Task 2", "Success", approveTask2Err ? approveTask2Err.message : "Success");

  // Both Task 1 and Task 2 are now APPROVED!
  // Verify activity event INTERNAL_QC_COMPLETED logged
  const { data: qcCompletedAct } = await adminClient
    .from("activity_logs")
    .select("event_type")
    .eq("project_id", projectId)
    .eq("event_type", "INTERNAL_QC_COMPLETED")
    .single();
  assert(!!qcCompletedAct, "GATE 14", "Activity event INTERNAL_QC_COMPLETED logged", "Found", qcCompletedAct ? qcCompletedAct.event_type : "None");

  // CRITICAL BOUNDARY: Project MUST REMAIN in INTERNAL_QC!
  // It MUST NOT auto-transition to CLIENT_REVIEW, APPROVED, or PUBLISHED!
  const { data: projFinalPhase } = await adminClient
    .from("projects")
    .select("status")
    .eq("id", projectId)
    .single();
  assert(projFinalPhase?.status === "INTERNAL_QC", "GATE 14", "Project remains INTERNAL_QC (no auto-transition to Phase 10)", "INTERNAL_QC", projFinalPhase?.status || "null");

  // =========================================================================
  // GATE 15: ANTI-FORGERY & IMMUTABILITY ON ACTIVITY LOGS
  // =========================================================================
  console.log("\n16. Testing anti-forgery and append-only on activity logs...");

  // Direct UPDATE on activity_logs blocked
  const { error: updateActErr } = await adminClient
    .from("activity_logs")
    .update({ event_type: "TAMPERED" })
    .eq("project_id", projectId);
  assert(!!updateActErr, "GATE 15", "Direct UPDATE on activity_logs strictly blocked", "Error", updateActErr ? updateActErr.message : "Allowed");

  // Direct DELETE on activity_logs blocked
  const { error: deleteActErr } = await adminClient
    .from("activity_logs")
    .delete()
    .eq("project_id", projectId);
  assert(!!deleteActErr, "GATE 15", "Direct DELETE on activity_logs strictly blocked", "Error", deleteActErr ? deleteActErr.message : "Allowed");

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log("\n===============================================================================");
  console.log(`PHASE 9 VERIFICATION COMPLETE: ${totalPassed} Passed, ${totalFailed} Failed`);
  console.log("===============================================================================");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runPhase9Verification().catch((err) => {
  console.error("Unhandled error during Phase 9 verification:", err);
  process.exit(1);
});
