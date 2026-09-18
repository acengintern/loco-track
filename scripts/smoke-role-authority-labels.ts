import { createClient } from "@supabase/supabase-js";
import {
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
  PROJECT_STATUS_LABELS,
  PRIORITY_LABELS,
  CHANNEL_LABELS,
  SCRIPT_STATUS_LABELS,
  ACTIVITY_CATEGORY_LABELS,
  formatContentPlanLabel,
  formatScriptLabel,
  formatUserWithRole,
  formatBrandOptionLabel,
} from "../src/constants/labels";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4Mzg3OTYwMH0.ZXhwZXJpbWVudGFsLXNlcnZpY2Utcm9sZS1rZXk";

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function createAuthClient(email: string) {
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (error || !data.properties?.hashed_token) {
    throw new Error(`Failed to generate magic link for ${email}: ${error?.message}`);
  }

  const userClient = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4Nzk2MDB9.ZXhwZXJpbWVudGFsLWFub24ta2V5");
  const { error: verifyError } = await userClient.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });

  if (verifyError) {
    throw new Error(`Failed to verify OTP for ${email}: ${verifyError.message}`);
  }

  return userClient;
}

async function runVerification() {
  console.log("=== LOCO TRACK: ROLE AUTHORITY & LABELS REGRESSION TEST ===");

  // 1. Verify Formatters
  console.log("\n1. Testing centralized label formatters...");

  // Content Plan Label
  const cpLabel1 = formatContentPlanLabel({
    title: "Koleksi Baru Ramadhan",
    channel: "INSTAGRAM",
    planned_post_date: "2026-10-01T00:00:00Z",
  });
  console.log("   Content Plan (Full):", cpLabel1);
  if (!cpLabel1.includes("Koleksi Baru Ramadhan") || !cpLabel1.includes("Instagram")) {
    throw new Error(`formatContentPlanLabel output unexpected: ${cpLabel1}`);
  }

  const cpLabelNull = formatContentPlanLabel(null);
  console.log("   Content Plan (Null):", cpLabelNull);
  if (cpLabelNull !== "Belum Dipilih / Tidak Ditautkan") {
    throw new Error(`formatContentPlanLabel null fallback unexpected: ${cpLabelNull}`);
  }

  // Script Label
  const scriptLabel1 = formatScriptLabel({
    title: "Teaser Launching 30s",
    status: "READY",
  });
  console.log("   Script (Full):", scriptLabel1);
  if (!scriptLabel1.includes("Teaser Launching 30s") || !scriptLabel1.includes("Siap Produksi")) {
    throw new Error(`formatScriptLabel output unexpected: ${scriptLabel1}`);
  }

  const scriptLabelNull = formatScriptLabel(null);
  console.log("   Script (Null):", scriptLabelNull);
  if (scriptLabelNull !== "Belum Dipilih / Tidak Ditautkan") {
    throw new Error(`formatScriptLabel null fallback unexpected: ${scriptLabelNull}`);
  }

  // User with Role Label
  const userLabel1 = formatUserWithRole({
    full_name: "Diana Designer",
    role: "GRAPHIC_DESIGNER",
  });
  console.log("   User with Role:", userLabel1);
  if (userLabel1 !== "Diana Designer · Graphic Designer") {
    throw new Error(`formatUserWithRole output unexpected: ${userLabel1}`);
  }

  const userLabelNull = formatUserWithRole(null);
  console.log("   User (Null):", userLabelNull);
  if (userLabelNull !== "Belum Ditugaskan") {
    throw new Error(`formatUserWithRole null fallback unexpected: ${userLabelNull}`);
  }

  // Brand Option Label
  const brandLabel1 = formatBrandOptionLabel({
    name: "Wardah",
    code: "WRD",
    client_name: "Paragon Corp",
  });
  console.log("   Brand Option:", brandLabel1);
  if (brandLabel1 !== "Paragon Corp · Wardah (WRD)") {
    throw new Error(`formatBrandOptionLabel output unexpected: ${brandLabel1}`);
  }

  // Check constant mappings
  console.log("\n2. Checking constant mappings for human-readable labels...");
  if (TASK_TYPE_LABELS.GRAPHIC_DESIGN !== "Desain Grafis") throw new Error("Invalid GRAPHIC_DESIGN label");
  if (TASK_TYPE_LABELS.VIDEO_EDITING !== "Video Editing") throw new Error("Invalid VIDEO_EDITING label");
  if (TASK_STATUS_LABELS.IN_REVIEW !== "Menunggu review") throw new Error("Invalid IN_REVIEW label");
  if (TASK_STATUS_LABELS.REVISION_REQUESTED !== "Perlu revisi") throw new Error("Invalid REVISION_REQUESTED label");
  if (PROJECT_STATUS_LABELS.PRODUCTION !== "Produksi") throw new Error("Invalid PRODUCTION label");
  if (PRIORITY_LABELS.URGENT !== "Mendesak") throw new Error("Invalid URGENT label");
  if (CHANNEL_LABELS.INSTAGRAM !== "Instagram") throw new Error("Invalid INSTAGRAM channel label");
  if (SCRIPT_STATUS_LABELS.READY !== "Siap Produksi") throw new Error("Invalid READY script status label");
  if (ACTIVITY_CATEGORY_LABELS.DELIVERABLE !== "Deliverable") throw new Error("Invalid DELIVERABLE activity category");
  console.log("   All dictionaries mapped to clean human labels. OK.");

  // 3. Database & RPC Authority Testing
  console.log("\n3. Testing Database & RPC Authority Boundaries...");

  const smsAuth = await createAuthClient("sms@locotrack.local");
  const designerAuth = await createAuthClient("designer@locotrack.local");

  const { data: profiles } = await adminClient.from("profiles").select("id, email, role");
  const profileMap = new Map((profiles || []).map((p) => [p.email, p]));
  const smsId = profileMap.get("sms@locotrack.local")!.id;
  const designerId = profileMap.get("designer@locotrack.local")!.id;

  // Find a test brand and project
  const { data: brand } = await adminClient.from("brands").select("id").limit(1).single();
  if (!brand) throw new Error("No brand found in test database");

  // Create isolated test project
  const testCode = `TEST-AUTH-${Date.now()}`;
  const { data: testProj, error: projErr } = await adminClient
    .from("projects")
    .insert({
      name: "TEST AUTHORITY PROJECT",
      project_code: testCode,
      brand_id: brand.id,
      sms_owner_id: smsId,
      created_by: smsId,
      status: "PRODUCTION",
      priority: "HIGH",
      start_date: new Date().toISOString(),
      deadline: new Date(Date.now() + 86400000 * 7).toISOString(),
    })
    .select()
    .single();

  if (projErr || !testProj) throw new Error(`Failed to create test project: ${projErr?.message}`);

  // Create test task assigned to designer
  const { data: testTask, error: taskErr } = await adminClient
    .from("tasks")
    .insert({
      project_id: testProj.id,
      title: "Design Instagram Post",
      task_type: "GRAPHIC_DESIGN",
      priority: "HIGH",
      status: "IN_PROGRESS",
      current_assignee_id: designerId,
      deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
    })
    .select()
    .single();

  if (taskErr || !testTask) throw new Error(`Failed to create test task: ${taskErr?.message}`);

  try {
    // TEST A: SMS attempts to allocate deliverable upload -> MUST FAIL
    console.log("   [Test A] SMS calling allocate_deliverable_upload...");
    const { error: smsAllocErr } = await smsAuth.rpc("allocate_deliverable_upload", {
      p_task_id: testTask.id,
      p_file_name: "sms_unauthorized.png",
      p_file_size_bytes: 1024,
      p_mime_type: "image/png",
      p_file_type: "DESIGN",
    });

    if (!smsAllocErr) {
      throw new Error("SECURITY FAILURE: SMS was able to allocate deliverable upload!");
    }
    console.log("   [PASS] SMS allocation blocked:", smsAllocErr.message);

    // TEST B: Assigned Designer attempts to allocate deliverable upload -> MUST SUCCEED
    console.log("   [Test B] Assigned Designer calling allocate_deliverable_upload...");
    const { data: allocData, error: designerAllocErr } = await designerAuth.rpc(
      "allocate_deliverable_upload",
      {
        p_task_id: testTask.id,
        p_file_name: "designer_artwork_v1.png",
        p_file_size_bytes: 2048,
        p_mime_type: "image/png",
        p_file_type: "DESIGN",
      }
    );

    if (designerAllocErr || !allocData) {
      throw new Error(`Creative allocation failed: ${designerAllocErr?.message}`);
    }
    console.log("   [PASS] Designer allocation succeeded, version:", allocData.version);

    // TEST C: SMS attempts to commit deliverable file -> MUST FAIL
    console.log("   [Test C] SMS calling commit_deliverable_file...");
    const { error: smsCommitErr } = await smsAuth.rpc("commit_deliverable_file", {
      p_file_id: allocData.file_id,
      p_task_id: testTask.id,
      p_asset_group_id: allocData.asset_group_id,
      p_version: allocData.version,
      p_storage_path: allocData.storage_path,
      p_file_name: "sms_fake.png",
      p_file_type: "DESIGN",
      p_mime_type: "image/png",
      p_file_size_bytes: 1024,
    });

    if (!smsCommitErr) {
      throw new Error("SECURITY FAILURE: SMS was able to commit deliverable file!");
    }
    console.log("   [PASS] SMS commit blocked:", smsCommitErr.message);

    // TEST D: Assigned Designer commits deliverable file -> MUST SUCCEED
    console.log("   [Test D] Designer calling commit_deliverable_file...");
    const { data: fileId, error: commitErr } = await designerAuth.rpc(
      "commit_deliverable_file",
      {
        p_file_id: allocData.file_id,
        p_task_id: testTask.id,
        p_asset_group_id: allocData.asset_group_id,
        p_version: allocData.version,
        p_storage_path: allocData.storage_path,
        p_file_name: "designer_artwork_v1.png",
        p_file_type: "DESIGN",
        p_mime_type: "image/png",
        p_file_size_bytes: 2048,
      }
    );

    if (commitErr || !fileId) {
      throw new Error(`Creative commit failed: ${commitErr?.message}`);
    }
    console.log("   [PASS] Designer commit succeeded, file id:", fileId);

    // TEST E: SMS attempts to soft delete committed deliverable -> MUST FAIL
    console.log("   [Test E] SMS calling soft_delete_project_file...");
    const { error: smsDelErr } = await smsAuth.rpc("soft_delete_project_file", {
      p_file_id: fileId,
    });

    if (!smsDelErr) {
      throw new Error("SECURITY FAILURE: SMS was able to soft delete deliverable file!");
    }
    console.log("   [PASS] SMS soft delete blocked:", smsDelErr.message);

    // TEST F: SMS attempts to transition task to IN_REVIEW -> MUST FAIL
    console.log("   [Test F] SMS calling transition_task_status to IN_REVIEW...");
    const { error: smsReviewErr } = await smsAuth.rpc("transition_task_status", {
      p_task_id: testTask.id,
      p_new_status: "IN_REVIEW",
    });

    if (!smsReviewErr) {
      throw new Error("SECURITY FAILURE: SMS was able to transition task to IN_REVIEW!");
    }
    console.log("   [PASS] SMS IN_REVIEW transition blocked:", smsReviewErr.message);

    // TEST G: Assigned Designer transitions task to IN_REVIEW -> MUST SUCCEED
    console.log("   [Test G] Designer calling transition_task_status to IN_REVIEW...");
    const { data: updatedStatus, error: designerReviewErr } = await designerAuth.rpc(
      "transition_task_status",
      {
        p_task_id: testTask.id,
        p_new_status: "IN_REVIEW",
      }
    );

    if (designerReviewErr) {
      throw new Error(`Designer IN_REVIEW transition failed: ${designerReviewErr?.message}`);
    }
    console.log("   [PASS] Designer IN_REVIEW transition succeeded, status:", updatedStatus);
  } finally {
    // Cleanup test data
    console.log("\n4. Cleaning up test data...");
    await adminClient.from("tasks").delete().eq("project_id", testProj.id);
    await adminClient.from("projects").delete().eq("id", testProj.id);
    console.log("   Cleanup completed.");
  }

  console.log("\n=== ALL REGRESSION TESTS PASSED WITH ZERO FAILURES ===");
}

runVerification().catch((err) => {
  console.error("\n[VERIFICATION FAILED]:", err);
  process.exit(1);
});
