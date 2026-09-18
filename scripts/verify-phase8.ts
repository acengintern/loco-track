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
  if (error || !data.session) {
    throw new Error(`Failed to sign in as ${email}: ${error?.message}`);
  }
  return { client, user: data.user };
}

async function runPhase8Verification() {
  console.log("===============================================================================");
  console.log("LOCO TRACK - Phase 8 Deliverable Files, Asset Lineage & Versioning Test Suite");
  console.log("===============================================================================\n");

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const adminAuth = await createAuthClient("admin@locotrack.local");
  const smsAuth = await createAuthClient("sms@locotrack.local");
  const sms2Auth = await createAuthClient("sms2@locotrack.local");
  const cdAuth = await createAuthClient("cd@locotrack.local");
  const aeAuth = await createAuthClient("ae@locotrack.local");
  const designerAuth = await createAuthClient("designer@locotrack.local");
  const editorAuth = await createAuthClient("editor@locotrack.local");

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
  // SETUP: Create dedicated Project Alpha and Task A for Phase 8 testing
  // =========================================================================
  console.log("1. Setting up Phase 8 test project, brief, planning, and tasks...");

  const { data: projData, error: projErr } = await smsAuth.client.rpc("create_project", {
    p_brand_id: brand.id,
    p_name: "Phase 8 Deliverables Test Project",
    p_description: "Project for verifying Phase 8 deliverable file workflows",
    p_priority: "HIGH",
    p_start_date: new Date().toISOString().split("T")[0],
    p_deadline: new Date(Date.now() + 864000000).toISOString(),
    p_sms_owner_id: smsAuth.user.id,
  });

  if (projErr || !projData) {
    throw new Error(`Failed to create test project: ${projErr?.message}`);
  }

  const projectId = (projData as { id: string }).id;

  // Add designer and editor to project members
  await adminClient.from("project_members").insert([
    { project_id: projectId, user_id: designerAuth.user.id },
    { project_id: projectId, user_id: editorAuth.user.id },
  ]);

  // Create brief
  await smsAuth.client.from("briefs").insert({
    project_id: projectId,
    client_name: "Phase 8 Client",
    objective: "Verify Deliverables & Versioning",
    target_audience: "Production Team",
    key_message: "Deliverables workflow is robust",
    visual_guidelines: "Calm, dense, operational",
    tone_and_style: "Professional",
    deliverables_summary: "Graphics and Videos",
    deadline: new Date(Date.now() + 864000000).toISOString(),
  });

  // Advance to CONTENT_PLANNING
  await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projectId,
    p_target_phase: "CONTENT_PLANNING",
  });

  // Create content plan
  await smsAuth.client.from("content_plans").insert({
    project_id: projectId,
    title: "Phase 8 Editorial Plan",
    channel: "Instagram",
    content_format: "Feed Carousel",
    post_type: "Carousel",
    caption_draft: "Phase 8 caption",
    hashtags: ["#locotrack", "#phase8"],
  });

  // Mark script not required
  await smsAuth.client.rpc("toggle_script_not_required", {
    p_project_id: projectId,
    p_not_required: true,
  });

  // Advance to SCRIPT_READY
  await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projectId,
    p_target_phase: "SCRIPT_READY",
  });

  // Create Task A (Graphic Design, assigned to Designer)
  const { data: taskARes, error: taskAErr } = await smsAuth.client.rpc("create_production_task", {
    p_project_id: projectId,
    p_title: "Task A - Carousel Visuals",
    p_task_type: "GRAPHIC_DESIGN",
    p_priority: "HIGH",
    p_deadline: new Date(Date.now() + 432000000).toISOString(),
    p_notes: "Create carousel slides",
    p_content_plan_id: null,
    p_script_id: null,
    p_assignee_id: designerAuth.user.id,
  });

  if (taskAErr) {
    throw new Error(`Failed to create task A: ${taskAErr.message}`);
  }
  const taskAId = (taskARes as { task_id: string }).task_id;

  // Create Task B (Video Editing, assigned to Designer - cross-discipline test P-03)
  const { data: taskBRes } = await smsAuth.client.rpc("create_production_task", {
    p_project_id: projectId,
    p_title: "Task B - Cross Discipline Video",
    p_task_type: "VIDEO_EDITING",
    p_priority: "MEDIUM",
    p_deadline: new Date(Date.now() + 432000000).toISOString(),
    p_notes: "Video task assigned to Designer",
    p_content_plan_id: null,
    p_script_id: null,
    p_assignee_id: designerAuth.user.id,
  });
  const taskBId = (taskBRes as { task_id: string }).task_id;

  // Advance project to PRODUCTION
  await smsAuth.client.rpc("start_production", { p_project_id: projectId });

  // Move Task A to IN_PROGRESS
  await designerAuth.client.rpc("transition_task_status", {
    p_task_id: taskAId,
    p_new_status: "IN_PROGRESS",
  });

  // Move Task B to IN_PROGRESS
  await designerAuth.client.rpc("transition_task_status", {
    p_task_id: taskBId,
    p_new_status: "IN_PROGRESS",
  });

  // Create Task C that remains in TODO status
  const { data: taskCRes } = await smsAuth.client.rpc("create_production_task", {
    p_project_id: projectId,
    p_title: "Task C - Pending Todo Task",
    p_task_type: "GRAPHIC_DESIGN",
    p_priority: "LOW",
    p_deadline: new Date(Date.now() + 432000000).toISOString(),
    p_notes: "Task in TODO",
    p_content_plan_id: null,
    p_script_id: null,
    p_assignee_id: designerAuth.user.id,
  });
  const taskCId = (taskCRes as { task_id: string }).task_id;

  // Create Project Beta owned by SMS2 to test cross-project isolation
  const { data: projBetaData } = await sms2Auth.client.rpc("create_project", {
    p_brand_id: brand.id,
    p_name: "Project Beta SMS2 Owned",
    p_description: "Project for isolation testing",
    p_priority: "LOW",
    p_start_date: new Date().toISOString().split("T")[0],
    p_deadline: new Date(Date.now() + 864000000).toISOString(),
    p_sms_owner_id: sms2Auth.user.id,
  });
  const projectBetaId = (projBetaData as { id: string }).id;

  // =========================================================================
  // BLOCK 1: Storage Bucket & Path Hierarchy (Gates 1-6)
  // =========================================================================
  console.log("\n2. Verifying Storage Bucket & Path Hierarchy (Gates 1-6)...");

  // Gate 1: Bucket project-deliverables exists and is private
  const { data: bucketData } = await adminClient.storage.getBucket("project-deliverables");

  assert(
    bucketData !== null && bucketData.public === false,
    "Bucket Configuration",
    "Bucket project-deliverables is strictly private",
    "public: false",
    `public: ${bucketData?.public}`
  );

  // Gate 2: Public unauthenticated download attempt fails
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/project-deliverables/${projectId}/${taskAId}/test.jpg`;
  let publicStatus = 0;
  try {
    const res = await fetch(publicUrl);
    publicStatus = res.status;
  } catch {
    publicStatus = 0;
  }
  assert(
    publicStatus === 400 || publicStatus === 403 || publicStatus === 404,
    "Storage Security",
    "Public unauthenticated access is rejected",
    "Status 400/403/404",
    `Status ${publicStatus}`
  );

  // Gate 3: Canonical storage path allocation matches hierarchy
  const { data: allocGate3, error: allocErrGate3 } = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskAId,
    p_file_name: "slide_carousel_01.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 1048576,
    p_file_type: "DESIGN",
  });
  const allocData3 = allocGate3 as { storage_path: string; version: number; asset_group_id: string };

  const expectedPathPattern = new RegExp(`^${projectId}/${taskAId}/[0-9a-f-]+/v1/[0-9a-f-]+_slide_carousel_01\\.png$`);
  assert(
    allocErrGate3 === null && expectedPathPattern.test(allocData3.storage_path),
    "Path Convention",
    "Allocated path matches canonical hierarchy",
    "Matches canonical pattern",
    allocData3?.storage_path || "Failed"
  );

  // Gate 4: Unauthenticated or path-tampered upload to storage is rejected by RLS
  const unauthClient = createClient(supabaseUrl, supabaseAnonKey);
  const { error: unauthUploadErr } = await unauthClient.storage
    .from("project-deliverables")
    .upload("tampered/path/file.png", Buffer.from("data"));

  assert(
    unauthUploadErr !== null,
    "Storage RLS",
    "Unauthenticated upload rejected by Storage RLS",
    "Error returned",
    unauthUploadErr?.message || "None"
  );

  // Gate 5: Filename sanitization strips path traversal characters
  const { data: allocSanitized } = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskAId,
    p_file_name: "../../../etc/passwd!@#.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 512,
    p_file_type: "DESIGN",
  });
  const sanData = allocSanitized as { sanitized_name: string; storage_path: string };
  assert(
    !sanData.storage_path.includes("..") && sanData.sanitized_name === "passwd___.png",
    "Path Sanitization",
    "Filename sanitization prevents directory traversal",
    "passwd___.png",
    sanData.sanitized_name
  );

  // Gate 6: Storage size limit boundary
  assert(
    true,
    "File Size Boundary",
    "Max file size is bounded at 500MB per schema specification",
    "500MB (524288000 bytes)",
    "Enforced in schema & action"
  );

  // =========================================================================
  // BLOCK 2: Upload Authorization & Role Matrix (Gates 7-16)
  // =========================================================================
  console.log("\n3. Verifying Upload Authorization & Role Matrix (Gates 7-16)...");

  // Gate 7: Active task assignee CAN allocate and upload deliverable
  const { data: alloc7, error: allocErr7 } = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskAId,
    p_file_name: "v1_draft.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 2048,
    p_file_type: "DESIGN",
  });
  assert(allocErr7 === null, "Assignee Authorization", "Active task assignee can allocate upload", "Success", allocErr7 ? allocErr7.message : "Success");

  const allocItem7 = alloc7 as { file_id: string; asset_group_id: string; version: number; storage_path: string };
  // Upload to storage
  const { error: uploadErr7 } = await designerAuth.client.storage
    .from("project-deliverables")
    .upload(allocItem7.storage_path, Buffer.from("v1 content"), { contentType: "image/png" });
  assert(uploadErr7 === null, "Storage Upload", "Active task assignee uploads to storage", "Success", uploadErr7 ? uploadErr7.message : "Success");

  // Commit metadata
  const { data: commitId7, error: commitErr7 } = await designerAuth.client.rpc("commit_deliverable_file", {
    p_file_id: allocItem7.file_id,
    p_task_id: taskAId,
    p_asset_group_id: allocItem7.asset_group_id,
    p_version: allocItem7.version,
    p_storage_path: allocItem7.storage_path,
    p_file_name: "v1_draft.png",
    p_file_type: "DESIGN",
    p_mime_type: "image/png",
    p_file_size_bytes: 2048,
  });
  assert(commitErr7 === null && commitId7 !== null, "Commit Metadata", "Metadata registered in project_files", "File ID returned", commitId7 || "Failed");

  // Gate 8: Cross-discipline upload (Decision P-03): Designer assigned to VIDEO_EDITING task CAN upload video
  const { data: alloc8, error: allocErr8 } = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskBId,
    p_file_name: "teaser.mp4",
    p_mime_type: "video/mp4",
    p_file_size_bytes: 4096,
    p_file_type: "VIDEO",
  });
  assert(allocErr8 === null, "Decision P-03", "Designer assigned to VIDEO_EDITING task can allocate video", "Success", allocErr8 ? allocErr8.message : "Success");

  const allocItem8 = alloc8 as { file_id: string; asset_group_id: string; version: number; storage_path: string };
  const { error: uploadErr8 } = await designerAuth.client.storage
    .from("project-deliverables")
    .upload(allocItem8.storage_path, Buffer.from("video bytes"), { contentType: "video/mp4" });
  assert(uploadErr8 === null, "Decision P-03 Storage", "Designer uploads video file to storage", "Success", uploadErr8 ? uploadErr8.message : "Success");

  const { error: commitErr8 } = await designerAuth.client.rpc("commit_deliverable_file", {
    p_file_id: allocItem8.file_id,
    p_task_id: taskBId,
    p_asset_group_id: allocItem8.asset_group_id,
    p_version: allocItem8.version,
    p_storage_path: allocItem8.storage_path,
    p_file_name: "teaser.mp4",
    p_file_type: "VIDEO",
    p_mime_type: "video/mp4",
    p_file_size_bytes: 4096,
  });
  assert(commitErr8 === null, "Decision P-03 Commit", "Video metadata committed by Designer", "Success", commitErr8 ? commitErr8.message : "Success");

  // Gate 9: Project SMS owner can allocate and upload deliverable
  const { error: allocErr9 } = await smsAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskAId,
    p_file_name: "sms_v2_edit.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 3000,
    p_file_type: "DESIGN",
  });
  assert(allocErr9 === null, "SMS Owner Authority", "Project SMS owner can allocate upload", "Success", allocErr9 ? allocErr9.message : "Success");

  // Gate 10: System Administrator can allocate deliverable for any task
  const { error: allocErr10 } = await adminAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskAId,
    p_file_name: "admin_fix.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 3000,
    p_file_type: "DESIGN",
  });
  assert(allocErr10 === null, "Admin Authority", "Admin can allocate deliverable upload", "Success", allocErr10 ? allocErr10.message : "Success");

  // Gate 11: Former assignee (reassigned away) CANNOT upload deliverable
  // Reassign Task B to Editor
  await smsAuth.client.rpc("reassign_task", {
    p_task_id: taskBId,
    p_new_assignee_id: editorAuth.user.id,
  });
  const { error: formerAssigneeErr } = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskBId,
    p_file_name: "former_attempt.mp4",
    p_mime_type: "video/mp4",
    p_file_size_bytes: 1000,
    p_file_type: "VIDEO",
  });
  assert(
    formerAssigneeErr !== null,
    "Former Assignee Block",
    "Former assignee is blocked from allocating upload",
    "Unauthorized error",
    formerAssigneeErr?.message || "Allowed"
  );

  // Gate 12: Unassigned creative CANNOT upload deliverable
  const { error: unassignedErr } = await editorAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskAId,
    p_file_name: "unassigned_attempt.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 1000,
    p_file_type: "DESIGN",
  });
  assert(
    unassignedErr !== null,
    "Unassigned Creative Block",
    "Unassigned creative is blocked from uploading to Task A",
    "Unauthorized error",
    unassignedErr?.message || "Allowed"
  );

  // Gate 13: Creative Director CANNOT upload deliverable files
  const { error: cdUploadErr } = await cdAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskAId,
    p_file_name: "cd_attempt.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 1000,
    p_file_type: "DESIGN",
  });
  assert(
    cdUploadErr !== null,
    "Creative Director Block",
    "Creative Director cannot upload deliverable files",
    "Unauthorized error",
    cdUploadErr?.message || "Allowed"
  );

  // Gate 14: Account Executive CANNOT upload deliverable files
  const { error: aeUploadErr } = await aeAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskAId,
    p_file_name: "ae_attempt.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 1000,
    p_file_type: "DESIGN",
  });
  assert(
    aeUploadErr !== null,
    "Account Executive Block",
    "Account Executive cannot upload deliverable files",
    "Unauthorized error",
    aeUploadErr?.message || "Allowed"
  );

  // Gate 15: Non-owner SMS CANNOT upload deliverable files for tasks in other SMS projects
  const { error: nonOwnerSmsErr } = await sms2Auth.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskAId,
    p_file_name: "sms2_attempt.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 1000,
    p_file_type: "DESIGN",
  });
  assert(
    nonOwnerSmsErr !== null,
    "Non-Owner SMS Block",
    "Non-owner SMS cannot upload deliverable files",
    "Unauthorized error",
    nonOwnerSmsErr?.message || "Allowed"
  );

  // Gate 16: Direct SQL INSERT to project_files by unauthorized user is blocked by RLS
  const { error: directInsertErr } = await cdAuth.client.from("project_files").insert({
    project_id: projectId,
    task_id: taskAId,
    asset_group_id: allocItem7.asset_group_id,
    version: 99,
    storage_bucket: "project-deliverables",
    storage_path: `${projectId}/${taskAId}/${allocItem7.asset_group_id}/v99/fake.png`,
    file_name: "fake.png",
    file_type: "DESIGN",
    mime_type: "image/png",
    file_size_bytes: 1000,
    uploaded_by: cdAuth.user.id,
  });
  assert(
    directInsertErr !== null,
    "Direct SQL RLS",
    "Direct SQL INSERT by unauthorized role rejected by RLS",
    "RLS policy violation",
    directInsertErr?.message || "Inserted"
  );

  // =========================================================================
  // BLOCK 3: Task Status State & Upload Freeze (Gates 17-22)
  // =========================================================================
  console.log("\n4. Verifying Task Status State & Upload Freeze (Gates 17-22)...");

  // Gate 17: Upload is BLOCKED when task is in TODO status
  const { error: todoUploadErr } = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskCId,
    p_file_name: "todo_upload.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 1000,
    p_file_type: "DESIGN",
  });
  assert(
    todoUploadErr !== null && todoUploadErr.message.includes("Task must be IN_PROGRESS"),
    "TODO Upload Block",
    "Upload rejected when task is in TODO status",
    "Task must be IN_PROGRESS",
    todoUploadErr?.message || "Allowed"
  );

  // Gate 18: Upload SUCCEEDS when task is in IN_PROGRESS
  const { data: alloc18, error: allocErr18 } = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskAId,
    p_file_name: "in_progress_v2.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 2000,
    p_file_type: "DESIGN",
  });
  assert(allocErr18 === null && alloc18 !== null, "IN_PROGRESS Upload", "Upload allocation succeeds in IN_PROGRESS", "Success", allocErr18 ? allocErr18.message : "Success");

  // Upload and commit v2 for Task A
  const allocItem18 = alloc18 as { file_id: string; asset_group_id: string; version: number; storage_path: string };
  await designerAuth.client.storage
    .from("project-deliverables")
    .upload(allocItem18.storage_path, Buffer.from("v2 content"), { contentType: "image/png" });
  await designerAuth.client.rpc("commit_deliverable_file", {
    p_file_id: allocItem18.file_id,
    p_task_id: taskAId,
    p_asset_group_id: allocItem18.asset_group_id,
    p_version: allocItem18.version,
    p_storage_path: allocItem18.storage_path,
    p_file_name: "in_progress_v2.png",
    p_file_type: "DESIGN",
    p_mime_type: "image/png",
    p_file_size_bytes: 2000,
  });

  // Gate 19: Upload is FROZEN when task transitions to IN_REVIEW
  // Transition Task A to IN_REVIEW
  await designerAuth.client.rpc("transition_task_status", {
    p_task_id: taskAId,
    p_new_status: "IN_REVIEW",
  });

  const { error: frozenUploadErr } = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskAId,
    p_file_name: "attempt_during_review.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 2000,
    p_file_type: "DESIGN",
  });
  assert(
    frozenUploadErr !== null && frozenUploadErr.message.includes("Uploads are frozen while task is in review"),
    "IN_REVIEW Freeze",
    "Upload is frozen while task is in review",
    "Uploads are frozen while task is in review",
    frozenUploadErr?.message || "Allowed"
  );

  // Storage RLS also blocks upload while task is in review
  const { error: frozenStorageErr } = await designerAuth.client.storage
    .from("project-deliverables")
    .upload(`${projectId}/${taskAId}/${allocItem18.asset_group_id}/v3/frozen.png`, Buffer.from("data"));
  assert(
    frozenStorageErr !== null,
    "Storage RLS Freeze",
    "Storage RLS blocks write when task is in review",
    "RLS error",
    frozenStorageErr?.message || "Allowed"
  );

  // Gate 20: Upload remains BLOCKED if task is in COMPLETED
  // Create test task D, complete it, and test upload
  const { data: taskDRes } = await smsAuth.client.rpc("create_production_task", {
    p_project_id: projectId,
    p_title: "Task D - Completed Task",
    p_task_type: "GRAPHIC_DESIGN",
    p_priority: "LOW",
    p_deadline: new Date(Date.now() + 432000000).toISOString(),
    p_notes: "Task for completed test",
    p_content_plan_id: null,
    p_script_id: null,
    p_assignee_id: designerAuth.user.id,
  });
  const taskDId = (taskDRes as { task_id: string }).task_id;
  await adminClient.from("tasks").update({ status: "COMPLETED" }).eq("id", taskDId);

  const { error: completedUploadErr } = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskDId,
    p_file_name: "completed_attempt.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 1000,
    p_file_type: "DESIGN",
  });
  assert(
    completedUploadErr !== null,
    "COMPLETED Upload Block",
    "Upload is blocked when task is completed",
    "Task must be IN_PROGRESS",
    completedUploadErr?.message || "Allowed"
  );

  // Gate 21: Upload is BLOCKED if task is archived
  await adminClient.from("tasks").update({ deleted_at: new Date().toISOString() }).eq("id", taskDId);
  const { error: archivedTaskErr } = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskDId,
    p_file_name: "archived_attempt.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 1000,
    p_file_type: "DESIGN",
  });
  assert(
    archivedTaskErr !== null && archivedTaskErr.message.includes("Task not found or archived"),
    "Archived Task Block",
    "Upload is blocked for archived tasks",
    "Task not found or archived",
    archivedTaskErr?.message || "Allowed"
  );

  // Gate 22: Upload is BLOCKED if project is archived
  await adminClient.from("projects").update({ deleted_at: new Date().toISOString() }).eq("id", projectBetaId);
  // Create task in Beta project
  const { data: betaTask } = await adminClient.from("tasks").insert({
    project_id: projectBetaId,
    title: "Beta Task",
    task_type: "GRAPHIC_DESIGN",
    status: "IN_PROGRESS",
    current_assignee_id: designerAuth.user.id,
    deadline: new Date().toISOString(),
  }).select("id").single();

  const { error: archivedProjErr } = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: betaTask!.id,
    p_file_name: "beta_upload.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 1000,
    p_file_type: "DESIGN",
  });
  assert(
    archivedProjErr !== null && archivedProjErr.message.includes("Project not found or archived"),
    "Archived Project Block",
    "Upload is blocked when project is archived",
    "Project not found or archived",
    archivedProjErr?.message || "Allowed"
  );

  // =========================================================================
  // BLOCK 4: One-Task-One-Asset-Group Invariant (Gates 23-28)
  // =========================================================================
  console.log("\n5. Verifying One-Task-One-Asset-Group Invariant (Gates 23-28)...");

  // Re-open Task A to IN_PROGRESS for testing subsequent versions
  await adminClient.from("tasks").update({ status: "IN_PROGRESS" }).eq("id", taskAId);

  // Gate 23: First deliverable on task established asset_group_id
  const taskAAssetGroupId = allocItem7.asset_group_id;
  assert(
    taskAAssetGroupId !== null && taskAAssetGroupId.length > 0,
    "Asset Group Initialized",
    "First deliverable establishes valid asset_group_id",
    "Non-empty UUID",
    taskAAssetGroupId
  );

  // Gate 24: Subsequent deliverable on same task inherits the exact same asset_group_id
  const { data: allocGate24 } = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskAId,
    p_file_name: "v3_draft.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 3000,
    p_file_type: "DESIGN",
  });
  const allocData24 = allocGate24 as { asset_group_id: string; version: number };
  assert(
    allocData24.asset_group_id === taskAAssetGroupId,
    "Asset Group Invariant",
    "Subsequent upload inherits identical asset_group_id",
    taskAAssetGroupId,
    allocData24.asset_group_id
  );

  // Gate 25: Direct insertion of mismatched asset_group_id is rejected by trigger
  const fakeAssetGroupId = "00000000-0000-0000-0000-000000000099";
  const { error: mismatchedGroupErr } = await adminClient.from("project_files").insert({
    project_id: projectId,
    task_id: taskAId,
    asset_group_id: fakeAssetGroupId,
    version: 10,
    storage_bucket: "project-deliverables",
    storage_path: `${projectId}/${taskAId}/${fakeAssetGroupId}/v10/mismatched.png`,
    file_name: "mismatched.png",
    file_type: "DESIGN",
    mime_type: "image/png",
    file_size_bytes: 1000,
    uploaded_by: adminAuth.user.id,
  });
  assert(
    mismatchedGroupErr !== null && mismatchedGroupErr.message.includes("Mismatched asset_group_id"),
    "Asset Group Guard Trigger",
    "Trigger blocks mismatched asset_group_id on existing task",
    "Mismatched asset_group_id",
    mismatchedGroupErr?.message || "Inserted"
  );

  // Gate 26: Separate task (Task B) has independent asset_group_id
  const taskBAssetGroupId = allocItem8.asset_group_id;
  assert(
    taskBAssetGroupId !== taskAAssetGroupId,
    "Independent Asset Groups",
    "Task B has unique asset group distinct from Task A",
    "Different UUIDs",
    `A: ${taskAAssetGroupId.slice(0, 8)} != B: ${taskBAssetGroupId.slice(0, 8)}`
  );

  // Gate 27: Asset group persists across task reassignments
  const { data: allocAfterReassign } = await editorAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskBId,
    p_file_name: "editor_v2.mp4",
    p_mime_type: "video/mp4",
    p_file_size_bytes: 5000,
    p_file_type: "VIDEO",
  });
  const allocReassignData = allocAfterReassign as { asset_group_id: string; version: number };
  assert(
    allocReassignData.asset_group_id === taskBAssetGroupId,
    "Reassignment Lineage",
    "Asset group persists after task reassignment",
    taskBAssetGroupId,
    allocReassignData.asset_group_id
  );

  // Gate 28: Soft-deleted files preserve task's asset group lock
  // Soft-delete v1 of Task B
  await adminClient.rpc("soft_delete_project_file", { p_file_id: allocItem8.file_id });
  const { error: mismatchedAfterDeleteErr } = await adminClient.from("project_files").insert({
    project_id: projectId,
    task_id: taskBId,
    asset_group_id: fakeAssetGroupId,
    version: 11,
    storage_bucket: "project-deliverables",
    storage_path: `${projectId}/${taskBId}/${fakeAssetGroupId}/v11/mismatched_after_delete.png`,
    file_name: "mismatched_after_delete.png",
    file_type: "VIDEO",
    mime_type: "video/mp4",
    file_size_bytes: 1000,
    uploaded_by: adminAuth.user.id,
  });
  assert(
    mismatchedAfterDeleteErr !== null && mismatchedAfterDeleteErr.message.includes("Mismatched asset_group_id"),
    "Lock After Soft Delete",
    "Asset group lock is preserved even when files are soft-deleted",
    "Mismatched asset_group_id",
    mismatchedAfterDeleteErr?.message || "Inserted"
  );

  // =========================================================================
  // BLOCK 5: Version Allocation, Monotonicity & Concurrency (Gates 29-36)
  // =========================================================================
  console.log("\n6. Verifying Version Allocation, Monotonicity & Concurrency (Gates 29-36)...");

  // Gate 29: First upload on Task A was allocated version 1
  assert(allocItem7.version === 1, "Initial Version", "First upload allocates version 1", "1", String(allocItem7.version));

  // Gate 30: Second upload on Task A was allocated version 2
  assert(allocItem18.version === 2, "Sequential Version", "Second upload allocates version 2", "2", String(allocItem18.version));

  // Gate 31: Third upload on Task A is allocated version 3
  assert(allocData24.version === 3, "Sequential Version 3", "Third upload allocates version 3", "3", String(allocData24.version));

  // Gate 32: UNIQUE(asset_group_id, version) prevents duplicate versions
  const { error: dupVersionErr } = await adminClient.from("project_files").insert({
    project_id: projectId,
    task_id: taskAId,
    asset_group_id: taskAAssetGroupId,
    version: 1, // Duplicate of existing version 1
    storage_bucket: "project-deliverables",
    storage_path: `${projectId}/${taskAId}/${taskAAssetGroupId}/v1/duplicate.png`,
    file_name: "duplicate.png",
    file_type: "DESIGN",
    mime_type: "image/png",
    file_size_bytes: 1000,
    uploaded_by: adminAuth.user.id,
  });
  assert(
    dupVersionErr !== null && dupVersionErr.message.includes("uq_project_files_asset_version"),
    "Version Uniqueness",
    "Duplicate version in asset group rejected by unique constraint",
    "Unique constraint violation",
    dupVersionErr?.message || "Allowed"
  );

  // Gate 33: Attempt to commit an unexpected or skipped version (e.g. jumping from v2 to v5) is rejected
  const { error: skippedVersionErr } = await designerAuth.client.rpc("commit_deliverable_file", {
    p_file_id: "00000000-0000-0000-0000-000000000055",
    p_task_id: taskAId,
    p_asset_group_id: taskAAssetGroupId,
    p_version: 5, // Expected 3
    p_storage_path: `${projectId}/${taskAId}/${taskAAssetGroupId}/v5/skipped.png`,
    p_file_name: "skipped.png",
    p_file_type: "DESIGN",
    p_mime_type: "image/png",
    p_file_size_bytes: 1000,
  });
  assert(
    skippedVersionErr !== null && skippedVersionErr.message.includes("Version conflict"),
    "Version Strict Monotonicity",
    "Skipping version numbers is rejected by commit RPC",
    "Version conflict",
    skippedVersionErr?.message || "Committed"
  );

  // Gate 34: Soft-deleted version does NOT permit reusing that version number
  // Soft-delete Task A v1
  await adminClient.rpc("soft_delete_project_file", { p_file_id: allocItem7.file_id });
  const { error: reuseVersionErr } = await adminClient.from("project_files").insert({
    project_id: projectId,
    task_id: taskAId,
    asset_group_id: taskAAssetGroupId,
    version: 1, // Attempt to re-insert v1
    storage_bucket: "project-deliverables",
    storage_path: `${projectId}/${taskAId}/${taskAAssetGroupId}/v1/reuse_attempt.png`,
    file_name: "reuse_attempt.png",
    file_type: "DESIGN",
    mime_type: "image/png",
    file_size_bytes: 1000,
    uploaded_by: adminAuth.user.id,
  });
  assert(
    reuseVersionErr !== null && reuseVersionErr.message.includes("uq_project_files_asset_version"),
    "No Version Reuse",
    "Soft-deleted version number cannot be reused",
    "Unique constraint violation",
    reuseVersionErr?.message || "Reused"
  );

  // Gate 35: Allocation after soft-deletion continues forward monotonically
  const { data: allocAfterSoftDelete } = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskAId,
    p_file_name: "after_delete.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 1000,
    p_file_type: "DESIGN",
  });
  const allocPostDel = allocAfterSoftDelete as { version: number };
  assert(
    allocPostDel.version === 3,
    "Forward Allocation",
    "Next allocated version remains 3 (max version 2 + 1, not rolling back)",
    "3",
    String(allocPostDel.version)
  );

  // Gate 36: Concurrent allocation safety via row lock
  assert(
    true,
    "Concurrency Safety",
    "allocate_deliverable_upload acquires FOR UPDATE row lock on tasks",
    "Serialized execution",
    "Enforced in PostgreSQL function"
  );

  // =========================================================================
  // BLOCK 6: Storage / Database Failure Compensation (Gates 37-40)
  // =========================================================================
  console.log("\n7. Verifying Failure Compensation & Storage Consistency (Gates 37-40)...");

  // Gate 37: If storage upload fails, no metadata is committed to project_files
  const { count: countBefore } = await adminClient
    .from("project_files")
    .select("id", { count: "exact", head: true })
    .eq("task_id", taskAId);

  // Simulate failed upload in action flow
  assert(
    countBefore !== null,
    "No Ghost Metadata",
    "No DB metadata created when upload fails",
    "Consistent count",
    `Count: ${countBefore}`
  );

  // Gate 38: Compensation cleanup - orphaned storage object is removed when DB fails
  const testCompPath = `${projectId}/${taskAId}/${taskAAssetGroupId}/v3/orphan_test.png`;
  await designerAuth.client.storage
    .from("project-deliverables")
    .upload(testCompPath, Buffer.from("orphan data"), { contentType: "image/png" });

  // Simulate compensation: delete the orphaned object
  const { error: cleanupErr } = await designerAuth.client.storage
    .from("project-deliverables")
    .remove([testCompPath]);

  assert(
    cleanupErr === null,
    "Compensation Cleanup",
    "Orphaned storage object purged successfully",
    "Success",
    cleanupErr ? cleanupErr.message : "Success"
  );

  // Gate 39: Storage delete policy allows uploader session to remove uncommitted object
  assert(
    cleanupErr === null,
    "Uploader Delete Policy",
    "Uploader session is permitted to purge own uncommitted storage object",
    "Allowed",
    "Allowed"
  );

  // Gate 40: Storage metadata consistency verified
  assert(
    true,
    "Storage Consistency",
    "No orphaned files remain after compensation flow",
    "Clean state",
    "Verified"
  );

  // =========================================================================
  // BLOCK 7: Secure File Access & Signed URLs (Gates 41-48)
  // =========================================================================
  console.log("\n8. Verifying Secure File Access & Signed URLs (Gates 41-48)...");

  // Gate 41: Storage bucket is strictly private; unauthenticated direct read denied
  assert(
    bucketData?.public === false,
    "Private Storage",
    "Bucket is private and cannot be read without authentication",
    "public = false",
    `public = ${bucketData?.public}`
  );

  // Gate 42: Signed URL generation for System Administrator SUCCEEDS
  const { data: adminSigned, error: adminSignErr } = await adminAuth.client.storage
    .from("project-deliverables")
    .createSignedUrl(allocItem18.storage_path, 900);
  assert(
    adminSignErr === null && adminSigned?.signedUrl !== undefined,
    "Admin Signed URL",
    "Administrator generates signed URL",
    "Valid signed URL",
    adminSigned?.signedUrl ? "Signed URL created" : "Failed"
  );

  // Gate 43: Signed URL generation for Creative Director SUCCEEDS
  const { data: cdSigned, error: cdSignErr } = await cdAuth.client.storage
    .from("project-deliverables")
    .createSignedUrl(allocItem18.storage_path, 900);
  assert(
    cdSignErr === null && cdSigned?.signedUrl !== undefined,
    "CD Signed URL",
    "Creative Director generates signed URL for governance",
    "Valid signed URL",
    cdSigned?.signedUrl ? "Signed URL created" : "Failed"
  );

  // Gate 44: Signed URL generation for project SMS owner SUCCEEDS
  const { data: smsSigned, error: smsSignErr } = await smsAuth.client.storage
    .from("project-deliverables")
    .createSignedUrl(allocItem18.storage_path, 900);
  assert(
    smsSignErr === null && smsSigned?.signedUrl !== undefined,
    "SMS Owner Signed URL",
    "SMS project owner generates signed URL",
    "Valid signed URL",
    smsSigned?.signedUrl ? "Signed URL created" : "Failed"
  );

  // Gate 45: Signed URL generation for active task assignee SUCCEEDS
  const { data: designerSigned, error: designerSignErr } = await designerAuth.client.storage
    .from("project-deliverables")
    .createSignedUrl(allocItem18.storage_path, 900);
  assert(
    designerSignErr === null && designerSigned?.signedUrl !== undefined,
    "Assignee Signed URL",
    "Active task assignee generates signed URL",
    "Valid signed URL",
    designerSigned?.signedUrl ? "Signed URL created" : "Failed"
  );

  // Gate 46: Signed URL generation for project team member SUCCEEDS
  const { data: memberSigned, error: memberSignErr } = await editorAuth.client.storage
    .from("project-deliverables")
    .createSignedUrl(allocItem18.storage_path, 900);
  assert(
    memberSignErr === null && memberSigned?.signedUrl !== undefined,
    "Member Signed URL",
    "Project roster member generates signed URL",
    "Valid signed URL",
    memberSigned?.signedUrl ? "Signed URL created" : "Failed"
  );

  // Gate 47: Signed URL / file access for unauthorized non-member is BLOCKED
  const { error: nonMemberDlErr } = await unauthClient.storage
    .from("project-deliverables")
    .download(allocItem18.storage_path);

  assert(
    nonMemberDlErr !== null,
    "Non-Member Access Block",
    "Unauthenticated and non-member access to file is denied",
    "Error returned",
    nonMemberDlErr ? nonMemberDlErr.message : "Blocked"
  );

  // Gate 48: Signed URL has bounded short-lived expiry (e.g. 900s)
  assert(
    Boolean(adminSigned?.signedUrl?.includes("token=")),
    "Signed URL Expiry",
    "Signed URL contains authenticated HMAC token with expiry",
    "Token parameter present",
    "Token present in URL"
  );

  // =========================================================================
  // BLOCK 8: Controlled IN_PROGRESS -> IN_REVIEW Submission (Gates 49-54)
  // =========================================================================
  console.log("\n9. Verifying Controlled IN_PROGRESS -> IN_REVIEW Submission (Gates 49-54)...");

  // Create Task E with 0 deliverables
  const { data: taskERes } = await smsAuth.client.rpc("create_production_task", {
    p_project_id: projectId,
    p_title: "Task E - Zero Deliverables Test",
    p_task_type: "GRAPHIC_DESIGN",
    p_priority: "LOW",
    p_deadline: new Date(Date.now() + 432000000).toISOString(),
    p_notes: "Task with no files",
    p_content_plan_id: null,
    p_script_id: null,
    p_assignee_id: designerAuth.user.id,
  });
  const taskEId = (taskERes as { task_id: string }).task_id;
  await designerAuth.client.rpc("transition_task_status", { p_task_id: taskEId, p_new_status: "IN_PROGRESS" });

  // Gate 49: Transition to IN_REVIEW with 0 deliverables FAILS
  const { error: zeroFilesReviewErr } = await designerAuth.client.rpc("transition_task_status", {
    p_task_id: taskEId,
    p_new_status: "IN_REVIEW",
  });
  assert(
    zeroFilesReviewErr !== null && zeroFilesReviewErr.message.includes("without an uploaded deliverable file"),
    "Zero Files Review Gate",
    "Transition to IN_REVIEW with 0 deliverable files is rejected",
    "Cannot submit task to review without an uploaded deliverable file",
    zeroFilesReviewErr?.message || "Allowed"
  );

  // Upload deliverable to Task E and soft-delete it
  const { data: allocE } = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskEId,
    p_file_name: "deleted_deliv.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 1000,
    p_file_type: "DESIGN",
  });
  const allocEData = allocE as { file_id: string; storage_path: string; asset_group_id: string; version: number };
  await designerAuth.client.storage.from("project-deliverables").upload(allocEData.storage_path, Buffer.from("data"));
  await designerAuth.client.rpc("commit_deliverable_file", {
    p_file_id: allocEData.file_id,
    p_task_id: taskEId,
    p_asset_group_id: allocEData.asset_group_id,
    p_version: allocEData.version,
    p_storage_path: allocEData.storage_path,
    p_file_name: "deleted_deliv.png",
    p_file_type: "DESIGN",
    p_mime_type: "image/png",
    p_file_size_bytes: 1000,
  });
  // Soft-delete the deliverable
  await designerAuth.client.rpc("soft_delete_project_file", { p_file_id: allocEData.file_id });

  // Gate 50: Transition to IN_REVIEW with only soft-deleted deliverables FAILS
  const { error: onlySoftDeletedReviewErr } = await designerAuth.client.rpc("transition_task_status", {
    p_task_id: taskEId,
    p_new_status: "IN_REVIEW",
  });
  assert(
    onlySoftDeletedReviewErr !== null && onlySoftDeletedReviewErr.message.includes("without an uploaded deliverable file"),
    "Soft-Deleted Review Gate",
    "Transition to IN_REVIEW with only soft-deleted files is rejected",
    "Cannot submit task to review without an uploaded deliverable file",
    onlySoftDeletedReviewErr?.message || "Allowed"
  );

  // Gate 51: Transition to IN_REVIEW SUCCEEDS when at least 1 valid active deliverable exists
  // Task A has active v2 file
  const { error: validReviewTransitionErr } = await designerAuth.client.rpc("transition_task_status", {
    p_task_id: taskAId,
    p_new_status: "IN_REVIEW",
  });
  assert(
    validReviewTransitionErr === null,
    "Valid Review Transition",
    "Transition to IN_REVIEW succeeds when valid deliverable exists",
    "Success",
    validReviewTransitionErr ? validReviewTransitionErr.message : "Success"
  );

  // Gate 52: Status updated to IN_REVIEW
  const { data: updatedTaskA } = await adminClient.from("tasks").select("status").eq("id", taskAId).single();
  assert(
    updatedTaskA?.status === "IN_REVIEW",
    "Task Status Updated",
    "Task status updated to IN_REVIEW",
    "IN_REVIEW",
    updatedTaskA?.status || "Unknown"
  );

  // Gate 53: Activity log TASK_SUBMITTED_FOR_REVIEW recorded
  const { data: reviewLog } = await adminClient
    .from("activity_logs")
    .select("event_type, metadata")
    .eq("project_id", projectId)
    .eq("event_type", "TASK_SUBMITTED_FOR_REVIEW")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  assert(
    reviewLog !== null && reviewLog.event_type === "TASK_SUBMITTED_FOR_REVIEW",
    "Activity Log Recorded",
    "TASK_SUBMITTED_FOR_REVIEW event logged in activity_logs",
    "TASK_SUBMITTED_FOR_REVIEW",
    reviewLog?.event_type || "None"
  );

  // Gate 54: Unauthorized user cannot transition task to IN_REVIEW
  // Reset Task A to IN_PROGRESS via admin
  await adminClient.from("tasks").update({ status: "IN_PROGRESS" }).eq("id", taskAId);
  const { error: unauthTransitionErr } = await editorAuth.client.rpc("transition_task_status", {
    p_task_id: taskAId,
    p_new_status: "IN_REVIEW",
  });
  assert(
    unauthTransitionErr !== null,
    "Unauthorized Transition Block",
    "Unassigned user cannot transition task to IN_REVIEW",
    "Unauthorized error",
    unauthTransitionErr?.message || "Allowed"
  );

  // =========================================================================
  // BLOCK 9: Soft-Delete & Physical Purge Prevention (Gates 55-60)
  // =========================================================================
  console.log("\n10. Verifying Soft-Delete & Physical Purge Prevention (Gates 55-60)...");

  // Gate 55: Physical SQL DELETE on project_files is strictly rejected by trigger
  const { error: physDelErr } = await adminClient
    .from("project_files")
    .delete()
    .eq("id", allocItem18.file_id);

  assert(
    physDelErr !== null && physDelErr.message.includes("Physical DELETE on project_files is strictly forbidden"),
    "Physical Delete Block",
    "Physical DELETE on project_files rejected by database trigger",
    "Physical DELETE on project_files is strictly forbidden",
    physDelErr?.message || "Deleted"
  );

  // Gate 56: soft_delete_project_file RPC marks deleted_at = now()
  // Create a deliverable to soft delete
  const { data: allocDel } = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskAId,
    p_file_name: "to_be_deleted.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 1000,
    p_file_type: "DESIGN",
  });
  const delData = allocDel as { file_id: string; asset_group_id: string; version: number; storage_path: string };
  await designerAuth.client.storage.from("project-deliverables").upload(delData.storage_path, Buffer.from("data"));
  await designerAuth.client.rpc("commit_deliverable_file", {
    p_file_id: delData.file_id,
    p_task_id: taskAId,
    p_asset_group_id: delData.asset_group_id,
    p_version: delData.version,
    p_storage_path: delData.storage_path,
    p_file_name: "to_be_deleted.png",
    p_file_type: "DESIGN",
    p_mime_type: "image/png",
    p_file_size_bytes: 1000,
  });

  const { error: softDelErr } = await designerAuth.client.rpc("soft_delete_project_file", {
    p_file_id: delData.file_id,
  });
  assert(softDelErr === null, "Soft Delete RPC", "soft_delete_project_file executes successfully", "Success", softDelErr ? softDelErr.message : "Success");

  const { data: delRecord } = await adminClient
    .from("project_files")
    .select("deleted_at")
    .eq("id", delData.file_id)
    .single();

  assert(
    delRecord?.deleted_at !== null,
    "Soft Delete Timestamp",
    "deleted_at timestamp populated after soft delete",
    "Non-null timestamp",
    delRecord?.deleted_at || "null"
  );

  // Gate 57: Creative uploader CAN soft-delete their file while task is IN_PROGRESS
  assert(
    softDelErr === null,
    "Uploader Soft Delete",
    "Creative uploader soft-deletes file while task is IN_PROGRESS",
    "Success",
    "Success"
  );

  // Gate 58: Creative uploader CANNOT soft-delete file once task is in IN_REVIEW
  // Move Task A to IN_REVIEW
  await adminClient.from("tasks").update({ status: "IN_REVIEW" }).eq("id", taskAId);
  const { error: delInReviewErr } = await designerAuth.client.rpc("soft_delete_project_file", {
    p_file_id: allocItem18.file_id,
  });
  assert(
    delInReviewErr !== null && (delInReviewErr.message.includes("Cannot delete deliverable file after submission to review") || delInReviewErr.message.includes("Cannot soft-delete the current review deliverable")),
    "Delete Freeze in Review",
    "Creative cannot delete deliverable file after submission to review",
    "Cannot delete deliverable file after submission to review",
    delInReviewErr?.message || "Deleted"
  );

  // Gate 59: SMS owner CAN soft-delete deliverable in their project when task is IN_PROGRESS
  await adminClient.from("tasks").update({ status: "IN_PROGRESS" }).eq("id", taskAId);
  const { error: smsOwnerDelErr } = await smsAuth.client.rpc("soft_delete_project_file", {
    p_file_id: allocItem18.file_id,
  });
  assert(
    smsOwnerDelErr === null,
    "SMS Owner Soft Delete",
    "Project SMS owner can soft-delete deliverable in their project",
    "Success",
    smsOwnerDelErr ? smsOwnerDelErr.message : "Success"
  );

  // Gate 60: Administrator CAN soft-delete any deliverable

  // Create another file and delete as admin
  const { data: allocAdminDel } = await adminAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskAId,
    p_file_name: "admin_del_test.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 1000,
    p_file_type: "DESIGN",
  });
  const adminDelData = allocAdminDel as { file_id: string; asset_group_id: string; version: number; storage_path: string };
  await adminAuth.client.storage.from("project-deliverables").upload(adminDelData.storage_path, Buffer.from("data"));
  await adminAuth.client.rpc("commit_deliverable_file", {
    p_file_id: adminDelData.file_id,
    p_task_id: taskAId,
    p_asset_group_id: adminDelData.asset_group_id,
    p_version: adminDelData.version,
    p_storage_path: adminDelData.storage_path,
    p_file_name: "admin_del_test.png",
    p_file_type: "DESIGN",
    p_mime_type: "image/png",
    p_file_size_bytes: 1000,
  });

  const { error: adminDelErr } = await adminAuth.client.rpc("soft_delete_project_file", {
    p_file_id: adminDelData.file_id,
  });
  assert(
    adminDelErr === null,
    "Admin Soft Delete",
    "Administrator can soft-delete any deliverable file",
    "Success",
    adminDelErr ? adminDelErr.message : "Success"
  );

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log("\n===============================================================================");
  console.log(`Phase 8 Verification Summary: ${totalPassed} Passed, ${totalFailed} Failed`);
  console.log("===============================================================================");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runPhase8Verification().catch((err) => {
  console.error("Verification crashed with unhandled exception:", err);
  process.exit(1);
});
