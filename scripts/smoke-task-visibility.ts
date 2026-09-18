/* eslint-disable @typescript-eslint/no-explicit-any */
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
  category: string;
  test: string;
  expected: string;
  actual: string;
  passed: boolean;
}

const testResults: TestResult[] = [];

function assert(condition: boolean, category: string, test: string, expected: string, actual: string) {
  testResults.push({ category, test, expected, actual, passed: condition });
  if (condition) {
    console.log(`  [PASS] [${category}] ${test} -> ${actual}`);
    totalPassed++;
  } else {
    console.error(`  [FAIL] [${category}] ${test} -> Expected: ${expected} | Actual: ${actual}`);
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

// Logic replicate from TaskStatusControl
function computeTaskStatusControlVisibility(params: {
  userRole: string;
  currentUserId: string;
  assigneeId: string | null;
  taskStatus: string;
  isProjectTerminal: boolean;
  canManage: boolean;
}) {
  const { userRole, currentUserId, assigneeId, taskStatus, isProjectTerminal, canManage } = params;
  const isAssignedCreative =
    (userRole === "GRAPHIC_DESIGNER" || userRole === "VIDEO_EDITOR") &&
    Boolean(assigneeId && assigneeId === currentUserId);
  const canStartWork =
    isAssignedCreative &&
    !isProjectTerminal &&
    (taskStatus === "TODO" || taskStatus === "REVISION_REQUESTED");

  const hasNoPic = !assigneeId;

  return {
    canStartWork,
    hasNoPic,
    showAssignPicButton: hasNoPic && canManage && !isProjectTerminal,
    showUnassignedBadge: hasNoPic && (!canManage || isProjectTerminal),
  };
}

async function main() {
  console.log("================================================================================");
  console.log("SMOKE TEST: TASK ACTION VISIBILITY & BACKEND AUTHORITY MATRIX");
  console.log("================================================================================\n");

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("1. Authenticating test personas...");
  const cdAuth = await createAuthClient("cd@locotrack.local");
  const aeAuth = await createAuthClient("ae@locotrack.local");
  const smsAuth = await createAuthClient("sms@locotrack.local");
  const designerAuth = await createAuthClient("designer@locotrack.local");
  const editorAuth = await createAuthClient("editor@locotrack.local");
  const { data: profiles } = await adminClient.from("profiles").select("id, email, role");
  const profileMap = new Map((profiles || []).map((p) => [p.email, p]));

  const smsId = profileMap.get("sms@locotrack.local")!.id;
  const cdId = profileMap.get("cd@locotrack.local")!.id;
  const designerId = profileMap.get("designer@locotrack.local")!.id;
  const editorId = profileMap.get("editor@locotrack.local")!.id;
  const adminId = profileMap.get("admin@locotrack.local")!.id;

  console.log("2. Setting up dedicated test project and tasks...");
  const ts = Date.now();
  // Create client & brand
  const { data: testClient, error: clientErr } = await adminClient
    .from("clients")
    .insert({
      name: "Smoke Test Client " + ts,
      created_by: adminId,
    })
    .select()
    .single();

  if (clientErr || !testClient) {
    throw new Error("Failed to insert test client: " + clientErr?.message);
  }

  const { data: testBrand, error: brandErr } = await adminClient
    .from("brands")
    .insert({
      client_id: testClient.id,
      name: "Smoke Brand " + ts,
      code: "SMK" + ts.toString().slice(-4),
      created_by: adminId,
    })
    .select()
    .single();

  if (brandErr || !testBrand) {
    throw new Error("Failed to insert test brand: " + brandErr?.message);
  }

  const deadline = new Date(Date.now() + 14 * 86400000).toISOString();

  // Project with SMS owner
  const { data: testProject, error: projErr } = await adminClient
    .from("projects")
    .insert({
      brand_id: testBrand.id,
      project_code: "PRJ" + ts.toString().slice(-5),
      name: "Task Visibility Smoke Test Project",
      status: "PRODUCTION",
      sms_owner_id: smsId,
      created_by: adminId,
      start_date: new Date().toISOString().slice(0, 10),
      deadline,
    })
    .select()
    .single();

  if (projErr || !testProject) {
    throw new Error("Failed to insert test project: " + projErr?.message);
  }

  // Add members
  await adminClient.from("project_members").insert([
    { project_id: testProject.id, user_id: smsId },
    { project_id: testProject.id, user_id: cdId },
    { project_id: testProject.id, user_id: designerId },
    { project_id: testProject.id, user_id: editorId },
  ]);

  // Create Task 1: Unassigned TODO task
  const { data: unassignedTask, error: unassignedTaskErr } = await adminClient
    .from("tasks")
    .insert({
      project_id: testProject.id,
      title: "Task Tanpa PIC",
      task_type: "GRAPHIC_DESIGN",
      status: "TODO",
      priority: "MEDIUM",
      deadline,
      current_assignee_id: null,
    })
    .select()
    .single();

  if (unassignedTaskErr || !unassignedTask) {
    throw new Error("Failed to create unassigned task: " + unassignedTaskErr?.message);
  }

  // Create Task 2: Designer Assigned TODO task
  const { data: designerTask, error: designerTaskErr } = await adminClient
    .from("tasks")
    .insert({
      project_id: testProject.id,
      title: "Task Assigned to Designer",
      task_type: "GRAPHIC_DESIGN",
      status: "TODO",
      priority: "HIGH",
      deadline,
      current_assignee_id: designerId,
    })
    .select()
    .single();

  if (designerTaskErr || !designerTask) {
    throw new Error("Failed to create designer task: " + designerTaskErr?.message);
  }

  // Also create task_assignment record for designerTask
  await adminClient.from("task_assignments").insert({
    task_id: designerTask.id,
    assignee_id: designerId,
    assigned_by: smsId,
  });

  console.log("\n3. Testing Frontend Visibility Matrix across roles...");

  // Scenario A: Unassigned task - SMS perspective (Owner/canManage)
  const smsUnassigned = computeTaskStatusControlVisibility({
    userRole: "SOCIAL_MEDIA_SPECIALIST",
    currentUserId: smsId,
    assigneeId: null,
    taskStatus: "TODO",
    isProjectTerminal: false,
    canManage: true,
  });
  assert(
    !smsUnassigned.canStartWork && smsUnassigned.showAssignPicButton && !smsUnassigned.showUnassignedBadge,
    "FRONTEND_VISIBILITY",
    "SMS on unassigned task: canStartWork=false, showAssignPicButton=true",
    "canStartWork=false, showAssignPicButton=true",
    `canStartWork=${smsUnassigned.canStartWork}, showAssignPicButton=${smsUnassigned.showAssignPicButton}`
  );

  // Scenario B: Unassigned task - Creative Director perspective
  const cdUnassigned = computeTaskStatusControlVisibility({
    userRole: "CREATIVE_DIRECTOR",
    currentUserId: cdId,
    assigneeId: null,
    taskStatus: "TODO",
    isProjectTerminal: false,
    canManage: false,
  });
  assert(
    !cdUnassigned.canStartWork && !cdUnassigned.showAssignPicButton && cdUnassigned.showUnassignedBadge,
    "FRONTEND_VISIBILITY",
    "CD on unassigned task: canStartWork=false, showUnassignedBadge=true",
    "canStartWork=false, showUnassignedBadge=true",
    `canStartWork=${cdUnassigned.canStartWork}, showUnassignedBadge=${cdUnassigned.showUnassignedBadge}`
  );

  // Scenario C: Assigned task - SMS perspective
  const smsAssigned = computeTaskStatusControlVisibility({
    userRole: "SOCIAL_MEDIA_SPECIALIST",
    currentUserId: smsId,
    assigneeId: designerId,
    taskStatus: "TODO",
    isProjectTerminal: false,
    canManage: true,
  });
  assert(
    !smsAssigned.canStartWork,
    "FRONTEND_VISIBILITY",
    "SMS on assigned task: canStartWork=false (Bug fixed: SMS never sees Mulai Kerjakan)",
    "false",
    String(smsAssigned.canStartWork)
  );

  // Scenario D: Assigned task - Admin perspective
  const adminAssigned = computeTaskStatusControlVisibility({
    userRole: "ADMIN",
    currentUserId: adminId,
    assigneeId: designerId,
    taskStatus: "TODO",
    isProjectTerminal: false,
    canManage: true,
  });
  assert(
    !adminAssigned.canStartWork,
    "FRONTEND_VISIBILITY",
    "ADMIN on assigned task: canStartWork=false (Admin does not start creative work)",
    "false",
    String(adminAssigned.canStartWork)
  );

  // Scenario E: Assigned task - Active Designer perspective
  const designerAssigned = computeTaskStatusControlVisibility({
    userRole: "GRAPHIC_DESIGNER",
    currentUserId: designerId,
    assigneeId: designerId,
    taskStatus: "TODO",
    isProjectTerminal: false,
    canManage: false,
  });
  assert(
    designerAssigned.canStartWork,
    "FRONTEND_VISIBILITY",
    "Assigned Designer: canStartWork=true",
    "true",
    String(designerAssigned.canStartWork)
  );

  // Scenario F: Assigned task - Non-assignee Creative (Editor) perspective
  const editorNonAssignee = computeTaskStatusControlVisibility({
    userRole: "VIDEO_EDITOR",
    currentUserId: editorId,
    assigneeId: designerId,
    taskStatus: "TODO",
    isProjectTerminal: false,
    canManage: false,
  });
  assert(
    !editorNonAssignee.canStartWork,
    "FRONTEND_VISIBILITY",
    "Non-assignee Creative (Editor): canStartWork=false",
    "false",
    String(editorNonAssignee.canStartWork)
  );

  // Scenario G: Terminal project - Assigned Designer perspective
  const designerTerminal = computeTaskStatusControlVisibility({
    userRole: "GRAPHIC_DESIGNER",
    currentUserId: designerId,
    assigneeId: designerId,
    taskStatus: "TODO",
    isProjectTerminal: true,
    canManage: false,
  });
  assert(
    !designerTerminal.canStartWork,
    "FRONTEND_VISIBILITY",
    "Assigned Designer on terminal project: canStartWork=false",
    "false",
    String(designerTerminal.canStartWork)
  );

  console.log("\n4. Testing Database RPC Backend Authority Enforcement (transition_task_status)...");

  // Backend Test 1: SMS calls transition_task_status to IN_PROGRESS on designer task -> MUST FAIL
  const { error: smsRpcError } = await smsAuth.client.rpc("transition_task_status", {
    p_task_id: designerTask.id,
    p_new_status: "IN_PROGRESS",
  });
  assert(
    smsRpcError !== null && (smsRpcError.message.includes("PIC kreatif") || smsRpcError.message.includes("assigned")),
    "BACKEND_RPC_AUTHORITY",
    "SMS calling transition_task_status -> IN_PROGRESS rejected by DB",
    "DB rejection: PIC kreatif yang ditugaskan",
    smsRpcError ? smsRpcError.message : "Unexpected Success"
  );

  // Backend Test 2: CD calls transition_task_status to IN_PROGRESS on designer task -> MUST FAIL
  const { error: cdRpcError } = await cdAuth.client.rpc("transition_task_status", {
    p_task_id: designerTask.id,
    p_new_status: "IN_PROGRESS",
  });
  assert(
    cdRpcError !== null && (cdRpcError.message.includes("PIC kreatif") || cdRpcError.message.includes("assigned")),
    "BACKEND_RPC_AUTHORITY",
    "CD calling transition_task_status -> IN_PROGRESS rejected by DB",
    "DB rejection: PIC kreatif yang ditugaskan",
    cdRpcError ? cdRpcError.message : "Unexpected Success"
  );

  // Backend Test 3: AE calls transition_task_status to IN_PROGRESS on designer task -> MUST FAIL
  const { error: aeRpcError } = await aeAuth.client.rpc("transition_task_status", {
    p_task_id: designerTask.id,
    p_new_status: "IN_PROGRESS",
  });
  assert(
    aeRpcError !== null && (aeRpcError.message.includes("PIC kreatif") || aeRpcError.message.includes("assigned")),
    "BACKEND_RPC_AUTHORITY",
    "AE calling transition_task_status -> IN_PROGRESS rejected by DB",
    "DB rejection: PIC kreatif yang ditugaskan",
    aeRpcError ? aeRpcError.message : "Unexpected Success"
  );

  // Backend Test 4: Unassigned task transition to IN_PROGRESS -> MUST FAIL for anyone
  // Case A: SMS owner attempts to start unassigned task
  const { error: unassignedSmsRpcError } = await smsAuth.client.rpc("transition_task_status", {
    p_task_id: unassignedTask.id,
    p_new_status: "IN_PROGRESS",
  });
  assert(
    unassignedSmsRpcError !== null && unassignedSmsRpcError.message.includes("Hanya PIC kreatif"),
    "BACKEND_RPC_AUTHORITY",
    "SMS starting unassigned task rejected: must have assigned creative",
    "Hanya PIC kreatif yang ditugaskan yang dapat memulai pengerjaan tugas.",
    unassignedSmsRpcError ? unassignedSmsRpcError.message : "Unexpected Success"
  );

  // Case B: Designer (not assigned) attempts to start unassigned task
  const { error: unassignedDesignerRpcError } = await designerAuth.client.rpc("transition_task_status", {
    p_task_id: unassignedTask.id,
    p_new_status: "IN_PROGRESS",
  });
  assert(
    unassignedDesignerRpcError !== null && (unassignedDesignerRpcError.message.includes("Unauthorized") || unassignedDesignerRpcError.message.includes("Hanya PIC kreatif")),
    "BACKEND_RPC_AUTHORITY",
    "Non-assignee starting unassigned task rejected by DB",
    "DB rejection: Unauthorized / not assigned",
    unassignedDesignerRpcError ? unassignedDesignerRpcError.message : "Unexpected Success"
  );

  // Backend Test 5: Different creative (Editor) calls transition on designer task -> MUST FAIL
  const { error: editorRpcError } = await editorAuth.client.rpc("transition_task_status", {
    p_task_id: designerTask.id,
    p_new_status: "IN_PROGRESS",
  });
  assert(
    editorRpcError !== null && (editorRpcError.message.includes("PIC kreatif") || editorRpcError.message.includes("assigned")),
    "BACKEND_RPC_AUTHORITY",
    "Non-assignee Creative calling transition_task_status -> IN_PROGRESS rejected by DB",
    "DB rejection: PIC kreatif yang ditugaskan",
    editorRpcError ? editorRpcError.message : "Unexpected Success"
  );

  // Backend Test 6: Assigned Designer calls transition_task_status to IN_PROGRESS -> MUST SUCCEED
  const { error: designerRpcError } = await designerAuth.client.rpc(
    "transition_task_status",
    {
      p_task_id: designerTask.id,
      p_new_status: "IN_PROGRESS",
    }
  );
  assert(
    designerRpcError === null,
    "BACKEND_RPC_AUTHORITY",
    "Assigned Designer calling transition_task_status -> IN_PROGRESS succeeds",
    "Success (error null)",
    designerRpcError ? (designerRpcError as any).message : "Success (error null)"
  );

  // Verify DB record status actually updated to IN_PROGRESS
  const { data: verifiedTask } = await adminClient
    .from("tasks")
    .select("status")
    .eq("id", designerTask.id)
    .single();
  assert(
    verifiedTask?.status === "IN_PROGRESS",
    "DB_VERIFICATION",
    "Task status in database updated to IN_PROGRESS",
    "IN_PROGRESS",
    verifiedTask?.status || "null"
  );

  console.log("\n5. Verifying Clean Code & Zero Em Dash Compliance...");

  const filesToCheck = [
    "src/components/ui/toast.tsx",
    "src/features/tasks/actions.ts",
    "src/features/tasks/components/task-status-control.tsx",
    "src/features/tasks/components/task-list.tsx",
    "src/features/tasks/components/task-form-dialog.tsx",
    "src/features/tasks/components/task-reassign-dialog.tsx",
    "src/features/tasks/components/production-readiness-panel.tsx",
    "src/features/deliverables/components/task-deliverables-drawer.tsx",
    "src/features/approvals/components/qc-review-dialog.tsx",
    "src/features/projects/components/project-create-form.tsx",
    "src/features/projects/components/project-edit-dialog.tsx",
    "src/features/projects/components/project-archive-dialog.tsx",
    "src/features/projects/components/project-team-section.tsx",
    "src/features/projects/components/project-planning-summary.tsx",
    "src/features/client-review/components/publish-project-dialog.tsx",
    "src/features/client-review/components/client-verdict-dialog.tsx",
    "src/features/client-review/components/client-review-tab.tsx",
    "src/features/content-plans/components/content-plan-form-dialog.tsx",
    "src/features/scripts/components/script-form-dialog.tsx",
    "src/features/clients/components/client-form-dialog.tsx",
    "src/features/brands/components/brand-form-dialog.tsx",
    "src/features/briefs/components/brief-form-dialog.tsx",
  ];

  let totalEmDashesFound = 0;
  for (const relPath of filesToCheck) {
    const fullPath = path.resolve(process.cwd(), relPath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      // Check for em dash unicode \u2014
      const matches = content.match(/\u2014/g);
      if (matches && matches.length > 0) {
        totalEmDashesFound += matches.length;
        console.error(`  [FAIL] Em dash detected in ${relPath}: ${matches.length} occurrence(s)`);
      }
    }
  }

  assert(
    totalEmDashesFound === 0,
    "HYGIENE_CHECK",
    "Zero em dashes across all application components and dialogs",
    "0 em dashes",
    `${totalEmDashesFound} em dashes found`
  );

  // Clean up test data
  console.log("\n6. Cleaning up test data...");
  await adminClient.from("tasks").delete().eq("project_id", testProject.id);
  await adminClient.from("project_members").delete().eq("project_id", testProject.id);
  await adminClient.from("projects").delete().eq("id", testProject.id);
  await adminClient.from("brands").delete().eq("id", testBrand.id);
  await adminClient.from("clients").delete().eq("id", testClient.id);

  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${totalPassed} PASSED | ${totalFailed} FAILED`);
  console.log("================================================================================");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
