import { createClient } from "@supabase/supabase-js";
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

async function runPhase6Verification() {
  console.log("===============================================================================");
  console.log("LOCO TRACK - Phase 6 Brief, Content Plan & Script Workflows Verification");
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
  // Section 1: Project Setup for Phase 6 Workflows
  // =========================================================================
  console.log("1. Creating Test Projects for Workflow Verification...");

  const timestamp = Date.now();

  // Project A: Owned by smsAuth (will go through full transition flow)
  const { data: resA, error: pAErr } = await smsAuth.client.rpc("create_project", {
    p_brand_id: brand.id,
    p_name: `Phase 6 Test Project Alpha ${timestamp}`,
    p_description: "Workflow test project for brief, content plan, script",
    p_priority: "HIGH",
    p_start_date: "2026-09-15",
    p_deadline: "2026-10-15T23:59:59.000Z",
    p_sms_owner_id: smsAuth.user.id,
  });
  const projAId = (resA as { id: string })?.id;

  assert(!pAErr && !!projAId, "Setup", "Create Test Project Alpha", "Project created", pAErr?.message || `ID: ${projAId}`);

  // Project B: For Script Not Required workflow
  const { data: resB, error: pBErr } = await smsAuth.client.rpc("create_project", {
    p_brand_id: brand.id,
    p_name: `Phase 6 Test Project Beta (No Script) ${timestamp}`,
    p_description: "Workflow test for script not required",
    p_priority: "MEDIUM",
    p_start_date: "2026-09-15",
    p_deadline: "2026-10-15T23:59:59.000Z",
    p_sms_owner_id: smsAuth.user.id,
  });
  const projBId = (resB as { id: string })?.id;

  assert(!pBErr && !!projBId, "Setup", "Create Test Project Beta", "Project created", pBErr?.message || `ID: ${projBId}`);

  // Add Designer to Project A team roster for scoped read testing
  const { error: addMemErr } = await adminClient.from("project_members").insert({
    project_id: projAId,
    user_id: designerAuth.user.id,
  });
  assert(!addMemErr, "Setup", "Add Designer to Project A Roster", "Member added", addMemErr?.message || "Success");

  // =========================================================================
  // Section 2: Brief CRUD & RLS Verification
  // =========================================================================
  console.log("\n2. Testing Brief CRUD, 1:1 Constraint & RLS Permissions...");

  // 2.1 Non-owner SMS cannot create brief for Project A
  const { error: nonOwnerBriefErr } = await sms2Auth.client.from("briefs").insert({
    project_id: projAId,
    objective: "Unauthorized brief",
    target_audience: "Anyone",
    key_message: "Test",
    deliverables_summary: "None",
    created_by: sms2Auth.user.id,
  });
  assert(!!nonOwnerBriefErr, "Brief RLS", "Non-Owner SMS Brief Insert Blocked", "Rejected by RLS", nonOwnerBriefErr ? "Rejected" : "Allowed");

  // 2.2 Creative Designer cannot create brief
  const { error: designerBriefErr } = await designerAuth.client.from("briefs").insert({
    project_id: projAId,
    objective: "Designer unauthorized brief",
    target_audience: "Anyone",
    key_message: "Test",
    deliverables_summary: "None",
    created_by: designerAuth.user.id,
  });
  assert(!!designerBriefErr, "Brief RLS", "Designer Brief Insert Blocked", "Rejected by RLS", designerBriefErr ? "Rejected" : "Allowed");

  // 2.3 Assigned SMS Owner can create brief
  const { data: briefA, error: smsBriefErr } = await smsAuth.client
    .from("briefs")
    .insert({
      project_id: projAId,
      objective: "Meningkatkan brand awareness kampanye digital Q4",
      target_audience: "Profesional muda usia 25-35 tahun",
      key_message: "Solusi operasional cerdas dan tenang untuk tim kreatif",
      deliverables_summary: "3 Video Reels dan 5 Grafis Feed Instagram",
      reference_links: "https://instagram.com/p/example1\nhttps://instagram.com/p/example2",
      created_by: smsAuth.user.id,
    })
    .select("id")
    .single();

  assert(!smsBriefErr && !!briefA, "Brief RLS", "SMS Owner Brief Insert", "Brief inserted", smsBriefErr?.message || `ID: ${briefA?.id}`);

  // 2.4 Duplicate brief for same project rejected (1:1 constraint)
  const { error: dupBriefErr } = await adminClient.from("briefs").insert({
    project_id: projAId,
    objective: "Duplicate brief",
    target_audience: "Duplicate",
    key_message: "Duplicate",
    deliverables_summary: "Duplicate",
    created_by: adminAuth.user.id,
  });
  assert(!!dupBriefErr, "Brief Schema", "Duplicate Brief on Same Project Blocked (1:1)", "Rejected by unique constraint", dupBriefErr ? "Rejected" : "Allowed");

  // 2.5 Global read: CD and AE can view brief
  const { data: cdBrief, error: cdBriefErr } = await cdAuth.client
    .from("briefs")
    .select("id, objective")
    .eq("project_id", projAId)
    .single();
  assert(!cdBriefErr && !!cdBrief, "Brief RLS", "Creative Director Brief Visibility", "Visible", cdBriefErr?.message || "Visible");

  const { data: aeBrief, error: aeBriefErr } = await aeAuth.client
    .from("briefs")
    .select("id, objective")
    .eq("project_id", projAId)
    .single();
  assert(!aeBriefErr && !!aeBrief, "Brief RLS", "Account Executive Brief Visibility", "Visible", aeBriefErr?.message || "Visible");

  // 2.6 Project-scoped read: Assigned designer can view; unassigned editor cannot view
  const { data: desBrief, error: desBriefErr } = await designerAuth.client
    .from("briefs")
    .select("id, objective")
    .eq("project_id", projAId)
    .single();
  assert(!desBriefErr && !!desBrief, "Brief RLS", "Roster Member (Designer) Brief Visibility", "Visible", desBriefErr?.message || "Visible");

  const { data: editBrief } = await editorAuth.client
    .from("briefs")
    .select("id")
    .eq("project_id", projAId);
  assert(editBrief?.length === 0, "Brief RLS", "Non-Member (Editor) Brief Hidden", "0 records returned", `${editBrief?.length ?? 0} records returned`);

  // =========================================================================
  // Section 3: Phase Transition BRIEF_RECEIVED -> CONTENT_PLANNING
  // =========================================================================
  console.log("\n3. Testing Phase Transition: BRIEF_RECEIVED -> CONTENT_PLANNING...");

  // 3.1 Project B has NO brief yet -> transition to CONTENT_PLANNING must fail
  const { error: transNoBriefErr } = await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projBId,
    p_target_phase: "CONTENT_PLANNING",
  });
  assert(
    !!transNoBriefErr && transNoBriefErr.message.toLowerCase().includes("brief"),
    "Phase Transition",
    "Transition without Brief Rejected",
    "Brief required error",
    transNoBriefErr?.message || "No error"
  );

  // 3.2 Project A has brief -> transition to CONTENT_PLANNING must succeed
  const { data: transARes, error: transAErr } = await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projAId,
    p_target_phase: "CONTENT_PLANNING",
  });
  assert(!transAErr && transARes?.success === true, "Phase Transition", "Transition with Brief Succeeded", "Success true", transAErr?.message || JSON.stringify(transARes));

  // Verify status in DB and activity log PLANNING_STARTED
  const { data: pAStatus } = await adminClient.from("projects").select("status").eq("id", projAId).single();
  assert(pAStatus?.status === "CONTENT_PLANNING", "Phase Transition", "Project Status Updated to CONTENT_PLANNING", "CONTENT_PLANNING", pAStatus?.status || "Unknown");

  const { data: startLog } = await adminClient
    .from("activity_logs")
    .select("event_type, metadata")
    .eq("project_id", projAId)
    .eq("event_type", "PLANNING_STARTED")
    .single();
  assert(!!startLog, "Activity Logging", "PLANNING_STARTED Activity Log Recorded", "Log found", startLog ? "Log found" : "Not found");

  // =========================================================================
  // Section 4: Content Plan CRUD & RLS Verification
  // =========================================================================
  console.log("\n4. Testing Content Plan CRUD & RLS Permissions...");

  // 4.1 Non-owner SMS cannot insert content plan
  const { error: nonOwnerCpErr } = await sms2Auth.client.from("content_plans").insert({
    project_id: projAId,
    title: "Unauthorized plan",
    channel: "Instagram Feed",
    planned_post_date: "2026-09-20",
    created_by: sms2Auth.user.id,
  });
  assert(!!nonOwnerCpErr, "Content Plan RLS", "Non-Owner SMS Content Plan Blocked", "Rejected by RLS", nonOwnerCpErr ? "Rejected" : "Allowed");

  // 4.2 SMS Owner creates content plan
  const { data: cp1, error: cp1Err } = await smsAuth.client
    .from("content_plans")
    .insert({
      project_id: projAId,
      title: "Edukasi Masalah Efisiensi Tim Konten",
      channel: "Instagram Reels",
      planned_post_date: "2026-09-22",
      pillar: "Educational",
      copy_draft: "Kenapa banyak tim agency burnout di akhir bulan? Simak 3 bottleneck utama...",
      status: "APPROVED",
      created_by: smsAuth.user.id,
    })
    .select("id")
    .single();
  assert(!cp1Err && !!cp1, "Content Plan RLS", "SMS Owner Content Plan Insert", "Inserted", cp1Err?.message || `ID: ${cp1?.id}`);

  // =========================================================================
  // Section 5: Script CRUD, Cross-Project Isolation & RLS Verification
  // =========================================================================
  console.log("\n5. Testing Script CRUD, Cross-Project Isolation & RLS Permissions...");

  // 5.1 Non-owner SMS cannot create script
  const { error: nonOwnerScriptErr } = await sms2Auth.client.from("scripts").insert({
    project_id: projAId,
    content_plan_id: cp1?.id,
    title: "Unauthorized Script",
    hook: "Test hook",
    body: "Test body",
    visual_cues: "Test cues",
    call_to_action: "Test CTA",
    created_by: sms2Auth.user.id,
  });
  assert(!!nonOwnerScriptErr, "Script RLS", "Non-Owner SMS Script Blocked", "Rejected by RLS", nonOwnerScriptErr ? "Rejected" : "Allowed");

  // 5.2 SMS Owner creates script in DRAFT status
  const { data: script1, error: script1Err } = await smsAuth.client
    .from("scripts")
    .insert({
      project_id: projAId,
      content_plan_id: cp1?.id,
      title: "Naskah Edukasi Bottleneck Agency",
      hook: "90% agency konten kehilangan 15 jam per minggu gara-gara 1 file salah!",
      body: "Ketika alur kerja berantakan, revisi terjadi berulang-ulang tanpa catatan jelas. Ini cara memangkasnya dengan sistem pipeline terpusat.",
      visual_cues: "Footage editor frustrasi membuka folder chat, transisi cepat ke dashboard rapi.",
      call_to_action: "Simpan postingan ini untuk checklist evaluasi tim Anda pekan ini!",
      status: "DRAFT",
      created_by: smsAuth.user.id,
    })
    .select("id")
    .single();
  assert(!script1Err && !!script1, "Script RLS", "SMS Owner Script Insert (DRAFT)", "Inserted", script1Err?.message || `ID: ${script1?.id}`);

  // =========================================================================
  // Section 6: Phase Transition CONTENT_PLANNING -> SCRIPT_READY Validation
  // =========================================================================
  console.log("\n6. Testing Phase Transition: CONTENT_PLANNING -> SCRIPT_READY...");

  // 6.1 Transition fails because script is still in DRAFT status
  const { error: transDraftScriptErr } = await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projAId,
    p_target_phase: "SCRIPT_READY",
  });
  assert(
    !!transDraftScriptErr && transDraftScriptErr.message.includes("All project scripts must be in READY status"),
    "Phase Transition",
    "Transition Blocked when Script is DRAFT",
    "READY status required error",
    transDraftScriptErr?.message || "No error"
  );

  // 6.2 Update script to READY status
  const { error: scriptReadyUpdateErr } = await smsAuth.client
    .from("scripts")
    .update({ status: "READY", updated_at: new Date().toISOString() })
    .eq("id", script1?.id);
  assert(!scriptReadyUpdateErr, "Script Update", "Update Script Status to READY", "Updated", scriptReadyUpdateErr?.message || "Success");

  // 6.3 Now transition to SCRIPT_READY must succeed
  const { data: transScriptReadyRes, error: transScriptReadyErr } = await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projAId,
    p_target_phase: "SCRIPT_READY",
  });
  assert(
    !transScriptReadyErr && transScriptReadyRes?.success === true,
    "Phase Transition",
    "Transition to SCRIPT_READY Succeeded",
    "Success true",
    transScriptReadyErr?.message || JSON.stringify(transScriptReadyRes)
  );

  // Verify status in DB and activity log PLANNING_COMPLETED
  const { data: pAReadyStatus } = await adminClient.from("projects").select("status").eq("id", projAId).single();
  assert(pAReadyStatus?.status === "SCRIPT_READY", "Phase Transition", "Project Status Updated to SCRIPT_READY", "SCRIPT_READY", pAReadyStatus?.status || "Unknown");

  const { data: compLog } = await adminClient
    .from("activity_logs")
    .select("event_type, metadata")
    .eq("project_id", projAId)
    .eq("event_type", "PLANNING_COMPLETED")
    .single();
  assert(!!compLog, "Activity Logging", "PLANNING_COMPLETED Activity Log Recorded", "Log found", compLog ? "Log found" : "Not found");

  // 6.4 Transition to PRODUCTION directly from Phase 6 must be blocked
  const { error: transProdErr } = await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projAId,
    p_target_phase: "PRODUCTION",
  });
  assert(
    !!transProdErr,
    "Phase Scope Boundary",
    "Direct Transition to PRODUCTION Blocked (Phase 7 Scope)",
    "Blocked",
    transProdErr ? "Blocked" : "Allowed"
  );

  // =========================================================================
  // Section 7: Script Not Required Durable Toggle & Validation
  // =========================================================================
  console.log("\n7. Testing Script Not Required Feature & Flow...");

  // Setup Project B with Brief and Content Plan
  await adminClient.from("briefs").insert({
    project_id: projBId,
    objective: "Desain poster promosi billboard offline",
    target_audience: "Masyarakat umum pengguna jalan tol",
    key_message: "Promo Merdeka diskon 45%",
    deliverables_summary: "1 Key Visual Banner High Resolution",
    created_by: smsAuth.user.id,
  });

  // Advance Project B to CONTENT_PLANNING
  await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projBId,
    p_target_phase: "CONTENT_PLANNING",
  });

  // Add 1 Content Plan to Project B
  await smsAuth.client.from("content_plans").insert({
    project_id: projBId,
    title: "Key Visual Banner Promosi Tol",
    channel: "Offline Billboard",
    planned_post_date: "2026-09-30",
    status: "APPROVED",
    created_by: smsAuth.user.id,
  });

  // 7.1 Without script and with script_not_required = false, transition to SCRIPT_READY fails
  const { error: transNoScriptErr } = await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projBId,
    p_target_phase: "SCRIPT_READY",
  });
  assert(
    !!transNoScriptErr && transNoScriptErr.message.includes("requires at least one script"),
    "Script Not Required",
    "Blocked when scripts missing and script_not_required=false",
    "Requires at least one script error",
    transNoScriptErr?.message || "No error"
  );

  // 7.2 Non-owner SMS cannot toggle script_not_required
  const { error: nonOwnerToggleErr } = await sms2Auth.client.rpc("set_project_script_not_required", {
    p_project_id: projBId,
    p_not_required: true,
  });
  assert(!!nonOwnerToggleErr, "Script Not Required", "Non-Owner SMS Toggle Blocked", "Rejected", nonOwnerToggleErr ? "Rejected" : "Allowed");

  // 7.3 SMS Owner toggles script_not_required = true
  const { error: smsToggleErr } = await smsAuth.client.rpc("set_project_script_not_required", {
    p_project_id: projBId,
    p_not_required: true,
  });
  assert(!smsToggleErr, "Script Not Required", "SMS Owner Toggles script_not_required=true", "Success", smsToggleErr?.message || "Success");

  // Verify activity log SCRIPT_NOT_REQUIRED_TOGGLED
  const { data: toggleLog } = await adminClient
    .from("activity_logs")
    .select("event_type, metadata")
    .eq("project_id", projBId)
    .eq("event_type", "SCRIPT_NOT_REQUIRED_TOGGLED")
    .single();
  assert(!!toggleLog, "Activity Logging", "SCRIPT_NOT_REQUIRED_TOGGLED Activity Log Recorded", "Log found", toggleLog ? "Log found" : "Not found");

  // 7.4 Now Project B advances to SCRIPT_READY with 0 scripts!
  const { data: transBRes, error: transBErr } = await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projBId,
    p_target_phase: "SCRIPT_READY",
  });
  assert(!transBErr && transBRes?.success === true, "Script Not Required", "Transition with script_not_required=true Succeeded", "Success true", transBErr?.message || JSON.stringify(transBRes));

  // 7.5 Once in SCRIPT_READY, script_not_required cannot be modified
  const { error: togglePostPlanningErr } = await smsAuth.client.rpc("set_project_script_not_required", {
    p_project_id: projBId,
    p_not_required: false,
  });
  assert(
    !!togglePostPlanningErr && togglePostPlanningErr.message.includes("cannot be changed after planning phases"),
    "Script Not Required",
    "Toggle Blocked after Planning Phase",
    "Blocked error",
    togglePostPlanningErr?.message || "No error"
  );

  // =========================================================================
  // Section 7.1: Phase 6.1 Exhaustive Transition Permutations (A, B, C, D, E)
  // =========================================================================
  console.log("\n7.1 Testing Phase 6.1 Permutations Matrix (A, B, C, D, E)...");

  // Setup Project C (for Permutations A & B)
  const { data: resC } = await smsAuth.client.rpc("create_project", {
    p_brand_id: brand.id,
    p_name: `Phase 6.1 Test Project Gamma (A-B Matrix) ${timestamp}`,
    p_description: "Permutations A and B test project",
    p_priority: "MEDIUM",
    p_start_date: "2026-09-15",
    p_deadline: "2026-10-15T23:59:59.000Z",
    p_sms_owner_id: smsAuth.user.id,
  });
  const projCId = (resC as { id: string })?.id;

  // Add brief to Project C
  await adminClient.from("briefs").insert({
    project_id: projCId,
    objective: "Permutation test brief",
    target_audience: "Audience test",
    key_message: "Message test",
    deliverables_summary: "Deliverables test",
    created_by: smsAuth.user.id,
  });

  // Advance Project C to CONTENT_PLANNING
  await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projCId,
    p_target_phase: "CONTENT_PLANNING",
  });

  // Toggle script_not_required = true for Project C (0 content plans exist)
  await smsAuth.client.rpc("set_project_script_not_required", {
    p_project_id: projCId,
    p_not_required: true,
  });

  // Permutation A: CONTENT_PLANNING + Brief + 0 Plans + script_not_required=true -> MUST FAIL
  const { error: permAErr } = await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projCId,
    p_target_phase: "SCRIPT_READY",
  });
  assert(
    !!permAErr && permAErr.message.includes("At least one content plan item is required"),
    "Phase 6.1 Permutation A",
    "0 content plans + script_not_required=true BLOCKED",
    "Content plan required error",
    permAErr?.message || "Allowed"
  );

  // Add 1 Content Plan to Project C
  await smsAuth.client.from("content_plans").insert({
    project_id: projCId,
    title: "Permutation B Content Plan",
    channel: "Instagram Story",
    planned_post_date: "2026-09-25",
    status: "APPROVED",
    created_by: smsAuth.user.id,
  });

  // Permutation B: CONTENT_PLANNING + Brief + 1 Plan + script_not_required=true -> MUST PASS
  const { data: permBRes, error: permBErr } = await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projCId,
    p_target_phase: "SCRIPT_READY",
  });
  assert(
    !permBErr && permBRes?.success === true,
    "Phase 6.1 Permutation B",
    "1 content plan + script_not_required=true SUCCEEDS",
    "Success true",
    permBErr?.message || JSON.stringify(permBRes)
  );

  // Setup Project D (for Permutations C, D, E & Status History Audit)
  const { data: resD } = await smsAuth.client.rpc("create_project", {
    p_brand_id: brand.id,
    p_name: `Phase 6.1 Test Project Delta (C-D-E Matrix) ${timestamp}`,
    p_description: "Permutations C, D, E and status history audit project",
    p_priority: "HIGH",
    p_start_date: "2026-09-15",
    p_deadline: "2026-10-15T23:59:59.000Z",
    p_sms_owner_id: smsAuth.user.id,
  });
  const projDId = (resD as { id: string })?.id;

  // Add brief to Project D
  await adminClient.from("briefs").insert({
    project_id: projDId,
    objective: "Permutation C-D-E brief",
    target_audience: "Audience test",
    key_message: "Message test",
    deliverables_summary: "Deliverables test",
    created_by: smsAuth.user.id,
  });

  // Transition 1: BRIEF_RECEIVED -> CONTENT_PLANNING
  await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projDId,
    p_target_phase: "CONTENT_PLANNING",
  });

  // Status History Check 1: Exactly 1 row in project_status_history
  const { data: histRow1 } = await adminClient
    .from("project_status_history")
    .select("from_status, to_status")
    .eq("project_id", projDId);
  assert(
    histRow1?.length === 1 && histRow1[0]?.from_status === "BRIEF_RECEIVED" && histRow1[0]?.to_status === "CONTENT_PLANNING",
    "Status History Audit",
    "Transition 1 creates exactly ONE project_status_history row",
    "1 row (BRIEF_RECEIVED -> CONTENT_PLANNING)",
    `${histRow1?.length} row(s)`
  );

  // Add 1 Content Plan to Project D (script_not_required is default false, 0 scripts exist)
  const { data: cpD } = await smsAuth.client
    .from("content_plans")
    .insert({
      project_id: projDId,
      title: "Delta Plan 1",
      channel: "TikTok",
      planned_post_date: "2026-09-28",
      status: "APPROVED",
      created_by: smsAuth.user.id,
    })
    .select("id")
    .single();

  // Permutation C: CONTENT_PLANNING + Brief + 1 Plan + script_not_required=false + 0 Scripts -> MUST FAIL
  const { error: permCErr } = await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projDId,
    p_target_phase: "SCRIPT_READY",
  });
  assert(
    !!permCErr && permCErr.message.includes("requires at least one script"),
    "Phase 6.1 Permutation C",
    "1 content plan + script_not_required=false + 0 scripts BLOCKED",
    "Requires script error",
    permCErr?.message || "Allowed"
  );

  // Add 1 script in DRAFT status
  const { data: scriptD } = await smsAuth.client
    .from("scripts")
    .insert({
      project_id: projDId,
      content_plan_id: cpD?.id,
      title: "Delta Script Draft",
      hook: "Delta hook draft",
      body: "Delta body draft",
      visual_cues: "Delta visual cues",
      call_to_action: "Delta CTA",
      status: "DRAFT",
      created_by: smsAuth.user.id,
    })
    .select("id")
    .single();

  // Permutation D: CONTENT_PLANNING + Brief + 1 Plan + script DRAFT -> MUST FAIL
  const { error: permDErr } = await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projDId,
    p_target_phase: "SCRIPT_READY",
  });
  assert(
    !!permDErr && permDErr.message.includes("All project scripts must be in READY status"),
    "Phase 6.1 Permutation D",
    "1 content plan + script in DRAFT status BLOCKED",
    "Scripts must be READY error",
    permDErr?.message || "Allowed"
  );

  // Update script to READY
  await smsAuth.client
    .from("scripts")
    .update({ status: "READY", updated_at: new Date().toISOString() })
    .eq("id", scriptD?.id);

  // Permutation E: CONTENT_PLANNING + Brief + 1 Plan + script READY -> MUST PASS
  const { data: permERes, error: permEErr } = await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projDId,
    p_target_phase: "SCRIPT_READY",
  });
  assert(
    !permEErr && permERes?.success === true,
    "Phase 6.1 Permutation E",
    "1 content plan + script READY SUCCEEDS",
    "Success true",
    permEErr?.message || JSON.stringify(permERes)
  );

  // Status History Check 2: Exactly 2 rows in project_status_history (1 additional)
  const { data: histRow2 } = await adminClient
    .from("project_status_history")
    .select("from_status, to_status")
    .eq("project_id", projDId)
    .order("created_at", { ascending: true });
  assert(
    histRow2?.length === 2 && histRow2[1]?.from_status === "CONTENT_PLANNING" && histRow2[1]?.to_status === "SCRIPT_READY",
    "Status History Audit",
    "Transition 2 creates exactly ONE additional project_status_history row (Total: 2)",
    "2 rows (CONTENT_PLANNING -> SCRIPT_READY)",
    `${histRow2?.length} row(s)`
  );

  // =========================================================================
  // Section 7.2: script_not_required Role-Based Security Verification
  // =========================================================================
  console.log("\n7.2 Testing script_not_required Role-Based Access Restrictions...");

  // Setup Project E in BRIEF_RECEIVED for security testing
  const { data: resE } = await smsAuth.client.rpc("create_project", {
    p_brand_id: brand.id,
    p_name: `Phase 6.1 Test Project Epsilon (Security) ${timestamp}`,
    p_description: "Role permission test project",
    p_priority: "LOW",
    p_start_date: "2026-09-15",
    p_deadline: "2026-10-15T23:59:59.000Z",
    p_sms_owner_id: smsAuth.user.id,
  });
  const projEId = (resE as { id: string })?.id;

  // AE cannot toggle script_not_required
  const { error: aeToggleErr } = await aeAuth.client.rpc("set_project_script_not_required", {
    p_project_id: projEId,
    p_not_required: true,
  });
  assert(!!aeToggleErr, "Script Not Required Security", "AE toggle BLOCKED", "Rejected", aeToggleErr ? "Rejected" : "Allowed");

  // CD cannot toggle script_not_required
  const { error: cdToggleErr } = await cdAuth.client.rpc("set_project_script_not_required", {
    p_project_id: projEId,
    p_not_required: true,
  });
  assert(!!cdToggleErr, "Script Not Required Security", "CD toggle BLOCKED", "Rejected", cdToggleErr ? "Rejected" : "Allowed");

  // Designer cannot toggle script_not_required
  const { error: desToggleErr } = await designerAuth.client.rpc("set_project_script_not_required", {
    p_project_id: projEId,
    p_not_required: true,
  });
  assert(!!desToggleErr, "Script Not Required Security", "Designer toggle BLOCKED", "Rejected", desToggleErr ? "Rejected" : "Allowed");

  // Editor cannot toggle script_not_required
  const { error: editToggleErr } = await editorAuth.client.rpc("set_project_script_not_required", {
    p_project_id: projEId,
    p_not_required: true,
  });
  assert(!!editToggleErr, "Script Not Required Security", "Editor toggle BLOCKED", "Rejected", editToggleErr ? "Rejected" : "Allowed");

  // Non-owner SMS cannot toggle script_not_required
  const { error: nonOwnerSmsToggleErr } = await sms2Auth.client.rpc("set_project_script_not_required", {
    p_project_id: projEId,
    p_not_required: true,
  });
  assert(!!nonOwnerSmsToggleErr, "Script Not Required Security", "Non-owner SMS toggle BLOCKED", "Rejected", nonOwnerSmsToggleErr ? "Rejected" : "Allowed");

  // =========================================================================
  // Section 7.3: SCRIPT_READY -> PRODUCTION Transition Blocked Verification
  // =========================================================================
  console.log("\n7.3 Verifying SCRIPT_READY -> PRODUCTION Transition Blocked...");

  const { error: transProdFromScriptReadyErr } = await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: projDId,
    p_target_phase: "PRODUCTION",
  });
  assert(
    !!transProdFromScriptReadyErr && transProdFromScriptReadyErr.message.includes("Invalid or unauthorized phase transition"),
    "No Production Entry",
    "SCRIPT_READY -> PRODUCTION is BLOCKED in Phase 6",
    "Unauthorized transition error",
    transProdFromScriptReadyErr?.message || "Allowed"
  );


  // =========================================================================
  // Section 8: T-004 Content Lock & Exceptional Updates Verification
  // =========================================================================
  console.log("\n8. Testing T-004 Content Lock and Exceptional Content Updates...");

  // Advance Project A to PRODUCTION status directly via admin service client to test lock triggers
  await adminClient.from("projects").update({ status: "PRODUCTION" }).eq("id", projAId);

  // 8.1 Ordinary update on Brief blocked by trigger trg_briefs_content_lock
  const { error: lockedBriefErr } = await smsAuth.client
    .from("briefs")
    .update({ objective: "Locked brief ordinary update" })
    .eq("id", briefA?.id);
  assert(
    !!lockedBriefErr && lockedBriefErr.message.includes("Content is locked during PRODUCTION phase (T-004)"),
    "T-004 Content Lock",
    "Ordinary Brief Update Blocked in PRODUCTION",
    "Trigger exception raised",
    lockedBriefErr?.message || "No error"
  );

  // 8.2 Ordinary update on Content Plan blocked by trigger trg_content_plans_content_lock
  const { error: lockedCpErr } = await smsAuth.client
    .from("content_plans")
    .update({ title: "Locked plan ordinary update" })
    .eq("id", cp1?.id);
  assert(
    !!lockedCpErr && lockedCpErr.message.includes("Content is locked during PRODUCTION phase (T-004)"),
    "T-004 Content Lock",
    "Ordinary Content Plan Update Blocked in PRODUCTION",
    "Trigger exception raised",
    lockedCpErr?.message || "No error"
  );

  // 8.3 Ordinary update on Script blocked by trigger trg_scripts_content_lock
  const { error: lockedScriptErr } = await smsAuth.client
    .from("scripts")
    .update({ title: "Locked script ordinary update" })
    .eq("id", script1?.id);
  assert(
    !!lockedScriptErr && lockedScriptErr.message.includes("Content is locked during PRODUCTION phase (T-004)"),
    "T-004 Content Lock",
    "Ordinary Script Update Blocked in PRODUCTION",
    "Trigger exception raised",
    lockedScriptErr?.message || "No error"
  );

  // 8.4 Exceptional update without reason fails
  const { error: expNoReasonErr } = await smsAuth.client.rpc("exceptional_content_update", {
    p_entity_type: "script",
    p_entity_id: script1?.id,
    p_patch: { hook: "Koreksi hook baru" },
    p_reason: "",
  });
  assert(!!expNoReasonErr, "T-004 Content Lock", "Exceptional Update without Reason Blocked", "Rejected", expNoReasonErr ? "Rejected" : "Allowed");

  // 8.5 Exceptional update with reason succeeds
  const { error: expValidErr } = await smsAuth.client.rpc("exceptional_content_update", {
    p_entity_type: "script",
    p_entity_id: script1?.id,
    p_patch: { hook: "Hook luar biasa hasil revisi klien resmi" },
    p_reason: "Penyesuaian USP produk berdasarkan arahan brand",
  });
  assert(!expValidErr, "T-004 Content Lock", "Exceptional Update with Reason Succeeded", "Success", expValidErr?.message || "Success");

  // Verify script hook updated and audit activity log EXCEPTIONAL_CONTENT_REVISION recorded
  const { data: updatedScript } = await adminClient.from("scripts").select("hook").eq("id", script1?.id).single();
  assert(
    updatedScript?.hook === "Hook luar biasa hasil revisi klien resmi",
    "T-004 Content Lock",
    "Script Updated via Exceptional Flow",
    "Hook updated",
    updatedScript?.hook || "Not updated"
  );

  const { data: expLog } = await adminClient
    .from("activity_logs")
    .select("event_type, metadata")
    .eq("project_id", projAId)
    .eq("event_type", "EXCEPTIONAL_CONTENT_REVISION")
    .single();
  assert(!!expLog, "Activity Logging", "EXCEPTIONAL_CONTENT_REVISION Activity Log Recorded", "Log found", expLog ? "Log found" : "Not found");

  // =========================================================================
  // Section 9: Verification Summary
  // =========================================================================
  console.log("\n===============================================================================");
  console.log(`Phase 6 Verification Summary: ${totalPassed} Passed, ${totalFailed} Failed`);
  console.log("===============================================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runPhase6Verification().catch((err) => {
  console.error("FATAL ERROR in Phase 6 verification:", err);
  process.exit(1);
});
