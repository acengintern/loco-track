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

async function runPhase5Audit() {
  console.log("===============================================================================");
  console.log("LOCO TRACK - Phase 5.1 Final Core Consistency Audit Test Suite");
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

  // =========================================================================
  // Section 1: 18-Table Contract Verification
  // =========================================================================
  console.log("1. Verifying 18-Table Database Contract...");
  {
    const expectedTables = [
      "activity_logs",
      "brands",
      "briefs",
      "client_review_items",
      "client_reviews",
      "clients",
      "content_plans",
      "notifications",
      "profiles",
      "project_files",
      "project_members",
      "project_status_history",
      "projects",
      "qc_reviews",
      "revision_requests",
      "scripts",
      "task_assignments",
      "tasks",
    ].sort();

    // Verify presence of all 18 tables
    let presentTableCount = 0;
    const missingTables: string[] = [];
    for (const t of expectedTables) {
      const { error } = await adminClient.from(t).select("id").limit(0);
      if (!error) {
        presentTableCount++;
      } else {
        missingTables.push(t);
      }
    }

    assert(
      presentTableCount === 18 && missingTables.length === 0,
      "18-Table Contract",
      "Exact 18 Tables Present",
      "18 tables present",
      `${presentTableCount} tables present (missing: ${missingTables.join(", ") || "none"})`
    );
  }

  // =========================================================================
  // Section 2: Canonical Name Column (No Title, No Sync Trigger)
  // =========================================================================
  console.log("\n2. Verifying Canonical Name Column...");
  {
    // Check that projects.name is readable and writable
    const { data: sampleProjects, error: prjErr } = await adminClient
      .from("projects")
      .select("id, name, project_code")
      .limit(1);

    assert(
      !prjErr && sampleProjects !== null,
      "Canonical Name",
      "projects.name queryable",
      "Success without error",
      prjErr ? `Error: ${prjErr.message}` : "projects.name exists and readable"
    );

    // Verify selecting 'title' from projects produces a schema error
    const { error: titleErr } = await adminClient
      .from("projects")
      .select("id, title" as unknown as "id, name")
      .limit(1);

    assert(
      Boolean(titleErr),
      "Canonical Name",
      "projects.title column dropped",
      "Query fails because column does not exist",
      titleErr ? "Column title does not exist (rejected)" : "Unexpected: title column still exists"
    );
  }

  // =========================================================================
  // Section 3: log_project_activity Anti-Forgery and Caller Verification
  // =========================================================================
  console.log("\n3. Verifying log_project_activity RPC Hardening...");
  {
    // Retrieve a sample project owned by SMS
    const { data: projectA } = await adminClient
      .from("projects")
      .select("id, sms_owner_id")
      .is("deleted_at", null)
      .eq("sms_owner_id", smsAuth.user.id)
      .limit(1)
      .single();

    if (!projectA) {
      throw new Error("Prerequisite failed: no active project found.");
    }

    // 1. Attempt forged PROJECT_CREATED event via RPC -> MUST FAIL
    const { error: errForgeCreated } = await smsAuth.client.rpc("log_project_activity", {
      p_project_id: projectA.id,
      p_event_type: "PROJECT_CREATED",
      p_metadata: { forged: true },
    });
    assert(
      Boolean(errForgeCreated),
      "log_project_activity",
      "Reject forged PROJECT_CREATED event",
      "Exception raised",
      errForgeCreated ? `Rejected: ${errForgeCreated.message}` : "Allowed (SECURITY FAILURE)"
    );

    // 2. Attempt arbitrary fake event -> MUST FAIL
    const { error: errForgeFake } = await smsAuth.client.rpc("log_project_activity", {
      p_project_id: projectA.id,
      p_event_type: "FAKE_UNAUTHORIZED_EVENT",
      p_metadata: { forged: true },
    });
    assert(
      Boolean(errForgeFake),
      "log_project_activity",
      "Reject arbitrary event_type",
      "Exception raised",
      errForgeFake ? `Rejected: ${errForgeFake.message}` : "Allowed (SECURITY FAILURE)"
    );

    // 3. Attempt forged status change -> MUST FAIL
    const { error: errForgePublish } = await smsAuth.client.rpc("log_project_activity", {
      p_project_id: projectA.id,
      p_event_type: "PROJECT_PUBLISHED",
      p_metadata: { forged: true },
    });
    assert(
      Boolean(errForgePublish),
      "log_project_activity",
      "Reject fake PROJECT_PUBLISHED event",
      "Exception raised",
      errForgePublish ? `Rejected: ${errForgePublish.message}` : "Allowed (SECURITY FAILURE)"
    );

    // 4. AE caller (read-only) -> MUST FAIL
    const { error: errAeLog } = await aeAuth.client.rpc("log_project_activity", {
      p_project_id: projectA.id,
      p_event_type: "PROJECT_UPDATED",
      p_metadata: {},
    });
    assert(
      Boolean(errAeLog),
      "log_project_activity",
      "Reject ACCOUNT_EXECUTIVE caller",
      "Exception raised",
      errAeLog ? `Rejected: ${errAeLog.message}` : "Allowed (SECURITY FAILURE)"
    );

    // 5. CD caller (read-only workflow) -> MUST FAIL
    const { error: errCdLog } = await cdAuth.client.rpc("log_project_activity", {
      p_project_id: projectA.id,
      p_event_type: "PROJECT_UPDATED",
      p_metadata: {},
    });
    assert(
      Boolean(errCdLog),
      "log_project_activity",
      "Reject CREATIVE_DIRECTOR caller",
      "Exception raised",
      errCdLog ? `Rejected: ${errCdLog.message}` : "Allowed (SECURITY FAILURE)"
    );

    // 6. Designer caller -> MUST FAIL
    const { error: errDesignerLog } = await designerAuth.client.rpc("log_project_activity", {
      p_project_id: projectA.id,
      p_event_type: "PROJECT_UPDATED",
      p_metadata: {},
    });
    assert(
      Boolean(errDesignerLog),
      "log_project_activity",
      "Reject GRAPHIC_DESIGNER caller",
      "Exception raised",
      errDesignerLog ? `Rejected: ${errDesignerLog.message}` : "Allowed (SECURITY FAILURE)"
    );

    // 6b. Editor caller -> MUST FAIL
    const { error: errEditorLog } = await editorAuth.client.rpc("log_project_activity", {
      p_project_id: projectA.id,
      p_event_type: "PROJECT_UPDATED",
      p_metadata: {},
    });
    assert(
      Boolean(errEditorLog),
      "log_project_activity",
      "Reject VIDEO_EDITOR caller",
      "Exception raised",
      errEditorLog ? `Rejected: ${errEditorLog.message}` : "Allowed (SECURITY FAILURE)"
    );

    // 7. Non-owner SMS on project A -> MUST FAIL
    const { error: errSms2Log } = await sms2Auth.client.rpc("log_project_activity", {
      p_project_id: projectA.id,
      p_event_type: "PROJECT_UPDATED",
      p_metadata: {},
    });
    assert(
      Boolean(errSms2Log),
      "log_project_activity",
      "Reject non-owner SMS caller",
      "Exception raised",
      errSms2Log ? `Rejected: ${errSms2Log.message}` : "Allowed (SECURITY FAILURE)"
    );

    // 8. Legitimate SMS owner caller with allowed event type -> SUCCEEDS
    const { data: logResult, error: errSmsOwnerLog } = await smsAuth.client.rpc("log_project_activity", {
      p_project_id: projectA.id,
      p_event_type: "PROJECT_UPDATED",
      p_metadata: { source: "phase5_audit_verification" },
    });
    assert(
      !errSmsOwnerLog && Boolean(logResult),
      "log_project_activity",
      "Allow legitimate SMS owner activity log",
      "Log UUID returned",
      errSmsOwnerLog ? `Error: ${errSmsOwnerLog.message}` : `Success (log_id: ${logResult})`
    );
  }

  // =========================================================================
  // Section 4: Atomic Project Creation (create_project RPC)
  // =========================================================================
  console.log("\n4. Verifying Atomic create_project RPC...");
  let createdProjectId = "";
  {
    // Retrieve an active brand
    const { data: brand } = await adminClient
      .from("brands")
      .select("id, code")
      .is("deleted_at", null)
      .limit(1)
      .single();

    if (!brand) {
      throw new Error("Prerequisite failed: no active brand found.");
    }

    const testProjectName = "Audit Atomic Campaign 2026";
    const deadlineIso = new Date(Date.now() + 10 * 86400000).toISOString();

    // Call create_project RPC as SMS
    const { data: rpcResult, error: createErr } = await smsAuth.client.rpc("create_project", {
      p_brand_id: brand.id,
      p_name: testProjectName,
      p_description: "Created via atomic create_project RPC during Phase 5.1 audit",
      p_priority: "HIGH",
      p_start_date: new Date().toISOString().split("T")[0],
      p_deadline: deadlineIso,
      p_sms_owner_id: smsAuth.user.id,
    });

    assert(
      !createErr && Boolean(rpcResult),
      "create_project RPC",
      "Atomic project creation succeeds",
      "RPC returns project object with id and code",
      createErr ? `Error: ${createErr.message}` : `Created project_code: ${(rpcResult as { project_code: string })?.project_code}`
    );

    const projectData = rpcResult as { id: string; project_code: string };
    createdProjectId = projectData?.id || "";

    if (createdProjectId) {
      // 1. Verify project record exists in projects table
      const { data: prjRow } = await adminClient
        .from("projects")
        .select("id, name, project_code, sms_owner_id, status")
        .eq("id", createdProjectId)
        .single();

      assert(
        prjRow?.name === testProjectName && prjRow?.sms_owner_id === smsAuth.user.id,
        "create_project RPC",
        "Project record saved correctly",
        testProjectName,
        prjRow?.name || "none"
      );

      // 2. Verify project_members record was created atomically
      const { data: memberRow } = await adminClient
        .from("project_members")
        .select("id, user_id")
        .eq("project_id", createdProjectId)
        .eq("user_id", smsAuth.user.id)
        .single();

      assert(
        Boolean(memberRow),
        "create_project RPC",
        "SMS owner atomically added to project_members",
        "Member row exists",
        memberRow ? "Found in project_members" : "Missing from project_members"
      );

      // 3. Verify PROJECT_CREATED activity log was created atomically
      const { data: logRows } = await adminClient
        .from("activity_logs")
        .select("id, event_type, metadata")
        .eq("project_id", createdProjectId)
        .eq("event_type", "PROJECT_CREATED");

      assert(
        Boolean(logRows && logRows.length === 1),
        "create_project RPC",
        "PROJECT_CREATED activity log atomically created",
        "1 log row found",
        `${logRows?.length || 0} log rows found`
      );
    }
  }

  // =========================================================================
  // Section 5: SMS Owner Rule Enforcement
  // =========================================================================
  console.log("\n5. Verifying SMS Owner Rule Enforcement...");
  {
    const { data: brand } = await adminClient
      .from("brands")
      .select("id")
      .is("deleted_at", null)
      .limit(1)
      .single();

    const deadlineIso = new Date(Date.now() + 7 * 86400000).toISOString();

    // 1. SMS caller attempting to assign someone else -> MUST BE REJECTED
    const { error: errSmsOther } = await smsAuth.client.rpc("create_project", {
      p_brand_id: brand!.id,
      p_name: "SMS Owner Impersonation Test",
      p_description: null,
      p_priority: "MEDIUM",
      p_start_date: new Date().toISOString().split("T")[0],
      p_deadline: deadlineIso,
      p_sms_owner_id: sms2Auth.user.id, // SMS tries to assign SMS 2
    });

    assert(
      Boolean(errSmsOther),
      "SMS Owner Rule",
      "SMS creator cannot assign other SMS (rejected)",
      "Exception raised",
      errSmsOther ? `Rejected: ${errSmsOther.message}` : "Allowed (VIOLATION)"
    );

    // 2. ADMIN attempting to assign non-SMS role (e.g. CD) -> MUST REJECT
    const { error: errAssignCd } = await adminAuth.client.rpc("create_project", {
      p_brand_id: brand!.id,
      p_name: "Admin Invalid Owner CD Test",
      p_description: null,
      p_priority: "MEDIUM",
      p_start_date: new Date().toISOString().split("T")[0],
      p_deadline: deadlineIso,
      p_sms_owner_id: cdAuth.user.id, // Invalid: CD is not SOCIAL_MEDIA_SPECIALIST
    });

    assert(
      Boolean(errAssignCd),
      "SMS Owner Rule",
      "Admin assigning CD as owner rejected",
      "Exception raised",
      errAssignCd ? `Rejected: ${errAssignCd.message}` : "Allowed (VIOLATION)"
    );

    // 3. ADMIN attempting to assign Designer as owner -> MUST REJECT
    const { error: errAssignDesigner } = await adminAuth.client.rpc("create_project", {
      p_brand_id: brand!.id,
      p_name: "Admin Invalid Owner Designer Test",
      p_description: null,
      p_priority: "MEDIUM",
      p_start_date: new Date().toISOString().split("T")[0],
      p_deadline: deadlineIso,
      p_sms_owner_id: designerAuth.user.id, // Invalid: Designer is not SMS
    });

    assert(
      Boolean(errAssignDesigner),
      "SMS Owner Rule",
      "Admin assigning Designer as owner rejected",
      "Exception raised",
      errAssignDesigner ? `Rejected: ${errAssignDesigner.message}` : "Allowed (VIOLATION)"
    );

    // 4. ADMIN creating project assigning valid SMS 2 -> SUCCEEDS
    const { data: adminSms2Result, error: errAdminSms2 } = await adminAuth.client.rpc("create_project", {
      p_brand_id: brand!.id,
      p_name: "Admin Valid SMS 2 Assignment",
      p_description: null,
      p_priority: "LOW",
      p_start_date: new Date().toISOString().split("T")[0],
      p_deadline: deadlineIso,
      p_sms_owner_id: sms2Auth.user.id,
    });

    assert(
      !errAdminSms2 && Boolean(adminSms2Result),
      "SMS Owner Rule",
      "Admin assigning active SMS succeeds",
      "Success",
      errAdminSms2 ? `Error: ${errAdminSms2.message}` : "Created successfully"
    );
  }

  // =========================================================================
  // Section 6: Project Membership Integrity (Active Task Removal Guard)
  // =========================================================================
  console.log("\n6. Verifying Project Membership Removal Guard Trigger...");
  {
    if (!createdProjectId) {
      throw new Error("Prerequisite failed: no created project for membership test.");
    }

    // 1. Add Designer to project members
    const { error: errAddDesigner } = await adminClient
      .from("project_members")
      .insert({
        project_id: createdProjectId,
        user_id: designerAuth.user.id,
      });

    assert(!errAddDesigner, "Membership Integrity", "Add Designer to project members", "Success", errAddDesigner ? errAddDesigner.message : "Success");

    // 2. Assign an active task to Designer in this project
    const deadlineStr = new Date(Date.now() + 5 * 86400000).toISOString();
    const { data: activeTask, error: errTaskIns } = await adminClient
      .from("tasks")
      .insert({
        project_id: createdProjectId,
        title: "Key Visual Design",
        task_type: "GRAPHIC_DESIGN",
        status: "IN_PROGRESS",
        current_assignee_id: designerAuth.user.id,
        deadline: deadlineStr,
      })
      .select("id")
      .single();

    assert(
      !errTaskIns && Boolean(activeTask),
      "Membership Integrity",
      "Active task created for Designer",
      "Success",
      errTaskIns ? errTaskIns.message : `Task ID: ${activeTask?.id}`
    );

    // 3. Attempt to remove Designer from project members while task is active -> MUST BE BLOCKED BY TRIGGER
    const { error: errRemoveActiveMember } = await adminClient
      .from("project_members")
      .delete()
      .eq("project_id", createdProjectId)
      .eq("user_id", designerAuth.user.id);

    assert(
      Boolean(errRemoveActiveMember),
      "Membership Integrity",
      "Trigger blocks removing member with active tasks",
      "Exception raised",
      errRemoveActiveMember ? `Blocked: ${errRemoveActiveMember.message}` : "Removed (TRIGGER FAILED)"
    );

    // 4. Mark task as COMPLETED
    const { error: errTaskComplete } = await adminClient
      .from("tasks")
      .update({ status: "COMPLETED" })
      .eq("id", activeTask!.id);

    assert(!errTaskComplete, "Membership Integrity", "Task updated to COMPLETED", "Success", "Task completed");

    // 5. Attempt removal again -> SUCCEEDS now that task is completed
    const { error: errRemoveCompletedMember } = await adminClient
      .from("project_members")
      .delete()
      .eq("project_id", createdProjectId)
      .eq("user_id", designerAuth.user.id);

    assert(
      !errRemoveCompletedMember,
      "Membership Integrity",
      "Member removal succeeds when no active tasks remain",
      "Success",
      errRemoveCompletedMember ? `Error: ${errRemoveCompletedMember.message}` : "Member removed successfully"
    );
  }

  // =========================================================================
  // Section 7: Mutation Boundaries Enforcement Trigger
  // =========================================================================
  console.log("\n7. Verifying Mutation Boundaries Trigger...");
  {
    if (!createdProjectId) {
      throw new Error("Prerequisite failed: no created project for mutation tests.");
    }

    // 1. Attempt to mutate project_code -> MUST FAIL
    const { error: errMutateCode } = await adminClient
      .from("projects")
      .update({ project_code: "HACK-9999" })
      .eq("id", createdProjectId);

    assert(
      Boolean(errMutateCode),
      "Mutation Boundaries",
      "Immutable project_code cannot be updated",
      "Exception raised",
      errMutateCode ? `Blocked: ${errMutateCode.message}` : "Updated (VIOLATION)"
    );

    // 2. Attempt to mutate created_by -> MUST FAIL
    const { error: errMutateCreatedBy } = await adminClient
      .from("projects")
      .update({ created_by: designerAuth.user.id })
      .eq("id", createdProjectId);

    assert(
      Boolean(errMutateCreatedBy),
      "Mutation Boundaries",
      "Immutable created_by cannot be updated",
      "Exception raised",
      errMutateCreatedBy ? `Blocked: ${errMutateCreatedBy.message}` : "Updated (VIOLATION)"
    );

    // 3. SMS attempts to change sms_owner_id -> MUST FAIL
    const { error: errSmsChangeOwner } = await smsAuth.client
      .from("projects")
      .update({ sms_owner_id: sms2Auth.user.id })
      .eq("id", createdProjectId);

    assert(
      Boolean(errSmsChangeOwner),
      "Mutation Boundaries",
      "SMS cannot reassign sms_owner_id",
      "Exception raised",
      errSmsChangeOwner ? `Blocked: ${errSmsChangeOwner.message}` : "Updated (VIOLATION)"
    );

    // 4. Move project status to CONTENT_PLANNING
    await adminClient
      .from("projects")
      .update({ status: "CONTENT_PLANNING" })
      .eq("id", createdProjectId);

    // 5. Attempt to change brand_id outside BRIEF_RECEIVED -> MUST FAIL
    let { data: secondBrand } = await adminClient
      .from("brands")
      .select("id")
      .is("deleted_at", null)
      .neq("id", "20000000-0000-0000-0000-000000000001")
      .limit(1)
      .maybeSingle();

    if (!secondBrand) {
      const { data: createdBrand } = await adminClient
        .from("brands")
        .insert({
          client_id: "10000000-0000-0000-0000-000000000001",
          name: "Test Boundary Brand",
          code: `TB${Date.now().toString().slice(-4)}`,
          created_by: smsAuth.user.id,
        })
        .select("id")
        .single();
      secondBrand = createdBrand;
    }

    const { error: errChangeBrandPostBrief } = await adminClient
      .from("projects")
      .update({ brand_id: secondBrand!.id })
      .eq("id", createdProjectId);

    assert(
      Boolean(errChangeBrandPostBrief),
      "Mutation Boundaries",
      "brand_id locked after BRIEF_RECEIVED phase",
      "Exception raised",
      errChangeBrandPostBrief ? `Blocked: ${errChangeBrandPostBrief.message}` : "Updated (VIOLATION)"
    );
  }

  // =========================================================================
  // Section 8: Archive Rules Verification
  // =========================================================================
  console.log("\n8. Verifying Archive Rules...");
  {
    // 1. Non-admin (SMS) soft-delete client -> MUST FAIL
    const { error: errSmsDeleteClient } = await smsAuth.client
      .from("clients")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", "10000000-0000-0000-0000-000000000001");

    assert(
      Boolean(errSmsDeleteClient),
      "Archive Rules",
      "Non-admin rejected from client soft-delete",
      "RLS rejection",
      errSmsDeleteClient ? "Blocked by RLS" : "Allowed (VIOLATION)"
    );

    // 2. Non-admin (SMS) soft-delete brand -> MUST FAIL
    const { error: errSmsDeleteBrand } = await smsAuth.client
      .from("brands")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", "20000000-0000-0000-0000-000000000001");

    assert(
      Boolean(errSmsDeleteBrand),
      "Archive Rules",
      "Non-admin rejected from brand soft-delete",
      "RLS rejection",
      errSmsDeleteBrand ? "Blocked by RLS" : "Allowed (VIOLATION)"
    );

    // 3. T-003 Brand Archive Guard: Admin soft-delete brand with active projects -> MUST BE BLOCKED BY TRIGGER
    const { error: errAdminDeleteActiveBrand } = await adminClient
      .from("brands")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", "20000000-0000-0000-0000-000000000001");

    assert(
      Boolean(errAdminDeleteActiveBrand),
      "Archive Rules",
      "T-003: Trigger blocks archiving brand with active projects",
      "Exception raised",
      errAdminDeleteActiveBrand ? `Blocked: ${errAdminDeleteActiveBrand.message}` : "Allowed (VIOLATION)"
    );

    // 4. Designer soft-delete project -> MUST FAIL (RLS)
    const { data: designerDeleteResult } = await designerAuth.client
      .from("projects")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", createdProjectId)
      .select("id");

    assert(
      !designerDeleteResult || designerDeleteResult.length === 0,
      "Archive Rules",
      "Designer cannot soft-delete project",
      "0 rows modified",
      `${designerDeleteResult?.length || 0} rows modified`
    );

    // 5. SMS owner soft-delete project -> SUCCEEDS
    const { error: errSmsArchiveProject } = await smsAuth.client
      .from("projects")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", createdProjectId);

    assert(
      !errSmsArchiveProject,
      "Archive Rules",
      "SMS owner can soft-delete owned project",
      "Success",
      errSmsArchiveProject ? `Error: ${errSmsArchiveProject.message}` : "Project archived successfully"
    );
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log("\n===============================================================================");
  console.log(`TOTAL PHASE 5.1 AUDIT ASSERTIONS: ${totalPassed + totalFailed} | PASSED: ${totalPassed} | FAILED: ${totalFailed}`);
  console.log("===============================================================================\n");

  if (totalFailed > 0) {
    console.error(`[FATAL] ${totalFailed} audit assertion(s) failed!`);
    process.exit(1);
  } else {
    console.log("[SUCCESS] All Phase 5.1 audit assertions passed cleanly!");
  }
}

runPhase5Audit().catch((err) => {
  console.error("Audit run error:", err);
  process.exit(1);
});
