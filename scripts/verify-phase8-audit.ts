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

async function runPhase8AuditVerification() {
  console.log("===============================================================================");
  console.log("LOCO TRACK - Phase 8.1 Storage & Deliverable Integrity Audit Test Suite");
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

  const { data: brand } = await adminClient
    .from("brands")
    .select("id, client_id")
    .limit(1)
    .single();

  if (!brand) throw new Error("No active brand found for testing");

  // Create Project Alpha (owned by smsAuth)
  const { data: pAlphaData, error: pAlphaErr } = await smsAuth.client.rpc("create_project", {
    p_brand_id: brand.id,
    p_name: "Phase 8.1 Audit Project Alpha",
    p_description: "Audit Project for Phase 8.1 Integrity",
    p_priority: "HIGH",
    p_start_date: new Date().toISOString().split("T")[0],
    p_deadline: new Date(Date.now() + 86400000 * 14).toISOString(),
    p_sms_owner_id: smsAuth.user.id,
  });
  if (pAlphaErr || !pAlphaData) throw new Error(`Failed to create Project Alpha: ${pAlphaErr?.message}`);
  const projectAlphaId = (pAlphaData as { id: string }).id;

  // Add Designer to Project Alpha roster
  const { error: pmErr } = await adminClient.from("project_members").insert({
    project_id: projectAlphaId,
    user_id: designerAuth.user.id,
  });
  if (pmErr) throw new Error(`Failed to add Designer to project_members: ${pmErr.message}`);

  // Create Project Beta (owned by sms2Auth) for cross-project isolation tests
  const { data: pBetaData, error: pBetaErr } = await sms2Auth.client.rpc("create_project", {
    p_brand_id: brand.id,
    p_name: "Phase 8.1 Audit Project Beta",
    p_description: "Project Beta for Isolation Testing",
    p_priority: "MEDIUM",
    p_start_date: new Date().toISOString().split("T")[0],
    p_deadline: new Date(Date.now() + 86400000 * 14).toISOString(),
    p_sms_owner_id: sms2Auth.user.id,
  });
  if (pBetaErr || !pBetaData) throw new Error(`Failed to create Project Beta: ${pBetaErr?.message}`);
  const projectBetaId = (pBetaData as { id: string }).id;

  // Create Task 1 on Project Alpha assigned to Designer
  const { data: task1, error: task1Err } = await adminClient
    .from("tasks")
    .insert({
      project_id: projectAlphaId,
      title: "Design Audit Deliverable",
      task_type: "GRAPHIC_DESIGN",
      current_assignee_id: designerAuth.user.id,
      status: "IN_PROGRESS",
      priority: "HIGH",
      deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
    })
    .select("id")
    .single();
  if (task1Err) throw new Error(`Failed to create Task 1: ${task1Err.message}`);
  const task1Id = task1.id;

  // =========================================================================
  // 1. COMMITTED STORAGE OBJECT DIRECT DELETE BYPASS
  // =========================================================================
  console.log("1. Verifying Committed Storage Object Direct Delete Bypass...");

  // Upload and commit v1 by Designer
  const { data: alloc1, error: allocErr1 } = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: task1Id,
    p_file_name: "audit_banner_v1.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 4096,
    p_file_type: "DESIGN",
  });
  assert(allocErr1 === null, "Committed Delete Bypass", "Allocate v1 by Designer", "Success", allocErr1 ? allocErr1.message : "Success");

  const v1Binary = Buffer.from("PNG_BINARY_AUDIT_V1");
  const { error: upErr1 } = await designerAuth.client.storage
    .from(alloc1.storage_bucket)
    .upload(alloc1.storage_path, v1Binary, { contentType: alloc1.mime_type, upsert: false });
  assert(upErr1 === null, "Committed Delete Bypass", "Upload v1 to storage", "Success", upErr1 ? upErr1.message : "Success");

  const { data: commit1Id, error: commitErr1 } = await designerAuth.client.rpc("commit_deliverable_file", {
    p_file_id: alloc1.file_id,
    p_task_id: task1Id,
    p_asset_group_id: alloc1.asset_group_id,
    p_version: 1,
    p_storage_path: alloc1.storage_path,
    p_file_name: alloc1.file_name,
    p_file_type: alloc1.file_type,
    p_mime_type: alloc1.mime_type,
    p_file_size_bytes: alloc1.file_size_bytes,
  });
  assert(commitErr1 === null, "Committed Delete Bypass", "Commit v1 metadata", "Success", commitErr1 ? commitErr1.message : "Success");

  // TEST: Creative A (uploader) attempts direct Storage DELETE on committed object -> MUST FAIL
  const { data: uploaderDelRes, error: uploaderDelErr } = await designerAuth.client.storage
    .from("project-deliverables")
    .remove([alloc1.storage_path]);
  const uploaderBypassBlocked = uploaderDelErr !== null || (Array.isArray(uploaderDelRes) && uploaderDelRes.length === 0);
  assert(
    uploaderBypassBlocked,
    "Committed Delete Bypass",
    "Uploader direct Storage DELETE on committed file is blocked",
    "Blocked by Storage RLS",
    uploaderBypassBlocked ? "Blocked by Storage RLS" : "Allowed"
  );

  // Verify file still exists in storage
  const { data: checkDown1, error: checkDownErr1 } = await adminClient.storage
    .from("project-deliverables")
    .download(alloc1.storage_path);
  assert(
    checkDownErr1 === null && checkDown1 !== null,
    "Committed Delete Bypass",
    "Committed object intact in storage",
    "Intact",
    checkDownErr1 === null ? "Intact" : "Deleted / Missing"
  );

  // TEST: Unassigned Creative (Editor) direct Storage DELETE -> MUST FAIL
  const { data: editorDelRes, error: editorDelErr } = await editorAuth.client.storage
    .from("project-deliverables")
    .remove([alloc1.storage_path]);
  const editorBlocked = editorDelErr !== null || (Array.isArray(editorDelRes) && editorDelRes.length === 0);
  assert(editorBlocked, "Committed Delete Bypass", "Unassigned Creative direct DELETE blocked", "Blocked", "Blocked");

  // TEST: Account Executive direct Storage DELETE -> MUST FAIL
  const { data: aeDelRes, error: aeDelErr } = await aeAuth.client.storage
    .from("project-deliverables")
    .remove([alloc1.storage_path]);
  const aeBlocked = aeDelErr !== null || (Array.isArray(aeDelRes) && aeDelRes.length === 0);
  assert(aeBlocked, "Committed Delete Bypass", "AE direct DELETE on committed file blocked", "Blocked", "Blocked");

  // TEST: Creative Director direct Storage DELETE -> MUST FAIL
  const { data: cdDelRes, error: cdDelErr } = await cdAuth.client.storage
    .from("project-deliverables")
    .remove([alloc1.storage_path]);
  const cdBlocked = cdDelErr !== null || (Array.isArray(cdDelRes) && cdDelRes.length === 0);
  assert(cdBlocked, "Committed Delete Bypass", "CD direct DELETE on committed file blocked", "Blocked", "Blocked");

  // TEST: Non-Owner SMS direct Storage DELETE -> MUST FAIL
  const { data: nonOwnerDelRes, error: nonOwnerDelErr } = await sms2Auth.client.storage
    .from("project-deliverables")
    .remove([alloc1.storage_path]);
  const nonOwnerBlocked = nonOwnerDelErr !== null || (Array.isArray(nonOwnerDelRes) && nonOwnerDelRes.length === 0);
  assert(nonOwnerBlocked, "Committed Delete Bypass", "Non-owner SMS direct DELETE blocked", "Blocked", "Blocked");

  // =========================================================================
  // 2. COMPENSATION DELETE ON UNCOMMITTED OBJECT
  // =========================================================================
  console.log("\n2. Verifying Compensation Delete on Uncommitted Objects...");

  // Allocate v2, upload to storage, but DO NOT commit
  const { data: allocUncommitted, error: allocUncommittedErr } = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: task1Id,
    p_file_name: "uncommitted_orphan.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 2048,
    p_file_type: "DESIGN",
  });
  assert(allocUncommittedErr === null, "Compensation Delete", "Allocate uncommitted upload", "Success", "Success");

  const orphanBinary = Buffer.from("ORPHAN_BINARY");
  await designerAuth.client.storage
    .from("project-deliverables")
    .upload(allocUncommitted.storage_path, orphanBinary, { contentType: "image/png", upsert: false });

  // TEST: Unauthorized role (Editor) attempts compensation delete on Designer's uncommitted object -> MUST FAIL
  const { data: editorCompRes, error: editorCompErr } = await editorAuth.client.storage
    .from("project-deliverables")
    .remove([allocUncommitted.storage_path]);
  const editorCompBlocked = editorCompErr !== null || (Array.isArray(editorCompRes) && editorCompRes.length === 0);
  assert(editorCompBlocked, "Compensation Delete", "Unassigned creative cannot purge another user's orphan", "Blocked", "Blocked");

  // TEST: Authorized uploader (Designer) executes compensation delete on own uncommitted object -> SUCCEEDS
  const { data: uploaderCompRes, error: uploaderCompErr } = await designerAuth.client.storage
    .from("project-deliverables")
    .remove([allocUncommitted.storage_path]);
  const uploaderCompSuccess = uploaderCompErr === null && Array.isArray(uploaderCompRes) && uploaderCompRes.length > 0;
  assert(uploaderCompSuccess, "Compensation Delete", "Uploader successfully purges own uncommitted orphan", "Success", "Orphan purged");

  // =========================================================================
  // 3. SOFT-DELETED FILE READ BLOCK AT STORAGE LAYER
  // =========================================================================
  console.log("\n3. Verifying Soft-Deleted File Read Block at Storage Layer...");

  // Soft-delete v1 using approved RPC
  const { error: softDelErr } = await designerAuth.client.rpc("soft_delete_project_file", {
    p_file_id: commit1Id,
  });
  assert(softDelErr === null, "Soft-Deleted Read Block", "Soft delete v1 metadata", "Success", softDelErr ? softDelErr.message : "Success");

  // TEST: Direct Storage download by uploader (Designer) -> MUST FAIL / return error
  const { data: directDl, error: directDlErr } = await designerAuth.client.storage
    .from("project-deliverables")
    .download(alloc1.storage_path);
  assert(
    directDlErr !== null || directDl === null,
    "Soft-Deleted Read Block",
    "Direct Storage download for soft-deleted file is denied to uploader",
    "Error / Denied",
    directDlErr ? directDlErr.message : "Denied"
  );

  // TEST: Direct Storage createSignedUrl by user-scoped client -> MUST FAIL / return error
  const { data: userSigned, error: userSignedErr } = await designerAuth.client.storage
    .from("project-deliverables")
    .createSignedUrl(alloc1.storage_path, 900);
  assert(
    userSignedErr !== null || !userSigned?.signedUrl,
    "Soft-Deleted Read Block",
    "User-scoped client createSignedUrl on soft-deleted file is denied",
    "Denied",
    userSignedErr ? userSignedErr.message : "Denied"
  );

  // TEST: Guessed canonical path access by other project member -> MUST FAIL
  const { data: guessedDl, error: guessedDlErr } = await cdAuth.client.storage
    .from("project-deliverables")
    .download(alloc1.storage_path);
  assert(
    guessedDlErr !== null || guessedDl === null,
    "Soft-Deleted Read Block",
    "Guessed canonical path download on soft-deleted file is denied to CD",
    "Error / Denied",
    guessedDlErr ? guessedDlErr.message : "Denied"
  );

  // =========================================================================
  // 4. IN_REVIEW LAST-DELIVERABLE INVARIANT
  // =========================================================================
  console.log("\n4. Verifying IN_REVIEW Last-Deliverable Invariant...");

  // Upload v2 to task1 so we have an active deliverable
  const { data: alloc2, error: alloc2Err } = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: task1Id,
    p_file_name: "audit_banner_v2.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 4096,
    p_file_type: "DESIGN",
  });
  assert(alloc2Err === null, "IN_REVIEW Last Deliverable", "Allocate v2", "Success", "Success");

  await designerAuth.client.storage
    .from(alloc2.storage_bucket)
    .upload(alloc2.storage_path, Buffer.from("V2_BINARY"), { contentType: "image/png", upsert: false });

  const { data: commit2Id, error: commit2Err } = await designerAuth.client.rpc("commit_deliverable_file", {
    p_file_id: alloc2.file_id,
    p_task_id: task1Id,
    p_asset_group_id: alloc2.asset_group_id,
    p_version: alloc2.version,
    p_storage_path: alloc2.storage_path,
    p_file_name: alloc2.file_name,
    p_file_type: alloc2.file_type,
    p_mime_type: alloc2.mime_type,
    p_file_size_bytes: alloc2.file_size_bytes,
  });
  assert(commit2Err === null, "IN_REVIEW Last Deliverable", "Commit v2 metadata", "Success", "Success");

  // Submit task1 to IN_REVIEW
  const { error: reviewSubmitErr } = await designerAuth.client.rpc("transition_task_status", {
    p_task_id: task1Id,
    p_new_status: "IN_REVIEW",
  });
  assert(reviewSubmitErr === null, "IN_REVIEW Last Deliverable", "Submit task to IN_REVIEW", "Success", "Success");

  // TEST: Creative attempts soft-delete while in IN_REVIEW -> MUST FAIL
  const { error: creativeReviewDelErr } = await designerAuth.client.rpc("soft_delete_project_file", {
    p_file_id: commit2Id,
  });
  assert(
    creativeReviewDelErr !== null && (creativeReviewDelErr.message.includes("Cannot delete deliverable file after submission to review") || creativeReviewDelErr.message.includes("Cannot soft-delete the current review deliverable")),
    "IN_REVIEW Last Deliverable",
    "Creative cannot soft-delete deliverable while in review",
    "Cannot delete deliverable file after submission to review",
    creativeReviewDelErr ? creativeReviewDelErr.message : "Allowed"
  );

  // TEST: Owning SMS attempts soft-delete on the ONLY active deliverable -> MUST FAIL
  const { error: smsLastDelErr } = await smsAuth.client.rpc("soft_delete_project_file", {
    p_file_id: commit2Id,
  });
  assert(
    smsLastDelErr !== null && (smsLastDelErr.message.includes("Cannot delete the only remaining deliverable file while task is in review") || smsLastDelErr.message.includes("Cannot soft-delete the current review deliverable")),
    "IN_REVIEW Last Deliverable",
    "Owning SMS cannot delete only active deliverable in review",
    "Cannot delete the only remaining deliverable file while task is in review",
    smsLastDelErr ? smsLastDelErr.message : "Allowed"
  );

  // TEST: Admin attempts soft-delete on the ONLY active deliverable -> MUST FAIL
  const { error: adminLastDelErr } = await adminAuth.client.rpc("soft_delete_project_file", {
    p_file_id: commit2Id,
  });
  assert(
    adminLastDelErr !== null && (adminLastDelErr.message.includes("Cannot delete the only remaining deliverable file while task is in review") || adminLastDelErr.message.includes("Cannot soft-delete the current review deliverable")),
    "IN_REVIEW Last Deliverable",
    "Admin cannot delete only active deliverable in review",
    "Cannot delete the only remaining deliverable file while task is in review",
    adminLastDelErr ? adminLastDelErr.message : "Allowed"
  );

  // Now test multiple active versions:
  // Reopen task to IN_PROGRESS, upload v3, return to IN_REVIEW (so we have v2 and v3 active)
  await adminClient.from("tasks").update({ status: "IN_PROGRESS" }).eq("id", task1Id);

  const { data: alloc3 } = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: task1Id,
    p_file_name: "audit_banner_v3.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 4096,
    p_file_type: "DESIGN",
  });
  await designerAuth.client.storage.from("project-deliverables").upload(alloc3.storage_path, Buffer.from("V3_BINARY"));
  const { data: commit3Id } = await designerAuth.client.rpc("commit_deliverable_file", {
    p_file_id: alloc3.file_id,
    p_task_id: task1Id,
    p_asset_group_id: alloc3.asset_group_id,
    p_version: alloc3.version,
    p_storage_path: alloc3.storage_path,
    p_file_name: alloc3.file_name,
    p_file_type: alloc3.file_type,
    p_mime_type: alloc3.mime_type,
    p_file_size_bytes: alloc3.file_size_bytes,
  });

  // Return to IN_REVIEW
  await designerAuth.client.rpc("transition_task_status", { p_task_id: task1Id, p_new_status: "IN_REVIEW" });

  // TEST: SMS Owner soft-deletes historical active version v2 (since v3 remains active) -> SUCCEEDS
  const { error: smsDelHistErr } = await smsAuth.client.rpc("soft_delete_project_file", {
    p_file_id: commit2Id,
  });
  assert(smsDelHistErr === null, "IN_REVIEW Last Deliverable", "Owning SMS can soft-delete older version when active version remains", "Success", "Success");

  // TEST: SMS Owner now attempts to soft-delete v3 (the last active remaining) -> MUST FAIL
  const { error: smsDelLastV3Err } = await smsAuth.client.rpc("soft_delete_project_file", {
    p_file_id: commit3Id,
  });
  assert(
    smsDelLastV3Err !== null && (smsDelLastV3Err.message.includes("Cannot delete the only remaining deliverable file while task is in review") || smsDelLastV3Err.message.includes("Cannot soft-delete the current review deliverable")),
    "IN_REVIEW Last Deliverable",
    "SMS Owner cannot delete last remaining version v3 in review",
    "Blocked",
    smsDelLastV3Err ? smsDelLastV3Err.message : "Allowed"
  );

  // =========================================================================
  // 5. IN_REVIEW FILE IMMUTABILITY & UPLOAD FREEZE
  // =========================================================================
  console.log("\n5. Verifying IN_REVIEW File Immutability & Upload Freeze...");

  // Task is currently in IN_REVIEW
  // TEST: Creative allocate upload -> MUST FAIL
  const { error: creativeRevAllocErr } = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: task1Id,
    p_file_name: "attempt_during_review.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 1024,
    p_file_type: "DESIGN",
  });
  assert(
    creativeRevAllocErr !== null && creativeRevAllocErr.message.includes("Uploads are frozen while task is in review"),
    "IN_REVIEW Immutability",
    "Creative cannot allocate upload while in review",
    "Uploads are frozen while task is in review",
    creativeRevAllocErr ? creativeRevAllocErr.message : "Allowed"
  );

  // TEST: Owning SMS allocate upload -> MUST FAIL
  const { error: smsRevAllocErr } = await smsAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: task1Id,
    p_file_name: "sms_attempt_during_review.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 1024,
    p_file_type: "DESIGN",
  });
  assert(
    smsRevAllocErr !== null && smsRevAllocErr.message.includes("Uploads are frozen while task is in review"),
    "IN_REVIEW Immutability",
    "SMS Owner cannot allocate upload while in review",
    "Uploads are frozen while task is in review",
    smsRevAllocErr ? smsRevAllocErr.message : "Allowed"
  );

  // TEST: Admin allocate upload -> MUST FAIL
  const { error: adminRevAllocErr } = await adminAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: task1Id,
    p_file_name: "admin_attempt_during_review.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 1024,
    p_file_type: "DESIGN",
  });
  assert(
    adminRevAllocErr !== null && adminRevAllocErr.message.includes("Uploads are frozen while task is in review"),
    "IN_REVIEW Immutability",
    "Admin cannot allocate upload while in review",
    "Uploads are frozen while task is in review",
    adminRevAllocErr ? adminRevAllocErr.message : "Allowed"
  );

  // TEST: Direct Storage INSERT by Creative on task in review -> MUST FAIL (Storage RLS)
  const fakeReviewPath = `${projectAlphaId}/${task1Id}/${alloc1.asset_group_id}/v99/bypass.png`;
  const { error: storageBypassErr } = await designerAuth.client.storage
    .from("project-deliverables")
    .upload(fakeReviewPath, Buffer.from("BYPASS"), { contentType: "image/png", upsert: false });
  assert(
    storageBypassErr !== null,
    "IN_REVIEW Immutability",
    "Storage RLS blocks direct write during IN_REVIEW",
    "RLS Error",
    storageBypassErr ? storageBypassErr.message : "Allowed"
  );

  // =========================================================================
  // 6. CONCURRENT VERSION ALLOCATION REAL TEST
  // =========================================================================
  console.log("\n6. Verifying Concurrent Version Allocation Race & Compensation...");

  // Reopen task to IN_PROGRESS
  await adminClient.from("tasks").update({ status: "IN_PROGRESS" }).eq("id", task1Id);

  // Run two allocations concurrently via Promise.all
  const [concAllocA, concAllocB] = await Promise.all([
    designerAuth.client.rpc("allocate_deliverable_upload", {
      p_task_id: task1Id,
      p_file_name: "concurrent_banner_a.png",
      p_mime_type: "image/png",
      p_file_size_bytes: 2048,
      p_file_type: "DESIGN",
    }),
    designerAuth.client.rpc("allocate_deliverable_upload", {
      p_task_id: task1Id,
      p_file_name: "concurrent_banner_b.png",
      p_mime_type: "image/png",
      p_file_size_bytes: 2048,
      p_file_type: "DESIGN",
    }),
  ]);

  assert(concAllocA.error === null && concAllocB.error === null, "Concurrency Race", "Both concurrent allocations succeed RPC call", "Success", "Both returned allocations");

  // In the race condition:
  // If Client A uploads to storage and commits first
  const fileABuffer = Buffer.from("BINARY_A");
  await designerAuth.client.storage.from("project-deliverables").upload(concAllocA.data.storage_path, fileABuffer);

  const { error: commitAErr } = await designerAuth.client.rpc("commit_deliverable_file", {
    p_file_id: concAllocA.data.file_id,
    p_task_id: task1Id,
    p_asset_group_id: concAllocA.data.asset_group_id,
    p_version: concAllocA.data.version,
    p_storage_path: concAllocA.data.storage_path,
    p_file_name: concAllocA.data.file_name,
    p_file_type: concAllocA.data.file_type,
    p_mime_type: concAllocA.data.mime_type,
    p_file_size_bytes: concAllocA.data.file_size_bytes,
  });
  assert(commitAErr === null, "Concurrency Race", "Client A commits successfully", "Success", "Committed");

  // If Client B attempted to commit with the same version as A (simulating contention collision):
  if (concAllocB.data.version === concAllocA.data.version) {
    const { error: commitBErr } = await designerAuth.client.rpc("commit_deliverable_file", {
      p_file_id: concAllocB.data.file_id,
      p_task_id: task1Id,
      p_asset_group_id: concAllocB.data.asset_group_id,
      p_version: concAllocB.data.version,
      p_storage_path: concAllocB.data.storage_path,
      p_file_name: concAllocB.data.file_name,
      p_file_type: concAllocB.data.file_type,
      p_mime_type: concAllocB.data.mime_type,
      p_file_size_bytes: concAllocB.data.file_size_bytes,
    });
    assert(commitBErr !== null, "Concurrency Race", "Client B version collision is rejected by unique constraint / version check", "Rejected", commitBErr ? commitBErr.message : "Allowed");

    // Client B retries allocation after collision -> cleanly gets next sequential version
    const { data: retryAllocB, error: retryErr } = await designerAuth.client.rpc("allocate_deliverable_upload", {
      p_task_id: task1Id,
      p_file_name: "concurrent_banner_b.png",
      p_mime_type: "image/png",
      p_file_size_bytes: 2048,
      p_file_type: "DESIGN",
    });
    assert(retryErr === null && retryAllocB.version === concAllocA.data.version + 1, "Concurrency Race", "Client B retry yields next sequential version", "Sequential Version", `v${retryAllocB?.version}`);
  } else {
    // Both were serialized cleanly into sequential versions
    assert(concAllocB.data.version !== concAllocA.data.version, "Concurrency Race", "Serial allocation yielded distinct versions", "Distinct", `A: v${concAllocA.data.version}, B: v${concAllocB.data.version}`);
  }

  // =========================================================================
  // 7. VERSION DELETION SEMANTICS & LINEAGE PRESERVATION
  // =========================================================================
  console.log("\n7. Verifying Version Deletion Semantics & Lineage Preservation...");

  // Fetch all existing files for task1
  const { data: taskFiles } = await adminClient
    .from("project_files")
    .select("id, version, asset_group_id")
    .eq("task_id", task1Id)
    .order("version", { ascending: false });

  const maxVersionBefore = taskFiles && taskFiles.length > 0 ? taskFiles[0].version : 0;
  const commonAssetGroup = taskFiles && taskFiles.length > 0 ? taskFiles[0].asset_group_id : "";

  // Soft-delete ALL existing files for task1
  if (taskFiles) {
    for (const f of taskFiles) {
      await adminClient.from("project_files").update({ deleted_at: new Date().toISOString() }).eq("id", f.id);
    }
  }

  // Allocate next upload after all files are soft-deleted
  const { data: allocPostPurge, error: postPurgeErr } = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: task1Id,
    p_file_name: "fresh_after_purge.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 1024,
    p_file_type: "DESIGN",
  });
  assert(postPurgeErr === null, "Version Deletion Semantics", "Allocation succeeds when all previous versions are soft-deleted", "Success", "Success");
  assert(
    allocPostPurge.asset_group_id === commonAssetGroup,
    "Version Deletion Semantics",
    "Asset group lineage preserved after soft-deleting all previous versions",
    commonAssetGroup,
    allocPostPurge.asset_group_id
  );
  assert(
    allocPostPurge.version === maxVersionBefore + 1,
    "Version Deletion Semantics",
    "Version monotonicity preserved (max_version + 1), soft-deleted versions consumed",
    `${maxVersionBefore + 1}`,
    `${allocPostPurge.version}`
  );

  // =========================================================================
  // 8. FILE METADATA IMMUTABILITY
  // =========================================================================
  console.log("\n8. Verifying File Metadata Immutability...");

  // Upload and commit v_post
  await designerAuth.client.storage.from("project-deliverables").upload(allocPostPurge.storage_path, Buffer.from("POST_PURGE"));
  await designerAuth.client.rpc("commit_deliverable_file", {
    p_file_id: allocPostPurge.file_id,
    p_task_id: task1Id,
    p_asset_group_id: allocPostPurge.asset_group_id,
    p_version: allocPostPurge.version,
    p_storage_path: allocPostPurge.storage_path,
    p_file_name: allocPostPurge.file_name,
    p_file_type: allocPostPurge.file_type,
    p_mime_type: allocPostPurge.mime_type,
    p_file_size_bytes: allocPostPurge.file_size_bytes,
  });

  // TEST: Direct SQL update of project_id -> MUST FAIL
  const { error: mutProjectErr } = await designerAuth.client
    .from("project_files")
    .update({ project_id: projectBetaId })
    .eq("id", allocPostPurge.file_id);
  assert(mutProjectErr !== null, "Metadata Immutability", "Direct UPDATE of project_id is blocked", "Blocked", mutProjectErr ? mutProjectErr.message : "Allowed");

  // TEST: Direct SQL update of version -> MUST FAIL
  const { error: mutVersionErr } = await designerAuth.client
    .from("project_files")
    .update({ version: 999 })
    .eq("id", allocPostPurge.file_id);
  assert(mutVersionErr !== null, "Metadata Immutability", "Direct UPDATE of version is blocked", "Blocked", mutVersionErr ? mutVersionErr.message : "Allowed");

  // TEST: Direct SQL update of storage_path -> MUST FAIL
  const { error: mutPathErr } = await designerAuth.client
    .from("project_files")
    .update({ storage_path: "fake/path/bypass.png" })
    .eq("id", allocPostPurge.file_id);
  assert(mutPathErr !== null, "Metadata Immutability", "Direct UPDATE of storage_path is blocked", "Blocked", mutPathErr ? mutPathErr.message : "Allowed");

  // TEST: Direct SQL update of uploaded_by -> MUST FAIL
  const { error: mutUploaderErr } = await designerAuth.client
    .from("project_files")
    .update({ uploaded_by: adminAuth.user.id })
    .eq("id", allocPostPurge.file_id);
  assert(mutUploaderErr !== null, "Metadata Immutability", "Direct UPDATE of uploaded_by is blocked", "Blocked", mutUploaderErr ? mutUploaderErr.message : "Allowed");

  // =========================================================================
  // 9. CROSS-PROJECT STORAGE ISOLATION
  // =========================================================================
  console.log("\n9. Verifying Cross-Project Storage Isolation & Roster Bounds...");

  // Create Task Beta on Project Beta
  const { data: taskBeta } = await adminClient
    .from("tasks")
    .insert({
      project_id: projectBetaId,
      title: "Project Beta Task",
      task_type: "GRAPHIC_DESIGN",
      current_assignee_id: editorAuth.user.id,
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      deadline: new Date(Date.now() + 86400000 * 5).toISOString(),
    })
    .select("id")
    .single();

  if (!taskBeta) {
    throw new Error("Failed to create taskBeta");
  }

  // Editor uploads file to Project Beta
  const { data: allocBeta } = await editorAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskBeta.id,
    p_file_name: "beta_file.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 2048,
    p_file_type: "DESIGN",
  });
  await editorAuth.client.storage.from("project-deliverables").upload(allocBeta.storage_path, Buffer.from("BETA_DATA"));
  await editorAuth.client.rpc("commit_deliverable_file", {
    p_file_id: allocBeta.file_id,
    p_task_id: taskBeta.id,
    p_asset_group_id: allocBeta.asset_group_id,
    p_version: allocBeta.version,
    p_storage_path: allocBeta.storage_path,
    p_file_name: allocBeta.file_name,
    p_file_type: allocBeta.file_type,
    p_mime_type: allocBeta.mime_type,
    p_file_size_bytes: allocBeta.file_size_bytes,
  });

  // TEST: Designer (member only of Project Alpha) lists Project Beta folder in storage -> MUST FAIL / empty
  const { data: betaList, error: betaListErr } = await designerAuth.client.storage
    .from("project-deliverables")
    .list(`${projectBetaId}/${taskBeta.id}`);
  const listDenied = betaListErr !== null || (Array.isArray(betaList) && betaList.length === 0);
  assert(listDenied, "Cross-Project Isolation", "Designer cannot enumerate Project Beta storage folder", "Denied / Empty", "0 items visible");

  // TEST: Designer attempts direct download of guessed Project Beta storage path -> MUST FAIL
  const { data: guessedBetaDl, error: guessedBetaDlErr } = await designerAuth.client.storage
    .from("project-deliverables")
    .download(allocBeta.storage_path);
  assert(
    guessedBetaDlErr !== null || guessedBetaDl === null,
    "Cross-Project Isolation",
    "Designer cannot download guessed Project Beta storage path",
    "Denied",
    guessedBetaDlErr ? guessedBetaDlErr.message : "Denied"
  );

  // =========================================================================
  // 10. CLEANUP TEST DATA
  // =========================================================================
  console.log("\n--- Cleaning up audit test data ---");
  await adminClient.from("projects").delete().eq("id", projectAlphaId);
  await adminClient.from("projects").delete().eq("id", projectBetaId);

  // Summary
  console.log("\n===============================================================================");
  console.log(`Phase 8.1 Audit Verification Summary: ${totalPassed} Passed, ${totalFailed} Failed`);
  console.log("===============================================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runPhase8AuditVerification().catch((err) => {
  console.error("Phase 8.1 Verification crashed with error:", err);
  process.exit(1);
});
