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

async function runPhase7Verification() {
  console.log("===============================================================================");
  console.log("LOCO TRACK - Phase 7 & 7.1 Task Management & Production Integrity Verification");
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

  // Fetch or create active test brand
  const { data: brand } = await adminClient
    .from("brands")
    .select("id, client_id")
    .limit(1)
    .single();

  if (!brand) {
    throw new Error("No brand found in database. Seed data required.");
  }

  // =========================================================================
  // Section 1: Project Setup for Phase 7
  // =========================================================================
  console.log("--- Section 1: Setup Test Project in SCRIPT_READY ---");

  const timestamp = Date.now();
  const futureStart = new Date();
  const futureEnd = new Date();
  futureEnd.setDate(futureEnd.getDate() + 30);

  // Project A created via create_project RPC owned by SMS
  const { data: resA, error: projAErr } = await smsAuth.client.rpc("create_project", {
    p_brand_id: brand.id,
    p_name: `Phase 7 Verification Project Alpha ${timestamp}`,
    p_description: "Testing Task Creation, Assignment & Production Entry",
    p_priority: "HIGH",
    p_start_date: futureStart.toISOString().slice(0, 10),
    p_deadline: futureEnd.toISOString(),
    p_sms_owner_id: smsAuth.user.id,
  });

  const projectA = { id: (resA as { id: string })?.id, deadline: futureEnd.toISOString() };
  assert(!!projectA.id && !projAErr, "Setup", "Create Test Project A", "project created", projAErr ? projAErr.message : `id: ${projectA.id}`);

  // Project B created via create_project RPC owned by SMS2
  const { data: resB, error: projBErr } = await sms2Auth.client.rpc("create_project", {
    p_brand_id: brand.id,
    p_name: `Phase 7 Verification Project Beta ${timestamp}`,
    p_description: "Cross Project Boundary Isolation Project",
    p_priority: "MEDIUM",
    p_start_date: futureStart.toISOString().slice(0, 10),
    p_deadline: futureEnd.toISOString(),
    p_sms_owner_id: sms2Auth.user.id,
  });

  const projectB = { id: (resB as { id: string })?.id, deadline: futureEnd.toISOString() };
  assert(!!projectB.id && !projBErr, "Setup", "Create Test Project B", "project created", projBErr ? projBErr.message : `id: ${projectB.id}`);

  // Add brief and content plan to Project A, advance to SCRIPT_READY
  const { data: briefA, error: briefAErr } = await adminClient
    .from("briefs")
    .insert({
      project_id: projectA.id,
      objective: "Phase 7 Objective",
      target_audience: "Digital Audience",
      key_message: "High Quality Content",
      deliverables_summary: "3 Video Reels dan 5 Grafis Feed Instagram",
      created_by: smsAuth.user.id,
    })
    .select()
    .single();

  assert(!briefAErr && !!briefA, "Setup", "Create Brief for Project A", "brief created", briefAErr ? briefAErr.message : `id: ${briefA?.id}`);

  const { error: trCPErr } = await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projectA.id,
    p_target_phase: "CONTENT_PLANNING",
  });
  assert(!trCPErr, "Setup", "Advance Project A to CONTENT_PLANNING", "advanced to CONTENT_PLANNING", trCPErr ? trCPErr.message : "success");

  const { data: planA } = await adminClient
    .from("content_plans")
    .insert({
      project_id: projectA.id,
      title: "Alpha Reel Content Plan",
      channel: "INSTAGRAM",
      planned_post_date: futureEnd.toISOString().slice(0, 10),
      status: "APPROVED",
      pillar: "ENTERTAINMENT",
      created_by: smsAuth.user.id,
    })
    .select()
    .single();

  const { data: scriptA, error: scAErr } = await adminClient
    .from("scripts")
    .insert({
      project_id: projectA.id,
      content_plan_id: planA.id,
      title: "Alpha Reel Script",
      hook: "Did you know this secret?",
      body: "Here is the explanation...",
      visual_cues: "Camera moves closer, text popup on screen",
      call_to_action: "Follow for more",
      status: "READY",
      created_by: smsAuth.user.id,
    })
    .select()
    .single();

  assert(!scAErr && !!scriptA, "Setup", "Create Script for Project A", "script created", scAErr ? scAErr.message : `id: ${scriptA?.id}`);

  // Also plan on Project B for cross-project isolation tests
  await adminClient.from("briefs").insert({
    project_id: projectB.id,
    objective: "Beta Objective",
    target_audience: "Beta Audience",
    key_message: "Beta Key Message",
    deliverables_summary: "TikTok video deliverables",
    created_by: sms2Auth.user.id,
  });

  await sms2Auth.client.rpc("transition_project_phase", {
    p_project_id: projectB.id,
    p_target_phase: "CONTENT_PLANNING",
  });

  const { data: planB } = await adminClient
    .from("content_plans")
    .insert({
      project_id: projectB.id,
      title: "Beta Content Plan",
      channel: "TIKTOK",
      planned_post_date: futureEnd.toISOString().slice(0, 10),
      status: "APPROVED",
      pillar: "EDUCATION",
      created_by: sms2Auth.user.id,
    })
    .select()
    .single();

  const { data: scriptB, error: scBErr } = await adminClient
    .from("scripts")
    .insert({
      project_id: projectB.id,
      content_plan_id: planB.id,
      title: "Beta Script",
      hook: "Beta Hook",
      body: "Beta Body",
      visual_cues: "Text on screen",
      call_to_action: "Beta CTA",
      status: "READY",
      created_by: sms2Auth.user.id,
    })
    .select()
    .single();

  assert(!scBErr && !!scriptB, "Setup", "Create Script for Project B", "script created", scBErr ? scBErr.message : `id: ${scriptB?.id}`);

  // Transition Project A to SCRIPT_READY
  const { error: trErr } = await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projectA.id,
    p_target_phase: "SCRIPT_READY",
  });
  assert(!trErr, "Setup", "Advance Project A to SCRIPT_READY", "advanced to SCRIPT_READY", trErr ? trErr.message : "success");

  // =========================================================================
  // Section 2: Task Creation Permissions
  // =========================================================================
  console.log("\n--- Section 2: Task Creation Permissions & Role Boundaries ---");

  const taskDeadline = new Date();
  taskDeadline.setDate(taskDeadline.getDate() + 15);
  const taskDeadlineStr = taskDeadline.toISOString();

  // Test 2.1: SMS owner can create production task
  const { data: resTask1, error: t1Err } = await smsAuth.client.rpc("create_production_task", {
    p_project_id: projectA.id,
    p_title: "Design Instagram Feed Carousel",
    p_task_type: "GRAPHIC_DESIGN",
    p_priority: "HIGH",
    p_deadline: taskDeadlineStr,
    p_notes: "Follow brand guidelines",
    p_content_plan_id: planA.id,
    p_script_id: scriptA.id,
    p_assignee_id: designerAuth.user.id,
  });

  const task1Id = (resTask1 as { task_id: string })?.task_id;
  assert(!!task1Id && !t1Err, "Permissions", "SMS Owner can create production task", "task created", t1Err ? t1Err.message : `task id: ${task1Id}`);

  // Test 2.2: Admin can create production task
  const { data: resTask2, error: t2Err } = await adminAuth.client.rpc("create_production_task", {
    p_project_id: projectA.id,
    p_title: "Video Reel Editing",
    p_task_type: "VIDEO_EDITING",
    p_priority: "MEDIUM",
    p_deadline: taskDeadlineStr,
    p_notes: "Add audio track",
    p_content_plan_id: planA.id,
    p_script_id: scriptA.id,
    p_assignee_id: editorAuth.user.id,
  });

  const task2Id = (resTask2 as { task_id: string })?.task_id;
  assert(!!task2Id && !t2Err, "Permissions", "Admin can create production task", "task created", t2Err ? t2Err.message : `task id: ${task2Id}`);

  // Test 2.3: Non-owner SMS cannot create task on Project A
  const { error: t3Err } = await sms2Auth.client.rpc("create_production_task", {
    p_project_id: projectA.id,
    p_title: "Unauthorized Task by SMS2",
    p_task_type: "GRAPHIC_DESIGN",
    p_priority: "LOW",
    p_deadline: taskDeadlineStr,
    p_assignee_id: designerAuth.user.id,
  });

  assert(!!t3Err, "Permissions", "Non-owner SMS blocked from creating task", "error raised", t3Err ? t3Err.message : "no error");

  // Test 2.4: Creative roles (Graphic Designer, Video Editor) cannot create tasks
  const { error: t4Err } = await designerAuth.client.rpc("create_production_task", {
    p_project_id: projectA.id,
    p_title: "Unauthorized Task by Designer",
    p_task_type: "GRAPHIC_DESIGN",
    p_priority: "LOW",
    p_deadline: taskDeadlineStr,
    p_assignee_id: designerAuth.user.id,
  });

  assert(!!t4Err, "Permissions", "Graphic Designer blocked from creating task", "error raised", t4Err ? t4Err.message : "no error");

  const { error: t5Err } = await editorAuth.client.rpc("create_production_task", {
    p_project_id: projectA.id,
    p_title: "Unauthorized Task by Editor",
    p_task_type: "VIDEO_EDITING",
    p_priority: "LOW",
    p_deadline: taskDeadlineStr,
    p_assignee_id: editorAuth.user.id,
  });

  assert(!!t5Err, "Permissions", "Video Editor blocked from creating task", "error raised", t5Err ? t5Err.message : "no error");

  // Test 2.5: CD and AE cannot create tasks
  const { error: t6Err } = await cdAuth.client.rpc("create_production_task", {
    p_project_id: projectA.id,
    p_title: "Unauthorized Task by CD",
    p_task_type: "GRAPHIC_DESIGN",
    p_priority: "LOW",
    p_deadline: taskDeadlineStr,
    p_assignee_id: designerAuth.user.id,
  });

  assert(!!t6Err, "Permissions", "CD blocked from creating task", "error raised", t6Err ? t6Err.message : "no error");

  const { error: t7Err } = await aeAuth.client.rpc("create_production_task", {
    p_project_id: projectA.id,
    p_title: "Unauthorized Task by AE",
    p_task_type: "GRAPHIC_DESIGN",
    p_priority: "LOW",
    p_deadline: taskDeadlineStr,
    p_assignee_id: designerAuth.user.id,
  });

  assert(!!t7Err, "Permissions", "AE blocked from creating task", "error raised", t7Err ? t7Err.message : "no error");

  // =========================================================================
  // Section 3: Task Deadline Constraint
  // =========================================================================
  console.log("\n--- Section 3: Task Deadline Constraint ---");

  const excessiveDeadline = new Date(futureEnd);
  excessiveDeadline.setDate(excessiveDeadline.getDate() + 5);

  const { error: dlErr } = await smsAuth.client.rpc("create_production_task", {
    p_project_id: projectA.id,
    p_title: "Task with Exceeded Deadline",
    p_task_type: "GRAPHIC_DESIGN",
    p_priority: "LOW",
    p_deadline: excessiveDeadline.toISOString(),
  });

  assert(!!dlErr, "Deadlines", "Task deadline exceeding project deadline is blocked", "error raised", dlErr ? dlErr.message : "no error");

  // =========================================================================
  // Section 4: Cross-Project Reference Boundary
  // =========================================================================
  console.log("\n--- Section 4: Cross-Project Reference Boundary ---");

  // Attempt linking Project B's content plan into Project A task
  const { error: crossCpErr } = await smsAuth.client.rpc("create_production_task", {
    p_project_id: projectA.id,
    p_title: "Cross Project Content Plan Task",
    p_task_type: "GRAPHIC_DESIGN",
    p_priority: "LOW",
    p_deadline: taskDeadlineStr,
    p_content_plan_id: planB.id,
  });

  assert(!!crossCpErr, "Cross-Boundary", "Foreign content plan linkage is blocked", "error raised", crossCpErr ? crossCpErr.message : "no error");

  // Attempt linking Project B's script into Project A task
  const { error: crossScErr } = await smsAuth.client.rpc("create_production_task", {
    p_project_id: projectA.id,
    p_title: "Cross Project Script Task",
    p_task_type: "VIDEO_EDITING",
    p_priority: "LOW",
    p_deadline: taskDeadlineStr,
    p_script_id: scriptB.id,
  });

  assert(!!crossScErr, "Cross-Boundary", "Foreign script linkage is blocked", "error raised", crossScErr ? crossScErr.message : "no error");

  // =========================================================================
  // Section 5: Database Trigger Invariant: requires_qc (All 6 Enum Values)
  // =========================================================================
  console.log("\n--- Section 5: Database Trigger Invariant: requires_qc (All 6 Enum Values) ---");

  // Verify task1 (GRAPHIC_DESIGN) has requires_qc = true
  const { data: t1Row } = await adminClient
    .from("tasks")
    .select("requires_qc, task_type")
    .eq("id", task1Id)
    .single();

  assert(t1Row?.requires_qc === true, "QC Invariant", "GRAPHIC_DESIGN automatically enforces requires_qc = true", "requires_qc = true", `requires_qc = ${t1Row?.requires_qc}`);

  // Verify task2 (VIDEO_EDITING) has requires_qc = true
  const { data: t2Row } = await adminClient
    .from("tasks")
    .select("requires_qc, task_type")
    .eq("id", task2Id)
    .single();

  assert(t2Row?.requires_qc === true, "QC Invariant", "VIDEO_EDITING automatically enforces requires_qc = true", "requires_qc = true", `requires_qc = ${t2Row?.requires_qc}`);

  // Direct insert test overriding requires_qc for all 6 enum values
  const enumTests: Array<{
    type: "GRAPHIC_DESIGN" | "VIDEO_EDITING" | "CONTENT_PLAN" | "SCRIPT" | "PUBLISHING" | "OTHER";
    passedQC: boolean;
    expectedQC: boolean;
  }> = [
    { type: "GRAPHIC_DESIGN", passedQC: false, expectedQC: true },
    { type: "VIDEO_EDITING", passedQC: false, expectedQC: true },
    { type: "CONTENT_PLAN", passedQC: true, expectedQC: false },
    { type: "SCRIPT", passedQC: true, expectedQC: false },
    { type: "PUBLISHING", passedQC: true, expectedQC: false },
    { type: "OTHER", passedQC: true, expectedQC: false },
  ];

  for (const item of enumTests) {
    const { data: testRow } = await adminClient
      .from("tasks")
      .insert({
        project_id: projectA.id,
        title: `QC Test ${item.type}`,
        task_type: item.type,
        priority: "LOW",
        deadline: taskDeadlineStr,
        status: "TODO",
        requires_qc: item.passedQC,
      })
      .select("id, requires_qc, task_type")
      .single();

    assert(
      testRow?.requires_qc === item.expectedQC,
      "QC Invariant",
      `Trigger enforces requires_qc=${item.expectedQC} for ${item.type} (even when passed ${item.passedQC})`,
      `requires_qc = ${item.expectedQC}`,
      `requires_qc = ${testRow?.requires_qc}`
    );

    if (testRow?.id) {
      await adminClient.from("tasks").delete().eq("id", testRow.id);
    }
  }

  // Create an OTHER task with requires_qc = false
  const { data: resTask3 } = await smsAuth.client.rpc("create_production_task", {
    p_project_id: projectA.id,
    p_title: "Other Administrative Preparation",
    p_task_type: "OTHER",
    p_priority: "LOW",
    p_deadline: taskDeadlineStr,
  });

  const task3Id = (resTask3 as { task_id: string })?.task_id;
  const { data: t3Row } = await adminClient
    .from("tasks")
    .select("requires_qc, task_type")
    .eq("id", task3Id)
    .single();

  assert(t3Row?.requires_qc === false, "QC Invariant", "OTHER task enforces requires_qc = false", "requires_qc = false", `requires_qc = ${t3Row?.requires_qc}`);

  // Test updating task_type from OTHER to GRAPHIC_DESIGN updates requires_qc to true
  const { error: upTypeErr } = await smsAuth.client.rpc("update_task_metadata", {
    p_task_id: task3Id,
    p_title: "Other Converted to Graphic Design",
    p_priority: "LOW",
    p_deadline: taskDeadlineStr,
    p_task_type: "GRAPHIC_DESIGN",
  });

  const { data: t3UpdatedQC } = await adminClient
    .from("tasks")
    .select("requires_qc, task_type")
    .eq("id", task3Id)
    .single();

  assert(!upTypeErr && t3UpdatedQC?.requires_qc === true, "QC Invariant", "Updating task_type to GRAPHIC_DESIGN dynamically sets requires_qc = true", "requires_qc = true", `requires_qc = ${t3UpdatedQC?.requires_qc}`);

  // Revert task3 back to OTHER
  await smsAuth.client.rpc("update_task_metadata", {
    p_task_id: task3Id,
    p_title: "Other Administrative Preparation",
    p_priority: "LOW",
    p_deadline: taskDeadlineStr,
    p_task_type: "OTHER",
  });

  // =========================================================================
  // Section 6: Atomic Reassignment & Single Active PIC
  // =========================================================================
  console.log("\n--- Section 6: Atomic Reassignment & Single Active PIC ---");

  // Verify initial assignment of task1 to Designer
  const { data: initAssigns } = await adminClient
    .from("task_assignments")
    .select("*")
    .eq("task_id", task1Id)
    .is("ended_at", null);

  assert(initAssigns?.length === 1 && initAssigns[0]?.assignee_id === designerAuth.user.id, "Assignment", "Initial active assignment exists for Designer", "1 active assignment for Designer", `${initAssigns?.length} active`);

  // Verify Designer was added to project_members
  const { data: memberDesigner } = await adminClient
    .from("project_members")
    .select("*")
    .eq("project_id", projectA.id)
    .eq("user_id", designerAuth.user.id);

  assert(!!(memberDesigner && memberDesigner.length > 0), "Membership", "Designer automatically guaranteed in project_members", "member exists", `count: ${memberDesigner?.length}`);

  // Direct violation test: partial unique index idx_task_assignments_one_active
  const { error: dupActiveErr } = await adminClient
    .from("task_assignments")
    .insert({
      task_id: task1Id,
      assignee_id: editorAuth.user.id,
      assigned_by: adminAuth.user.id,
      assigned_at: new Date().toISOString(),
      ended_at: null,
    });

  assert(!!dupActiveErr, "Single PIC", "Duplicate active assignment rejected by unique partial index", "unique constraint violation", dupActiveErr ? dupActiveErr.code || dupActiveErr.message : "no error");

  // Test unauthorized roles cannot reassign task
  const { error: designerReassignErr } = await designerAuth.client.rpc("reassign_task", {
    p_task_id: task1Id,
    p_new_assignee_id: editorAuth.user.id,
  });
  assert(!!designerReassignErr, "Reassignment Boundary", "Designer blocked from reassigning task", "error raised", designerReassignErr ? designerReassignErr.message : "no error");

  const { error: editorReassignErr } = await editorAuth.client.rpc("reassign_task", {
    p_task_id: task1Id,
    p_new_assignee_id: designerAuth.user.id,
  });
  assert(!!editorReassignErr, "Reassignment Boundary", "Editor blocked from reassigning task", "error raised", editorReassignErr ? editorReassignErr.message : "no error");

  const { error: aeReassignErr } = await aeAuth.client.rpc("reassign_task", {
    p_task_id: task1Id,
    p_new_assignee_id: editorAuth.user.id,
  });
  assert(!!aeReassignErr, "Reassignment Boundary", "AE blocked from reassigning task", "error raised", aeReassignErr ? aeReassignErr.message : "no error");

  const { error: cdReassignErr } = await cdAuth.client.rpc("reassign_task", {
    p_task_id: task1Id,
    p_new_assignee_id: editorAuth.user.id,
  });
  assert(!!cdReassignErr, "Reassignment Boundary", "CD blocked from reassigning task", "error raised", cdReassignErr ? cdReassignErr.message : "no error");

  const { error: sms2ReassignErr } = await sms2Auth.client.rpc("reassign_task", {
    p_task_id: task1Id,
    p_new_assignee_id: editorAuth.user.id,
  });
  assert(!!sms2ReassignErr, "Reassignment Boundary", "Non-owner SMS blocked from reassigning task", "error raised", sms2ReassignErr ? sms2ReassignErr.message : "no error");

  // Atomic reassignment via reassign_task RPC from Designer to Editor by SMS owner
  const { error: reassignErr } = await smsAuth.client.rpc("reassign_task", {
    p_task_id: task1Id,
    p_new_assignee_id: editorAuth.user.id,
  });

  assert(!reassignErr, "Reassignment", "SMS owner reassigns task to Editor", "reassignment succeeds", reassignErr ? reassignErr.message : "success");

  // Verify previous assignment ended and new active assignment exists
  const { data: allAssignments } = await adminClient
    .from("task_assignments")
    .select("*")
    .eq("task_id", task1Id)
    .order("assigned_at", { ascending: true });

  const prevAssignment = allAssignments?.find((a) => a.assignee_id === designerAuth.user.id);
  const newAssignment = allAssignments?.find((a) => a.assignee_id === editorAuth.user.id);

  assert(prevAssignment?.ended_at !== null, "Reassignment", "Previous assignment ended_at is set", "ended_at not null", `ended_at: ${prevAssignment?.ended_at}`);
  assert(newAssignment?.ended_at === null, "Reassignment", "New assignment ended_at is null (active)", "ended_at null", `ended_at: ${newAssignment?.ended_at}`);

  // Verify tasks.current_assignee_id updated
  const { data: t1Updated } = await adminClient
    .from("tasks")
    .select("current_assignee_id")
    .eq("id", task1Id)
    .single();

  assert(t1Updated?.current_assignee_id === editorAuth.user.id, "Reassignment", "tasks.current_assignee_id points to Editor", "Editor user id", t1Updated?.current_assignee_id || "null");

  // Reassign task1 back to Designer for subsequent tests
  await smsAuth.client.rpc("reassign_task", {
    p_task_id: task1Id,
    p_new_assignee_id: designerAuth.user.id,
  });

  // Test: cannot reassign COMPLETED task
  // Temporarily set a completed task to verify guard
  const { data: compTask } = await adminClient
    .from("tasks")
    .insert({
      project_id: projectA.id,
      title: "Completed Task For Reassign Guard",
      task_type: "GRAPHIC_DESIGN",
      priority: "LOW",
      deadline: taskDeadlineStr,
      status: "COMPLETED",
      current_assignee_id: designerAuth.user.id,
    })
    .select("id")
    .single();

  const { error: reassignCompletedErr } = await smsAuth.client.rpc("reassign_task", {
    p_task_id: compTask?.id,
    p_new_assignee_id: editorAuth.user.id,
  });

  assert(!!reassignCompletedErr, "Reassignment Boundary", "Reassigning COMPLETED task is strictly blocked", "error raised", reassignCompletedErr ? reassignCompletedErr.message : "no error");

  if (compTask?.id) {
    await adminClient.from("tasks").delete().eq("id", compTask.id);
  }

  // =========================================================================
  // Section 7: Strict Task Status State Machine Audit
  // =========================================================================
  console.log("\n--- Section 7: Strict Task Status State Machine Audit ---");

  // Create a clean task in TODO status assigned to Designer
  const { data: resTaskState } = await smsAuth.client.rpc("create_production_task", {
    p_project_id: projectA.id,
    p_title: "State Machine Strict Test Task",
    p_task_type: "GRAPHIC_DESIGN",
    p_priority: "HIGH",
    p_deadline: taskDeadlineStr,
    p_assignee_id: designerAuth.user.id,
  });
  const stateTaskId = (resTaskState as { task_id: string })?.task_id;

  // Verify that in TODO status, jumping to APPROVED, COMPLETED, or REVISION_REQUESTED FAILS for ALL roles
  const rolesInTodo = [
    { label: "Admin", client: adminAuth.client },
    { label: "SMS Owner", client: smsAuth.client },
    { label: "Assigned Designer", client: designerAuth.client },
    { label: "Non-assigned Editor", client: editorAuth.client },
  ];

  for (const r of rolesInTodo) {
    const { error: errApp } = await r.client.rpc("transition_task_status", {
      p_task_id: stateTaskId,
      p_new_status: "APPROVED",
    });
    assert(!!errApp, "State Machine", `${r.label} blocked from TODO -> APPROVED`, "error raised", errApp ? errApp.message : "no error");

    const { error: errComp } = await r.client.rpc("transition_task_status", {
      p_task_id: stateTaskId,
      p_new_status: "COMPLETED",
    });
    assert(!!errComp, "State Machine", `${r.label} blocked from TODO -> COMPLETED`, "error raised", errComp ? errComp.message : "no error");

    const { error: errRevReq } = await r.client.rpc("transition_task_status", {
      p_task_id: stateTaskId,
      p_new_status: "REVISION_REQUESTED",
    });
    assert(!!errRevReq, "State Machine", `${r.label} blocked from TODO -> REVISION_REQUESTED`, "error raised", errRevReq ? errRevReq.message : "no error");
  }

  // Non-assigned user cannot start task
  const { error: nonAssigneeErr } = await editorAuth.client.rpc("transition_task_status", {
    p_task_id: stateTaskId,
    p_new_status: "IN_PROGRESS",
  });
  assert(!!nonAssigneeErr, "State Machine", "Non-assignee creative blocked from TODO -> IN_PROGRESS", "error raised", nonAssigneeErr ? nonAssigneeErr.message : "no error");

  // Assigned creative transitions TODO -> IN_PROGRESS (allowed)
  const { error: startTaskErr } = await designerAuth.client.rpc("transition_task_status", {
    p_task_id: stateTaskId,
    p_new_status: "IN_PROGRESS",
  });
  assert(!startTaskErr, "State Machine", "Assigned Designer starts task (TODO -> IN_PROGRESS)", "success", startTaskErr ? startTaskErr.message : "status updated");

  // Verify status is now IN_PROGRESS
  const { data: stRow } = await adminClient
    .from("tasks")
    .select("status")
    .eq("id", stateTaskId)
    .single();
  assert(stRow?.status === "IN_PROGRESS", "State Machine", "Task status is verified IN_PROGRESS", "IN_PROGRESS", stRow?.status || "null");

  // In IN_PROGRESS status, test all roles attempting illegal transitions
  for (const r of rolesInTodo) {
    const { error: errApp } = await r.client.rpc("transition_task_status", {
      p_task_id: stateTaskId,
      p_new_status: "APPROVED",
    });
    assert(!!errApp, "State Machine", `${r.label} blocked from IN_PROGRESS -> APPROVED`, "error raised", errApp ? errApp.message : "no error");

    const { error: errComp } = await r.client.rpc("transition_task_status", {
      p_task_id: stateTaskId,
      p_new_status: "COMPLETED",
    });
    assert(!!errComp, "State Machine", `${r.label} blocked from IN_PROGRESS -> COMPLETED`, "error raised", errComp ? errComp.message : "no error");

    const { error: errRevReq } = await r.client.rpc("transition_task_status", {
      p_task_id: stateTaskId,
      p_new_status: "REVISION_REQUESTED",
    });
    assert(!!errRevReq, "State Machine", `${r.label} blocked from IN_PROGRESS -> REVISION_REQUESTED`, "error raised", errRevReq ? errRevReq.message : "no error");

    const { error: errReviewNoFile } = await r.client.rpc("transition_task_status", {
      p_task_id: stateTaskId,
      p_new_status: "IN_REVIEW",
    });
    assert(!!errReviewNoFile, "State Machine", `${r.label} blocked from IN_PROGRESS -> IN_REVIEW without deliverable file`, "error raised", errReviewNoFile ? errReviewNoFile.message : "no error");
  }

  // Clean up state machine test task
  await adminClient.from("task_assignments").delete().eq("task_id", stateTaskId);
  await adminClient.from("tasks").delete().eq("id", stateTaskId);

  // Also transition task1 to IN_PROGRESS so it is ready
  await designerAuth.client.rpc("transition_task_status", {
    p_task_id: task1Id,
    p_new_status: "IN_PROGRESS",
  });

  // =========================================================================
  // Section 8: Metadata Mutation Guards & Task Type Locking
  // =========================================================================
  console.log("\n--- Section 8: Metadata Mutation Guards & Task Type Locking ---");

  // Test 8.1: Creative role cannot update task metadata
  const { error: designerMetaErr } = await designerAuth.client.rpc("update_task_metadata", {
    p_task_id: task1Id,
    p_title: "Tampered by Designer",
    p_priority: "LOW",
    p_deadline: taskDeadlineStr,
  });

  assert(!!designerMetaErr, "Metadata Guards", "Creative role blocked from updating task metadata", "error raised", designerMetaErr ? designerMetaErr.message : "no error");

  // Test 8.2: Database trigger locks task_type once work has started (status != TODO)
  const { error: lockTypeErr } = await smsAuth.client.rpc("update_task_metadata", {
    p_task_id: task1Id,
    p_title: "Valid Title Update",
    p_task_type: "VIDEO_EDITING", // Task is IN_PROGRESS, so changing type must fail!
    p_priority: "HIGH",
    p_deadline: taskDeadlineStr,
  });

  assert(!!lockTypeErr, "Metadata Guards", "Mutating task_type on IN_PROGRESS task is blocked", "error raised", lockTypeErr ? lockTypeErr.message : "no error");

  // Test 8.3: SMS owner can update title, notes, and priority without changing task_type
  const { error: safeMetaErr } = await smsAuth.client.rpc("update_task_metadata", {
    p_task_id: task1Id,
    p_title: "Design Instagram Feed Carousel Updated",
    p_priority: "URGENT",
    p_deadline: taskDeadlineStr,
    p_notes: "Updated creative guidelines",
  });

  assert(!safeMetaErr, "Metadata Guards", "SMS owner successfully updates allowed metadata", "success", safeMetaErr ? safeMetaErr.message : "updated");

  // =========================================================================
  // Section 9: Single-Source Status History & Controlled Production Transition
  // =========================================================================
  console.log("\n--- Section 9: Single-Source Status History & Controlled Production Transition ---");

  // Create Project C in SCRIPT_READY without tasks
  const { data: resC } = await smsAuth.client.rpc("create_project", {
    p_brand_id: brand.id,
    p_name: `Phase 7 Verification Project Gamma ${Date.now()}`,
    p_description: "Testing start_production Preconditions",
    p_priority: "MEDIUM",
    p_start_date: futureStart.toISOString().slice(0, 10),
    p_deadline: futureEnd.toISOString(),
    p_sms_owner_id: smsAuth.user.id,
  });

  const projectC = { id: (resC as { id: string })?.id };

  await adminClient.from("briefs").insert({
    project_id: projectC.id,
    objective: "Obj",
    target_audience: "Aud",
    key_message: "Msg",
    deliverables_summary: "Deliverables for C",
    created_by: smsAuth.user.id,
  });

  await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projectC.id,
    p_target_phase: "CONTENT_PLANNING",
  });

  const { data: planC } = await adminClient
    .from("content_plans")
    .insert({
      project_id: projectC.id,
      title: "Plan C",
      channel: "INSTAGRAM",
      planned_post_date: futureEnd.toISOString().slice(0, 10),
      status: "APPROVED",
      pillar: "ENTERTAINMENT",
      created_by: smsAuth.user.id,
    })
    .select()
    .single();

  await adminClient.from("scripts").insert({
    project_id: projectC.id,
    content_plan_id: planC.id,
    title: "Script C",
    hook: "Hook",
    body: "Body",
    visual_cues: "Visual cues for C",
    call_to_action: "CTA",
    status: "READY",
    created_by: smsAuth.user.id,
  });

  await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projectC.id,
    p_target_phase: "SCRIPT_READY",
  });

  // Test 9.1: Cannot start production with 0 production tasks
  const { error: prodZeroTasksErr } = await smsAuth.client.rpc("start_production", {
    p_project_id: projectC.id,
  });

  assert(!!prodZeroTasksErr, "Production Entry", "start_production blocked with 0 production tasks", "error raised", prodZeroTasksErr ? prodZeroTasksErr.message : "no error");

  // Add an unassigned production task to Project C
  const { data: unassignedTaskC } = await adminClient
    .from("tasks")
    .insert({
      project_id: projectC.id,
      title: "Unassigned Production Task",
      task_type: "GRAPHIC_DESIGN",
      priority: "MEDIUM",
      deadline: taskDeadlineStr,
      status: "TODO",
      requires_qc: true,
    })
    .select("id")
    .single();

  // Test 9.2: Cannot start production with unassigned production task
  const { error: prodUnassignedErr } = await smsAuth.client.rpc("start_production", {
    p_project_id: projectC.id,
  });

  assert(!!prodUnassignedErr, "Production Entry", "start_production blocked with unassigned task", "error raised", prodUnassignedErr ? prodUnassignedErr.message : "no error");

  // Clean up unassigned task in Project C
  if (unassignedTaskC?.id) {
    await adminClient.from("tasks").delete().eq("id", unassignedTaskC.id);
  }

  // Test 9.3: Cannot start production with inactive assignee
  await adminClient.from("profiles").update({ is_active: false }).eq("id", editorAuth.user.id);

  const { data: inactiveTaskC } = await adminClient
    .from("tasks")
    .insert({
      project_id: projectC.id,
      title: "Task with Inactive Assignee",
      task_type: "GRAPHIC_DESIGN",
      priority: "MEDIUM",
      deadline: taskDeadlineStr,
      status: "TODO",
      requires_qc: true,
      current_assignee_id: editorAuth.user.id,
    })
    .select("id")
    .single();

  if (inactiveTaskC?.id) {
    await adminClient.from("task_assignments").insert({
      task_id: inactiveTaskC.id,
      assignee_id: editorAuth.user.id,
      assigned_by: adminAuth.user.id,
    });
  }

  const { error: prodInactiveErr } = await smsAuth.client.rpc("start_production", {
    p_project_id: projectC.id,
  });

  assert(!!prodInactiveErr, "Production Entry", "start_production blocked with inactive assignee", "error raised", prodInactiveErr ? prodInactiveErr.message : "no error");

  // Restore Editor and clean up inactive task
  if (inactiveTaskC?.id) {
    await adminClient.from("task_assignments").delete().eq("task_id", inactiveTaskC.id);
    await adminClient.from("tasks").delete().eq("id", inactiveTaskC.id);
  }
  await adminClient.from("profiles").update({ is_active: true }).eq("id", editorAuth.user.id);

  // Count existing status history on Project A prior to start_production
  const { data: preHistory } = await adminClient
    .from("project_status_history")
    .select("*")
    .eq("project_id", projectA.id);

  const preHistoryCount = preHistory?.length || 0;

  // Test 9.4: Valid Project A starts production successfully
  // Project A has task1 (Designer, assigned) and task2 (Editor, assigned)
  const { error: prodStartErr } = await smsAuth.client.rpc("start_production", {
    p_project_id: projectA.id,
  });

  assert(!prodStartErr, "Production Entry", "start_production succeeds with valid assigned tasks", "success", prodStartErr ? prodStartErr.message : "transitioned to PRODUCTION");

  // Verify Project A status is PRODUCTION
  const { data: projARow } = await adminClient
    .from("projects")
    .select("status")
    .eq("id", projectA.id)
    .single();

  assert(projARow?.status === "PRODUCTION", "Production Entry", "Project A phase is now PRODUCTION", "PRODUCTION", projARow?.status || "null");

  // Single-Source Status History: exactly ONE new row added to project_status_history
  const { data: postHistory } = await adminClient
    .from("project_status_history")
    .select("*")
    .eq("project_id", projectA.id)
    .order("created_at", { ascending: false });

  const addedHistory = (postHistory?.length || 0) - preHistoryCount;
  assert(addedHistory === 1, "Status History Single-Source", "Exactly ONE new row appended to project_status_history", "1 row added", `${addedHistory} rows added`);

  const latestHistory = postHistory?.[0];
  assert(
    latestHistory?.from_status === "SCRIPT_READY" &&
    latestHistory?.to_status === "PRODUCTION" &&
    latestHistory?.changed_by === smsAuth.user.id,
    "Status History Single-Source",
    "History row matches transition: SCRIPT_READY -> PRODUCTION by caller",
    "from SCRIPT_READY to PRODUCTION by caller",
    `from: ${latestHistory?.from_status} to: ${latestHistory?.to_status} by: ${latestHistory?.changed_by}`
  );

  // Verify PRODUCTION_STARTED activity log (exactly one row)
  const { data: actRow } = await adminClient
    .from("activity_logs")
    .select("*")
    .eq("project_id", projectA.id)
    .eq("event_type", "PRODUCTION_STARTED");

  assert(actRow?.length === 1, "Production Entry", "PRODUCTION_STARTED activity log recorded exactly once", "1 row", `${actRow?.length} rows`);

  // =========================================================================
  // Section 10: T-004 Content Lock Verification
  // =========================================================================
  console.log("\n--- Section 10: T-004 Content Lock Verification ---");

  // While in PRODUCTION, normal updates to brief, content_plans, scripts must be blocked
  const { error: briefLockErr } = await smsAuth.client
    .from("briefs")
    .update({ objective: "Tampered Objective in Production" })
    .eq("id", briefA.id);

  assert(!!briefLockErr, "Content Lock", "Brief update blocked in PRODUCTION phase", "error raised", briefLockErr ? briefLockErr.message : "no error");

  const { error: planLockErr } = await smsAuth.client
    .from("content_plans")
    .update({ title: "Tampered Content Plan in Production" })
    .eq("id", planA.id);

  assert(!!planLockErr, "Content Lock", "Content plan update blocked in PRODUCTION phase", "error raised", planLockErr ? planLockErr.message : "no error");

  const { error: scriptLockErr } = await smsAuth.client
    .from("scripts")
    .update({ hook: "Tampered Hook in Production" })
    .eq("id", scriptA.id);

  assert(!!scriptLockErr, "Content Lock", "Script update blocked in PRODUCTION phase", "error raised", scriptLockErr ? scriptLockErr.message : "no error");

  // =========================================================================
  // Section 11: Task Archival Consistency & Operations on Archived Tasks
  // =========================================================================
  console.log("\n--- Section 11: Task Archival Consistency & Operations on Archived Tasks ---");

  // Create an assigned task to archive
  const { data: resTaskToArchive } = await smsAuth.client.rpc("create_production_task", {
    p_project_id: projectA.id,
    p_title: "Task Destined for Archival",
    p_task_type: "GRAPHIC_DESIGN",
    p_priority: "LOW",
    p_deadline: taskDeadlineStr,
    p_assignee_id: designerAuth.user.id,
  });
  const archiveTaskId = (resTaskToArchive as { task_id: string })?.task_id;

  // Verify initial assignment
  const { data: preArchiveAssign } = await adminClient
    .from("task_assignments")
    .select("*")
    .eq("task_id", archiveTaskId)
    .is("ended_at", null);
  assert(preArchiveAssign?.length === 1, "Archival Consistency", "Active assignment exists before archive", "1 assignment", `${preArchiveAssign?.length}`);

  // Test 11.1: Creative role cannot archive task
  const { error: creativeArchiveErr } = await designerAuth.client.rpc("archive_task", {
    p_task_id: archiveTaskId,
  });
  assert(!!creativeArchiveErr, "Archival Consistency", "Creative role blocked from archiving task", "error raised", creativeArchiveErr ? creativeArchiveErr.message : "no error");

  // Test 11.2: SMS owner archives task
  const { error: smsArchiveErr } = await smsAuth.client.rpc("archive_task", {
    p_task_id: archiveTaskId,
  });
  assert(!smsArchiveErr, "Archival Consistency", "SMS owner archives task successfully", "success", smsArchiveErr ? smsArchiveErr.message : "archived");

  // Verify tasks.deleted_at is set AND current_assignee_id is cleared to NULL
  const { data: archivedTaskRow } = await adminClient
    .from("tasks")
    .select("deleted_at, current_assignee_id")
    .eq("id", archiveTaskId)
    .single();

  assert(archivedTaskRow?.deleted_at !== null, "Archival Consistency", "Task deleted_at timestamp is populated", "deleted_at not null", `deleted_at: ${archivedTaskRow?.deleted_at}`);
  assert(archivedTaskRow?.current_assignee_id === null, "Archival Consistency", "Task current_assignee_id is cleared to NULL", "null", `${archivedTaskRow?.current_assignee_id}`);

  // Verify task_assignments ended_at is set and record NOT deleted
  const { data: postArchiveAssign } = await adminClient
    .from("task_assignments")
    .select("*")
    .eq("task_id", archiveTaskId);

  assert(postArchiveAssign?.length === 1, "Archival Consistency", "Assignment record preserved in database", "1 record preserved", `${postArchiveAssign?.length}`);
  assert(postArchiveAssign?.[0]?.ended_at !== null, "Archival Consistency", "Assignment ended_at timestamp is populated", "ended_at not null", `ended_at: ${postArchiveAssign?.[0]?.ended_at}`);

  // Verify task disappears from active queries (deleted_at IS NULL filter)
  const { data: activeTasksQuery } = await adminClient
    .from("tasks")
    .select("id")
    .eq("id", archiveTaskId)
    .is("deleted_at", null);

  assert(activeTasksQuery?.length === 0, "Archival Consistency", "Archived task disappears from active query", "0 active tasks found", `${activeTasksQuery?.length} found`);

  // Test operations on archived task MUST FAIL
  const { error: reassignArchivedErr } = await smsAuth.client.rpc("reassign_task", {
    p_task_id: archiveTaskId,
    p_new_assignee_id: editorAuth.user.id,
  });
  assert(!!reassignArchivedErr, "Archived Operations", "reassign_task on archived task is blocked", "error raised", reassignArchivedErr ? reassignArchivedErr.message : "no error");

  const { error: transitionArchivedErr } = await smsAuth.client.rpc("transition_task_status", {
    p_task_id: archiveTaskId,
    p_new_status: "IN_PROGRESS",
  });
  assert(!!transitionArchivedErr, "Archived Operations", "transition_task_status on archived task is blocked", "error raised", transitionArchivedErr ? transitionArchivedErr.message : "no error");

  const { error: updateMetaArchivedErr } = await smsAuth.client.rpc("update_task_metadata", {
    p_task_id: archiveTaskId,
    p_title: "Attempting to update archived task",
    p_priority: "LOW",
    p_deadline: taskDeadlineStr,
  });
  assert(!!updateMetaArchivedErr, "Archived Operations", "update_task_metadata on archived task is blocked", "error raised", updateMetaArchivedErr ? updateMetaArchivedErr.message : "no error");

  // =========================================================================
  // Section 12: Archived Task Production Gate
  // =========================================================================
  console.log("\n--- Section 12: Archived Task Production Gate ---");

  // Project D: 1 active assigned task + 1 archived task -> start_production MUST SUCCEED
  const { data: resD } = await smsAuth.client.rpc("create_project", {
    p_brand_id: brand.id,
    p_name: `Phase 7.1 Verification Project Delta ${Date.now()}`,
    p_description: "Testing start_production with active + archived tasks",
    p_priority: "MEDIUM",
    p_start_date: futureStart.toISOString().slice(0, 10),
    p_deadline: futureEnd.toISOString(),
    p_sms_owner_id: smsAuth.user.id,
  });
  const projectD = { id: (resD as { id: string })?.id };

  await adminClient.from("briefs").insert({
    project_id: projectD.id,
    objective: "Obj D",
    target_audience: "Aud D",
    key_message: "Msg D",
    deliverables_summary: "Summary D",
    created_by: smsAuth.user.id,
  });
  await smsAuth.client.rpc("transition_project_phase", { p_project_id: projectD.id, p_target_phase: "CONTENT_PLANNING" });
  const { data: planD } = await adminClient.from("content_plans").insert({
    project_id: projectD.id, title: "Plan D", channel: "INSTAGRAM",
    planned_post_date: futureEnd.toISOString().slice(0, 10), status: "APPROVED",
    pillar: "ENTERTAINMENT", created_by: smsAuth.user.id,
  }).select().single();
  await adminClient.from("scripts").insert({
    project_id: projectD.id, content_plan_id: planD.id, title: "Script D",
    hook: "H", body: "B", visual_cues: "V", call_to_action: "C", status: "READY",
    created_by: smsAuth.user.id,
  });
  await smsAuth.client.rpc("transition_project_phase", { p_project_id: projectD.id, p_target_phase: "SCRIPT_READY" });

  // Add 1 active task assigned to Designer
  await smsAuth.client.rpc("create_production_task", {
    p_project_id: projectD.id, p_title: "Active Task D",
    p_task_type: "GRAPHIC_DESIGN", p_priority: "HIGH",
    p_deadline: taskDeadlineStr, p_assignee_id: designerAuth.user.id,
  });

  // Add 1 second task and archive it
  const { data: resTaskD2 } = await smsAuth.client.rpc("create_production_task", {
    p_project_id: projectD.id, p_title: "Task D to be Archived",
    p_task_type: "VIDEO_EDITING", p_priority: "LOW",
    p_deadline: taskDeadlineStr, p_assignee_id: editorAuth.user.id,
  });
  const taskD2Id = (resTaskD2 as { task_id: string })?.task_id;
  await smsAuth.client.rpc("archive_task", { p_task_id: taskD2Id });

  // start_production on Project D MUST SUCCEED because only active task is evaluated
  const { error: prodDErr } = await smsAuth.client.rpc("start_production", { p_project_id: projectD.id });
  assert(!prodDErr, "Archived Production Gate", "Project with 1 active task + 1 archived task starts production", "success", prodDErr ? prodDErr.message : "entered PRODUCTION");

  // Project E: 0 active tasks + 1 archived task -> start_production MUST FAIL
  const { data: resE } = await smsAuth.client.rpc("create_project", {
    p_brand_id: brand.id,
    p_name: `Phase 7.1 Verification Project Epsilon ${Date.now()}`,
    p_description: "Testing start_production with 0 active tasks + 1 archived task",
    p_priority: "LOW",
    p_start_date: futureStart.toISOString().slice(0, 10),
    p_deadline: futureEnd.toISOString(),
    p_sms_owner_id: smsAuth.user.id,
  });
  const projectE = { id: (resE as { id: string })?.id };

  await adminClient.from("briefs").insert({
    project_id: projectE.id, objective: "Obj E", target_audience: "Aud E",
    key_message: "Msg E", deliverables_summary: "Summary E", created_by: smsAuth.user.id,
  });
  await smsAuth.client.rpc("transition_project_phase", { p_project_id: projectE.id, p_target_phase: "CONTENT_PLANNING" });
  const { data: planE } = await adminClient.from("content_plans").insert({
    project_id: projectE.id, title: "Plan E", channel: "INSTAGRAM",
    planned_post_date: futureEnd.toISOString().slice(0, 10), status: "APPROVED",
    pillar: "ENTERTAINMENT", created_by: smsAuth.user.id,
  }).select().single();
  await adminClient.from("scripts").insert({
    project_id: projectE.id, content_plan_id: planE.id, title: "Script E",
    hook: "H", body: "B", visual_cues: "V", call_to_action: "C", status: "READY",
    created_by: smsAuth.user.id,
  });
  await smsAuth.client.rpc("transition_project_phase", { p_project_id: projectE.id, p_target_phase: "SCRIPT_READY" });

  // Add 1 task and archive it (leaving 0 active tasks)
  const { data: resTaskE } = await smsAuth.client.rpc("create_production_task", {
    p_project_id: projectE.id, p_title: "Task E to be Archived",
    p_task_type: "GRAPHIC_DESIGN", p_priority: "HIGH",
    p_deadline: taskDeadlineStr, p_assignee_id: designerAuth.user.id,
  });
  const taskEId = (resTaskE as { task_id: string })?.task_id;
  await smsAuth.client.rpc("archive_task", { p_task_id: taskEId });

  // start_production on Project E MUST FAIL
  const { error: prodEErr } = await smsAuth.client.rpc("start_production", { p_project_id: projectE.id });
  assert(!!prodEErr, "Archived Production Gate", "Project with 0 active tasks + 1 archived task is blocked from production", "error raised", prodEErr ? prodEErr.message : "no error");

  // =========================================================================
  // Section 13: Direct Activity Forgery Regression Tests (All Phase 7 Events)
  // =========================================================================
  console.log("\n--- Section 13: Direct Activity Forgery Regression Tests (All Phase 7 Events) ---");

  const phase7Events = [
    "TASK_CREATED",
    "TASK_UPDATED",
    "TASK_ASSIGNED",
    "TASK_REASSIGNED",
    "TASK_STARTED",
    "PRODUCTION_STARTED",
  ];

  const forgeryRoles = [
    { label: "Designer", client: designerAuth.client, userId: designerAuth.user.id },
    { label: "Editor", client: editorAuth.client, userId: editorAuth.user.id },
    { label: "AE", client: aeAuth.client, userId: aeAuth.user.id },
    { label: "CD", client: cdAuth.client, userId: cdAuth.user.id },
    { label: "Non-owner SMS", client: sms2Auth.client, userId: sms2Auth.user.id },
  ];

  for (const role of forgeryRoles) {
    for (const ev of phase7Events) {
      // 1. Direct table insert MUST FAIL via RLS
      const { error: tableErr } = await role.client
        .from("activity_logs")
        .insert({
          project_id: projectA.id,
          user_id: role.userId,
          event_type: ev,
          metadata: { forged: true },
        });

      assert(!!tableErr, "Anti-Forgery", `${role.label} direct table insert of ${ev} is blocked by RLS`, "error raised", tableErr ? tableErr.message : "no error");

      // 2. RPC log_project_activity MUST FAIL
      const { error: rpcErr } = await role.client.rpc("log_project_activity", {
        p_project_id: projectA.id,
        p_event_type: ev,
        p_metadata: { forged: true },
      });

      assert(!!rpcErr, "Anti-Forgery", `${role.label} RPC forgery of ${ev} is blocked`, "error raised", rpcErr ? rpcErr.message : "no error");
    }
  }

  // =========================================================================
  // Clean Up Test Projects
  // =========================================================================
  console.log("\n--- Cleaning up test records ---");
  const allProjectIds = [projectA.id, projectB.id, projectC.id, projectD.id, projectE.id];
  await adminClient.from("task_assignments").delete().in("task_id", [task1Id, task2Id, task3Id, archiveTaskId, taskD2Id, taskEId].filter(Boolean));
  await adminClient.from("tasks").delete().in("project_id", allProjectIds);
  await adminClient.from("scripts").delete().in("project_id", allProjectIds);
  await adminClient.from("content_plans").delete().in("project_id", allProjectIds);
  await adminClient.from("briefs").delete().in("project_id", allProjectIds);
  await adminClient.from("activity_logs").delete().in("project_id", allProjectIds);
  await adminClient.from("project_status_history").delete().in("project_id", allProjectIds);
  await adminClient.from("project_members").delete().in("project_id", allProjectIds);
  await adminClient.from("projects").delete().in("id", allProjectIds);

  console.log("\n===============================================================================");
  console.log(`Phase 7 & 7.1 Verification Complete: ${totalPassed} Passed, ${totalFailed} Failed`);
  console.log("===============================================================================");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runPhase7Verification().catch((err) => {
  console.error("Fatal error in Phase 7 verification:", err);
  process.exit(1);
});
