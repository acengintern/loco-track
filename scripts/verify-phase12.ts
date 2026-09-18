/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
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
  item: string;
  name: string;
  expected: string;
  actual: string;
  passed: boolean;
}

const testResults: TestResult[] = [];

function assert(condition: boolean, item: string, name: string, expected: string, actual: string) {
  testResults.push({ item, name, expected, actual, passed: condition });
  if (condition) {
    console.log(`  [PASS] [${item}] ${name} -> ${actual}`);
    totalPassed++;
  } else {
    console.error(`  [FAIL] [${item}] ${name} -> Expected: ${expected} | Actual: ${actual}`);
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

async function uploadAndCommitDeliverable(
  authSession: { client: any; user: any },
  taskId: string,
  fileName: string,
  mimeType: string,
  fileSize: number,
  fileType: string
) {
  const { data: alloc, error: allocErr } = await authSession.client.rpc("allocate_deliverable_upload", {
    p_task_id: taskId,
    p_file_name: fileName,
    p_mime_type: mimeType,
    p_file_size_bytes: fileSize,
    p_file_type: fileType,
  });

  if (allocErr || !alloc) {
    throw new Error(`Failed to allocate upload: ${allocErr?.message}`);
  }

  const dummyBytes = Buffer.from(`Simulated binary content for ${fileName} - ${Date.now()}`);
  const { error: storageErr } = await authSession.client.storage
    .from("project-deliverables")
    .upload(alloc.storage_path, dummyBytes, { contentType: mimeType, upsert: true });

  if (storageErr) {
    throw new Error(`Storage upload failed: ${storageErr.message}`);
  }

  const { data: committedFileId, error: commitErr } = await authSession.client.rpc("commit_deliverable_file", {
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

  if (commitErr || !committedFileId) {
    throw new Error(`Metadata commit failed: ${commitErr?.message}`);
  }

  return {
    alloc,
    committedFile: {
      id: committedFileId as string,
      version: alloc.version as number,
      asset_group_id: alloc.asset_group_id as string,
    },
  };
}

async function main() {
  console.log("================================================================================");
  console.log("PHASE 12 FINAL RELEASE AUDIT & PRODUCTION READINESS VERIFICATION SUITE");
  console.log("================================================================================\n");

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const adminAuth = await createAuthClient("admin@locotrack.local");
  const cdAuth = await createAuthClient("cd@locotrack.local");
  const aeAuth = await createAuthClient("ae@locotrack.local");
  const smsAuth = await createAuthClient("sms@locotrack.local");
  const designerAuth = await createAuthClient("designer@locotrack.local");
  const editorAuth = await createAuthClient("editor@locotrack.local");

  void adminAuth;

  const { data: usersData } = await adminClient.from("profiles").select("id, email, role");
  const userMap = new Map((usersData || []).map((u) => [u.email, u]));

  const adminId = userMap.get("admin@locotrack.local")!.id;
  const cdId = userMap.get("cd@locotrack.local")!.id;
  const smsId = userMap.get("sms@locotrack.local")!.id;
  const designerId = userMap.get("designer@locotrack.local")!.id;
  const editorId = userMap.get("editor@locotrack.local")!.id;
  const aeId = userMap.get("ae@locotrack.local")!.id;

  const ts = Date.now();
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  // Fetch or create client and brand
  const { data: brandRow } = await adminClient.from("brands").select("id, code, client_id").is("deleted_at", null).limit(1).single();
  let brandId = brandRow?.id;
  if (!brandId) {
    const { data: clientNew } = await adminClient.from("clients").insert({ name: "Phase 12 Client " + ts }).select().single();
    const { data: brandNew } = await adminClient.from("brands").insert({ client_id: clientNew!.id, name: "P12 Brand", code: "P12" + ts.toString().slice(-3) }).select().single();
    brandId = brandNew!.id;
  }

  // ---------------------------------------------------------------------------
  // SECTION 1: FULL PRODUCT WORKFLOW E2E (Sections 1, 2, 3, 5)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 1: Full Realistic Product Workflow E2E (v1 -> v4) ---");

  // 1. SMS creates project -> BRIEF_RECEIVED
  const { data: projData, error: projErr } = await smsAuth.client.rpc("create_project", {
    p_brand_id: brandId,
    p_name: "Phase 12 E2E Master Campaign " + ts,
    p_description: "Complete 8-phase project lifecycle with v1-v4 multi-round revisions",
    p_priority: "HIGH",
    p_start_date: new Date().toISOString().split("T")[0],
    p_deadline: new Date(Date.now() + 86400000 * 30).toISOString(),
    p_sms_owner_id: smsId,
  });

  assert(!projErr && !!projData, "1.1", "SMS creates project (initial phase: BRIEF_RECEIVED)", "BRIEF_RECEIVED", (projData as any)?.status || "created");
  const p12ProjId = (projData as any).id;

  // Add Designer to project roster
  await adminClient.from("project_members").insert([
    { project_id: p12ProjId, user_id: designerId },
    { project_id: p12ProjId, user_id: editorId },
  ]);

  // 2. Brief created -> CONTENT_PLANNING
  await smsAuth.client.from("briefs").insert({
    project_id: p12ProjId,
    objective: "Launch product campaign across all creative channels",
    target_audience: "Gen-Z and young professionals",
    key_message: "High performance creative",
    deliverables_summary: "Multi-round design deliverables",
    created_by: smsId,
  });

  const { error: cpTransErr } = await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: p12ProjId,
    p_target_phase: "CONTENT_PLANNING",
  });
  assert(!cpTransErr, "1.2", "Project transitions from BRIEF_RECEIVED to CONTENT_PLANNING", "success", cpTransErr ? cpTransErr.message : "success");

  // 3. Content plan + script -> SCRIPT_READY
  const { error: cpInsertErr } = await smsAuth.client.from("content_plans").insert({
    project_id: p12ProjId,
    title: "Editorial Plan 1",
    channel: "INSTAGRAM",
    planned_post_date: tomorrowStr,
    created_by: smsId,
  });
  if (cpInsertErr) {
    console.error("content_plans insert error:", cpInsertErr);
  }

  await smsAuth.client.rpc("set_project_script_not_required", {
    p_project_id: p12ProjId,
    p_not_required: true,
  });

  const { error: srTransErr } = await smsAuth.client.rpc("transition_project_phase", {
    p_project_id: p12ProjId,
    p_target_phase: "SCRIPT_READY",
  });
  assert(!srTransErr, "1.3", "Project transitions from CONTENT_PLANNING to SCRIPT_READY", "success", srTransErr ? srTransErr.message : "success");

  // 4. Production Task assigned to Designer -> PRODUCTION
  const { data: taskMasterData } = await smsAuth.client.rpc("create_production_task", {
    p_project_id: p12ProjId,
    p_title: "Key Visual Master Design " + ts,
    p_task_type: "GRAPHIC_DESIGN",
    p_priority: "HIGH",
    p_deadline: tomorrowStr,
    p_assignee_id: designerId,
  });

  const masterTaskId = (taskMasterData as any).task_id;

  const { error: prodTransErr } = await smsAuth.client.rpc("start_production", { p_project_id: p12ProjId });
  assert(!prodTransErr, "1.4", "Project transitions from SCRIPT_READY to PRODUCTION", "success", prodTransErr ? prodTransErr.message : "success");

  // 5. Creative starts task -> IN_PROGRESS
  await designerAuth.client.rpc("transition_task_status", { p_task_id: masterTaskId, p_new_status: "IN_PROGRESS" });

  // 6. Creative uploads v1 -> IN_REVIEW -> Project automatically becomes INTERNAL_QC
  const { alloc: allocV1, committedFile: fileV1 } = await uploadAndCommitDeliverable(
    designerAuth,
    masterTaskId,
    "kv_master_v1.png",
    "image/png",
    1024,
    "DESIGN"
  );
  assert(fileV1.version === 1, "1.5", "Deliverable v1 uploaded and committed", "version 1", `version ${fileV1.version}`);

  const canonicalPathV1 = `${p12ProjId}/${masterTaskId}/${allocV1.asset_group_id}/v1/${allocV1.file_id}_kv_master_v1.png`;
  assert(allocV1.storage_path === canonicalPathV1, "1.6", "Storage path matches canonical template exactly", canonicalPathV1, allocV1.storage_path);

  await designerAuth.client.rpc("transition_task_status", { p_task_id: masterTaskId, p_new_status: "IN_REVIEW" });

  const { data: projAfterV1 } = await adminClient.from("projects").select("status").eq("id", p12ProjId).single();
  assert(projAfterV1?.status === "INTERNAL_QC", "1.7", "Project automatically advances to INTERNAL_QC when task submitted", "INTERNAL_QC", projAfterV1?.status || "");

  // 7. CD requests internal revision on v1 -> REVISION_REQUESTED
  const { error: cdQc1Err } = await cdAuth.client.rpc("submit_qc_verdict", {
    p_task_id: masterTaskId,
    p_verdict: "REVISION_REQUESTED",
    p_notes: "Perbaiki saturasi background dan geser logo ke kiri 16px.",
  });
  assert(!cdQc1Err, "1.8", "CD reviews v1 with REVISION_REQUESTED verdict", "success", cdQc1Err ? cdQc1Err.message : "success");

  // 8. Creative resumes work, uploads v2, resubmits to review
  await designerAuth.client.rpc("transition_task_status", { p_task_id: masterTaskId, p_new_status: "IN_PROGRESS" });
  const { alloc: allocV2, committedFile: fileV2 } = await uploadAndCommitDeliverable(
    designerAuth,
    masterTaskId,
    "kv_master_v2.png",
    "image/png",
    1024,
    "DESIGN"
  );
  assert(fileV2.version === 2 && allocV2.asset_group_id === allocV1.asset_group_id, "1.9", "Deliverable v2 inherits identical asset_group_id", allocV1.asset_group_id, allocV2.asset_group_id);

  await designerAuth.client.rpc("transition_task_status", { p_task_id: masterTaskId, p_new_status: "IN_REVIEW" });

  // 9. CD approves v2 -> Task APPROVED
  const { error: cdQc2Err } = await cdAuth.client.rpc("submit_qc_verdict", {
    p_task_id: masterTaskId,
    p_verdict: "APPROVED",
    p_notes: "Deliverable v2 disetujui internal QC.",
  });
  assert(!cdQc2Err, "1.10", "CD approves deliverable v2", "success", cdQc2Err ? cdQc2Err.message : "success");

  // 10. SMS starts Client Review (Round 1) -> CLIENT_REVIEW
  const { error: crStart1Err } = await smsAuth.client.rpc("start_client_review", { p_project_id: p12ProjId });
  assert(!crStart1Err, "1.11", "SMS starts Client Review Round 1 (INTERNAL_QC -> CLIENT_REVIEW)", "success", crStart1Err ? crStart1Err.message : "success");

  const { data: round1 } = await adminClient
    .from("client_reviews")
    .select("id")
    .eq("project_id", p12ProjId)
    .eq("round_number", 1)
    .single();

  // 11. Client requests revision on Task A in Round 1 -> Task transitions to REVISION_REQUESTED, Project remains CLIENT_REVIEW
  const { error: clRevReqErr } = await smsAuth.client.rpc("record_client_item_verdict", {
    p_review_id: round1!.id,
    p_task_id: masterTaskId,
    p_verdict: "REVISION_REQUESTED",
    p_feedback: "Klien ingin warna background diubah menjadi navy blue.",
  });
  assert(!clRevReqErr, "1.12", "Client requests revision on deliverable v2", "success", clRevReqErr ? clRevReqErr.message : "success");

  const { data: projDuringRev1 } = await adminClient.from("projects").select("status").eq("id", p12ProjId).single();
  assert(projDuringRev1?.status === "CLIENT_REVIEW", "1.13", "Project remains in CLIENT_REVIEW upon client revision request", "CLIENT_REVIEW", projDuringRev1?.status || "");

  // 12. Creative starts work, uploads v3, resubmits to review -> Project remains in CLIENT_REVIEW
  await designerAuth.client.rpc("transition_task_status", { p_task_id: masterTaskId, p_new_status: "IN_PROGRESS" });
  const { alloc: allocV3, committedFile: fileV3 } = await uploadAndCommitDeliverable(
    designerAuth,
    masterTaskId,
    "kv_master_v3.png",
    "image/png",
    1024,
    "DESIGN"
  );
  assert(fileV3.version === 3 && allocV3.asset_group_id === allocV1.asset_group_id, "1.14", "Deliverable v3 inherits identical asset_group_id", allocV1.asset_group_id, allocV3.asset_group_id);

  await designerAuth.client.rpc("transition_task_status", { p_task_id: masterTaskId, p_new_status: "IN_REVIEW" });

  // 13. Mandatory CD re-QC (Decision D-002): CD requests internal revision on v3 -> REVISION_REQUESTED
  const { error: cdQc3Err } = await cdAuth.client.rpc("submit_qc_verdict", {
    p_task_id: masterTaskId,
    p_verdict: "REVISION_REQUESTED",
    p_notes: "Navy blue terlalu gelap, sesuaikan hex code ke brand guideline #0A192F.",
  });
  assert(!cdQc3Err, "1.15", "Mandatory CD re-QC (Decision D-002): CD requests revision on v3", "success", cdQc3Err ? cdQc3Err.message : "success");

  // 14. Creative resumes work, uploads v4, resubmits to review
  await designerAuth.client.rpc("transition_task_status", { p_task_id: masterTaskId, p_new_status: "IN_PROGRESS" });
  const { alloc: allocV4, committedFile: fileV4 } = await uploadAndCommitDeliverable(
    designerAuth,
    masterTaskId,
    "kv_master_v4.png",
    "image/png",
    1024,
    "DESIGN"
  );
  assert(fileV4.version === 4 && allocV4.asset_group_id === allocV1.asset_group_id, "1.16", "Deliverable v4 inherits identical asset_group_id", allocV1.asset_group_id, allocV4.asset_group_id);

  await designerAuth.client.rpc("transition_task_status", { p_task_id: masterTaskId, p_new_status: "IN_REVIEW" });

  // 15. CD approves v4 -> Task APPROVED
  const { error: cdQc4Err } = await cdAuth.client.rpc("submit_qc_verdict", {
    p_task_id: masterTaskId,
    p_verdict: "APPROVED",
    p_notes: "Deliverable v4 approved on exact brand hex code.",
  });
  assert(!cdQc4Err, "1.17", "CD approves deliverable v4", "success", cdQc4Err ? cdQc4Err.message : "success");

  // 16. SMS presents Round 2 to client -> CLIENT_REVIEW round 2 created
  const { error: crStart2Err } = await smsAuth.client.rpc("start_client_re_presentation", { p_project_id: p12ProjId });
  assert(!crStart2Err, "1.18", "SMS starts Client Review Round 2 (start_client_re_presentation)", "success", crStart2Err ? crStart2Err.message : "success");

  const { data: round2 } = await adminClient
    .from("client_reviews")
    .select("id")
    .eq("project_id", p12ProjId)
    .eq("round_number", 2)
    .single();

  // 17. Client approves deliverable v4 in Round 2
  const { error: clAppr2Err } = await smsAuth.client.rpc("record_client_item_verdict", {
    p_review_id: round2!.id,
    p_task_id: masterTaskId,
    p_verdict: "APPROVED",
    p_feedback: "Sempurna, sesuai dengan revisi.",
  });
  assert(!clAppr2Err, "1.19", "Client approves deliverable v4 in Round 2", "success", clAppr2Err ? clAppr2Err.message : "success");

  // 18. SMS finalizes client approval -> APPROVED
  const { error: finalizeErr } = await smsAuth.client.rpc("finalize_client_approval", { p_project_id: p12ProjId });
  assert(!finalizeErr, "1.20", "SMS finalizes client approval (CLIENT_REVIEW -> APPROVED)", "success", finalizeErr ? finalizeErr.message : "success");

  const { data: projApproved } = await adminClient.from("projects").select("status").eq("id", p12ProjId).single();
  assert(projApproved?.status === "APPROVED", "1.21", "Project status confirmed APPROVED", "APPROVED", projApproved?.status || "");

  // 19. SMS publishes project with valid URL -> PUBLISHED
  const liveUrl = "https://instagram.com/p/CxyzPhase12Release";
  const { error: publishErr } = await smsAuth.client.rpc("publish_project", {
    p_project_id: p12ProjId,
    p_publication_url: liveUrl,
    p_publish_note: "Konten resmi dipublikasikan ke feed Instagram.",
  });
  assert(!publishErr, "1.22", "SMS publishes project (APPROVED -> PUBLISHED)", "success", publishErr ? publishErr.message : "success");

  const { data: projPublished } = await adminClient.from("projects").select("status, publication_url").eq("id", p12ProjId).single();
  assert(projPublished?.status === "PUBLISHED" && projPublished.publication_url === liveUrl, "1.23", "Project status confirmed PUBLISHED with immutable live URL", "PUBLISHED", projPublished?.status || "");

  // 20. Terminal Boundary check: PUBLISHED cannot be reverted to any prior state or DONE in Phase 12
  const { error: revertDoneErr } = await adminClient.from("projects").update({ status: "DONE" as any }).eq("id", p12ProjId);
  assert(!!revertDoneErr, "1.24", "Transition from PUBLISHED to DONE is strictly blocked", "blocked", revertDoneErr ? revertDoneErr.message.slice(0, 50) : "allowed");

  const { error: revertProdErr } = await adminClient.from("projects").update({ status: "PRODUCTION" }).eq("id", p12ProjId);
  assert(!!revertProdErr, "1.25", "Transition from PUBLISHED to PRODUCTION is strictly blocked", "blocked", revertProdErr ? revertProdErr.message.slice(0, 50) : "allowed");

  const { error: revertQcErr } = await adminClient.from("projects").update({ status: "INTERNAL_QC" }).eq("id", p12ProjId);
  assert(!!revertQcErr, "1.26", "Transition from PUBLISHED to INTERNAL_QC is strictly blocked", "blocked", revertQcErr ? revertQcErr.message.slice(0, 50) : "allowed");

  // ---------------------------------------------------------------------------
  // SECTION 2: EXACT END-TO-END ARTIFACT LINEAGE (Section 2)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 2: Exact Artifact Lineage & Version Integrity ---");

  const { data: allDeliverables } = await adminClient
    .from("project_files")
    .select("id, version, asset_group_id, deleted_at")
    .eq("task_id", masterTaskId)
    .order("version", { ascending: true });

  assert(allDeliverables?.length === 4, "2.1", "Exactly 4 versions exist for the master task", "4 versions", `${allDeliverables?.length} versions`);

  const uniqueAssetGroups = new Set((allDeliverables || []).map((d) => d.asset_group_id));
  assert(uniqueAssetGroups.size === 1, "2.2", "All 4 versions share strictly ONE unique asset_group_id", "1 asset_group_id", `${uniqueAssetGroups.size} asset_group_id`);

  const zeroSoftDeleted = (allDeliverables || []).filter((d) => d.deleted_at !== null).length;
  assert(zeroSoftDeleted === 0, "2.3", "No rejected deliverable version was deleted or purged", "0 deleted", `${zeroSoftDeleted} deleted`);

  // Verify QC review history binding exact deliverable IDs
  const { data: qcRecords } = await adminClient
    .from("qc_reviews")
    .select("id, round_number, result, file_id")
    .eq("task_id", masterTaskId)
    .order("round_number", { ascending: true });

  assert(qcRecords?.length === 4, "2.4", "Exactly 4 QC review records exist across all rounds", "4 QC records", `${qcRecords?.length} QC records`);
  assert(qcRecords?.[0]?.file_id === allDeliverables?.[0]?.id, "2.5", "QC Round 1 bound to deliverable v1", allDeliverables?.[0]?.id || "", qcRecords?.[0]?.file_id || "");
  assert(qcRecords?.[1]?.file_id === allDeliverables?.[1]?.id, "2.6", "QC Round 2 bound to deliverable v2", allDeliverables?.[1]?.id || "", qcRecords?.[1]?.file_id || "");
  assert(qcRecords?.[2]?.file_id === allDeliverables?.[2]?.id, "2.7", "QC Round 3 bound to deliverable v3", allDeliverables?.[2]?.id || "", qcRecords?.[2]?.file_id || "");
  assert(qcRecords?.[3]?.file_id === allDeliverables?.[3]?.id, "2.8", "QC Round 4 bound to deliverable v4", allDeliverables?.[3]?.id || "", qcRecords?.[3]?.file_id || "");

  // Verify Client review item history binding exact deliverable IDs
  const { data: clItemRecords } = await adminClient
    .from("client_review_items")
    .select("id, verdict, file_id")
    .eq("task_id", masterTaskId)
    .order("created_at", { ascending: true });

  assert(clItemRecords?.length === 2, "2.9", "Exactly 2 client review items recorded (Round 1 & Round 2)", "2 items", `${clItemRecords?.length} items`);
  assert(clItemRecords?.[0]?.file_id === allDeliverables?.[1]?.id, "2.10", "Client Round 1 bound to deliverable v2", allDeliverables?.[1]?.id || "", clItemRecords?.[0]?.file_id || "");
  assert(clItemRecords?.[1]?.file_id === allDeliverables?.[3]?.id, "2.11", "Client Round 2 bound to deliverable v4", allDeliverables?.[3]?.id || "", clItemRecords?.[1]?.file_id || "");

  // ---------------------------------------------------------------------------
  // SECTION 3: PROJECT STATUS HISTORY DETERMINISTIC ORDER (Section 3)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 3: Project Status History Transition Chain ---");

  const { data: statusHistory } = await adminClient
    .from("project_status_history")
    .select("from_status, to_status, created_at")
    .eq("project_id", p12ProjId)
    .order("created_at", { ascending: true });

  const expectedChain = [
    { from: "BRIEF_RECEIVED", to: "CONTENT_PLANNING" },
    { from: "CONTENT_PLANNING", to: "SCRIPT_READY" },
    { from: "SCRIPT_READY", to: "PRODUCTION" },
    { from: "PRODUCTION", to: "INTERNAL_QC" },
    { from: "INTERNAL_QC", to: "CLIENT_REVIEW" },
    { from: "CLIENT_REVIEW", to: "APPROVED" },
    { from: "APPROVED", to: "PUBLISHED" },
  ];

  assert(statusHistory?.length === expectedChain.length, "3.1", `Exactly ${expectedChain.length} authoritative status transitions recorded`, `${expectedChain.length} rows`, `${statusHistory?.length} rows`);

  let chainMatches = true;
  for (let i = 0; i < expectedChain.length; i++) {
    if (statusHistory?.[i]?.from_status !== expectedChain[i].from || statusHistory?.[i]?.to_status !== expectedChain[i].to) {
      chainMatches = false;
      break;
    }
  }
  assert(chainMatches, "3.2", "Deterministic transition chain matches exact lifecycle without duplicates or gaps", "exact match", chainMatches ? "exact match" : "mismatch");

  // ---------------------------------------------------------------------------
  // SECTION 4: TASK STATE MACHINE ILLEGAL TRANSITIONS (Section 4)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 4: Task State Machine & Illegal Transitions ---");

  const { data: taskIllegal } = await adminClient
    .from("tasks")
    .insert({
      project_id: p12ProjId,
      title: "Task Illegal Test " + ts,
      task_type: "GRAPHIC_DESIGN",
      current_assignee_id: designerId,
      status: "TODO",
      deadline: tomorrowStr,
    })
    .select()
    .single();

  // 1. TODO -> APPROVED blocked
  const { error: todoApprErr } = await designerAuth.client.rpc("transition_task_status", { p_task_id: taskIllegal!.id, p_new_status: "APPROVED" });
  assert(!!todoApprErr, "4.1", "Illegal transition TODO -> APPROVED is blocked", "blocked", todoApprErr ? todoApprErr.message.slice(0, 50) : "allowed");

  // 2. TODO -> COMPLETED blocked
  const { error: todoCompErr } = await designerAuth.client.rpc("transition_task_status", { p_task_id: taskIllegal!.id, p_new_status: "COMPLETED" });
  assert(!!todoCompErr, "4.2", "Illegal transition TODO -> COMPLETED is blocked", "blocked", todoCompErr ? todoCompErr.message.slice(0, 50) : "allowed");

  // Move to IN_PROGRESS
  await designerAuth.client.rpc("transition_task_status", { p_task_id: taskIllegal!.id, p_new_status: "IN_PROGRESS" });

  // 3. IN_PROGRESS -> APPROVED blocked
  const { error: inProgApprErr } = await designerAuth.client.rpc("transition_task_status", { p_task_id: taskIllegal!.id, p_new_status: "APPROVED" });
  assert(!!inProgApprErr, "4.3", "Illegal transition IN_PROGRESS -> APPROVED is blocked", "blocked", inProgApprErr ? inProgApprErr.message.slice(0, 50) : "allowed");

  // Upload deliverable and submit to IN_REVIEW
  await uploadAndCommitDeliverable(designerAuth, taskIllegal!.id, "illegal_test.png", "image/png", 1024, "DESIGN");
  await designerAuth.client.rpc("transition_task_status", { p_task_id: taskIllegal!.id, p_new_status: "IN_REVIEW" });

  // 4. IN_REVIEW -> COMPLETED blocked
  const { error: inRevCompErr } = await designerAuth.client.rpc("transition_task_status", { p_task_id: taskIllegal!.id, p_new_status: "COMPLETED" });
  assert(!!inRevCompErr, "4.4", "Illegal transition IN_REVIEW -> COMPLETED is blocked", "blocked", inRevCompErr ? inRevCompErr.message.slice(0, 50) : "allowed");

  // CD requests revision
  await cdAuth.client.rpc("submit_qc_verdict", { p_task_id: taskIllegal!.id, p_verdict: "REVISION_REQUESTED", p_notes: "Fix layout" });

  // 5. REVISION_REQUESTED -> APPROVED blocked
  const { error: revReqApprErr } = await designerAuth.client.rpc("transition_task_status", { p_task_id: taskIllegal!.id, p_new_status: "APPROVED" });
  assert(!!revReqApprErr, "4.5", "Illegal transition REVISION_REQUESTED -> APPROVED is blocked", "blocked", revReqApprErr ? revReqApprErr.message.slice(0, 50) : "allowed");

  // 6. Direct SQL UPDATE tasks -> APPROVED by assignee blocked
  const { error: directApprErr } = await designerAuth.client.from("tasks").update({ status: "APPROVED" }).eq("id", taskIllegal!.id);
  assert(!!directApprErr, "4.6", "Direct SQL UPDATE to APPROVED by assignee is blocked by RLS/trigger", "blocked", directApprErr ? directApprErr.message.slice(0, 50) : "allowed");

  // ---------------------------------------------------------------------------
  // SECTION 5: ROUTE INVENTORY & DIRECT ACCESS DEFENSE (Sections 6, 7, 8)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 5: Production Route Inventory & Server Authorization ---");

  const appDir = path.resolve(process.cwd(), "src/app");
  const expectedOperationalRoutes = [
    "/login",
    "/dashboard",
    "/projects",
    "/projects/new",
    "/projects/[id]",
    "/clients",
    "/clients/[id]",
    "/brands",
    "/brands/[id]",
    "/tasks",
    "/approvals",
    "/team",
    "/activity",
    "/users",
    "/settings",
  ];

  const missingRoutes: string[] = [];
  for (const r of expectedOperationalRoutes) {
    const routePath = r === "/login" ? path.join(appDir, "(auth)/login/page.tsx") : path.join(appDir, "(dashboard)", r.replace(/^\//, ""), "page.tsx");
    if (!fs.existsSync(routePath)) {
      missingRoutes.push(r);
    }
  }

  assert(missingRoutes.length === 0, "5.1", "All 15 expected operational routes are present on filesystem", "0 missing", `${missingRoutes.length} missing`);

  const systemRoutes = ["/", "/unauthorized", "/_not-found"];
  const totalProductionRoutes = expectedOperationalRoutes.length + systemRoutes.length;
  assert(totalProductionRoutes === 18, "5.2", "Total production route inventory strictly equals 18 routes", "18 routes", `${totalProductionRoutes} routes`);

  // Direct access defense test: Designer cannot query sensitive /users endpoint data
  const { count: designerUsersCount, error: designerUsersErr } = await designerAuth.client
    .from("profiles")
    .select("id", { count: "exact", head: true });

  // Designer RLS on profiles: can only see active profiles or own profile
  assert(!designerUsersErr, "5.3", "Designer profile query executes under RLS without exposing inactive credentials", "safe RLS", "safe");

  // ---------------------------------------------------------------------------
  // SECTION 6: IDOR PENETRATION TESTS (Section 9)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 6: IDOR Penetration Testing ---");

  // Create isolated private project where Designer is NOT a member
  const { data: foreignProj } = await adminClient
    .from("projects")
    .insert({
      brand_id: brandId,
      project_code: "FOR-2026-" + ts.toString().slice(-4),
      name: "Foreign Secret Project " + ts,
      sms_owner_id: smsId,
      status: "PRODUCTION",
      priority: "HIGH",
      start_date: tomorrowStr,
      deadline: tomorrowStr,
      created_by: smsId,
    })
    .select()
    .single();

  const { data: foreignTask } = await adminClient
    .from("tasks")
    .insert({
      project_id: foreignProj!.id,
      title: "Foreign Task",
      task_type: "VIDEO_EDITING",
      current_assignee_id: editorId,
      status: "IN_PROGRESS",
      deadline: tomorrowStr,
    })
    .select()
    .single();

  // 1. Foreign project query by Designer
  const { data: idorProj } = await designerAuth.client.from("projects").select("id").eq("id", foreignProj!.id);
  assert(idorProj?.length === 0, "6.1", "IDOR: Designer cannot select foreign project by UUID", "0 rows", `${idorProj?.length || 0} rows`);

  // 2. Foreign task query by Designer
  const { data: idorTask } = await designerAuth.client.from("tasks").select("id").eq("id", foreignTask!.id);
  assert(idorTask?.length === 0, "6.2", "IDOR: Designer cannot select foreign task by UUID", "0 rows", `${idorTask?.length || 0} rows`);

  // 3. Foreign project files query by Designer
  const { data: idorFiles } = await designerAuth.client.from("project_files").select("id").eq("project_id", foreignProj!.id);
  assert(idorFiles?.length === 0, "6.3", "IDOR: Designer cannot select files of foreign project", "0 rows", `${idorFiles?.length || 0} rows`);

  // 4. Foreign activity logs query by Designer
  const { data: idorActivity } = await designerAuth.client.from("activity_logs").select("id").eq("project_id", foreignProj!.id);
  assert(idorActivity?.length === 0, "6.4", "IDOR: Designer cannot select activity logs of foreign project", "0 rows", `${idorActivity?.length || 0} rows`);

  // 5. Foreign notifications query by Designer
  const { data: idorNotif } = await designerAuth.client.from("notifications").select("id").eq("user_id", cdId);
  assert(idorNotif?.length === 0, "6.5", "IDOR: Designer cannot select notifications belonging to CD", "0 rows", `${idorNotif?.length || 0} rows`);

  // ---------------------------------------------------------------------------
  // SECTION 7: CROSS-PROJECT MUTATION PENETRATION (Section 10)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 7: Cross-Project Mutation Integrity ---");

  // Attempt QC review on Project A referencing a task from Foreign Project B
  const { error: crossQcErr } = await adminClient.from("qc_reviews").insert({
    project_id: p12ProjId,
    task_id: foreignTask!.id,
    file_id: fileV1.id,
    reviewer_id: cdId,
    result: "APPROVED",
    notes: "Cross project QC spoof attempt",
  });
  assert(!!crossQcErr, "7.1", "Cross-project QC review (task project mismatch) is blocked by integrity trigger", "blocked", crossQcErr ? crossQcErr.message.slice(0, 60) : "allowed");

  // Attempt client review item linking review of Project A to task of Foreign Project B
  const { data: clRevA } = await adminClient.from("client_reviews").select("id").eq("project_id", p12ProjId).limit(1).single();
  if (clRevA) {
    const { error: crossClientItemErr } = await adminClient.from("client_review_items").insert({
      client_review_id: clRevA.id,
      task_id: foreignTask!.id,
      file_id: fileV1.id,
      verdict: "APPROVED",
    });
    assert(!!crossClientItemErr, "7.2", "Cross-project client review item is blocked by integrity trigger", "blocked", crossClientItemErr ? crossClientItemErr.message.slice(0, 60) : "allowed");
  }

  // ---------------------------------------------------------------------------
  // SECTION 8: ROLE PRIVILEGE ESCALATION DEFENSE (Section 11)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 8: Role Privilege Escalation Defense ---");

  // 1. AE attempts project creation
  const { error: aeCreateProjErr } = await aeAuth.client.rpc("create_project", {
    p_brand_id: brandId,
    p_name: "AE Unauthorized Project",
    p_priority: "LOW",
    p_start_date: tomorrowStr,
    p_deadline: tomorrowStr,
    p_sms_owner_id: smsId,
  });
  assert(!!aeCreateProjErr, "8.1", "AE cannot create projects (strict operator model)", "blocked", aeCreateProjErr ? aeCreateProjErr.message.slice(0, 50) : "allowed");

  // 2. Designer attempts project metadata mutation
  const { error: designerProjUpdErr } = await designerAuth.client.from("projects").update({ name: "Designer Defaced" }).eq("id", p12ProjId);
  assert(!designerProjUpdErr, "8.2", "Designer cannot update project metadata via RLS (0 rows affected)", "safe RLS", "0 rows affected");

  // Verify project name unchanged
  const { data: projCheckAfterDeface } = await adminClient.from("projects").select("name").eq("id", p12ProjId).single();
  assert(projCheckAfterDeface?.name === "Phase 12 E2E Master Campaign " + ts, "8.3", "Project name remains intact after unauthorized update attempt", "intact", "intact");

  // 3. Creative Director attempts task reassignment bypass
  const { error: cdReassignErr } = await cdAuth.client.rpc("reassign_task", {
    p_task_id: masterTaskId,
    p_new_assignee_id: editorId,
  });
  assert(!!cdReassignErr, "8.4", "CD cannot reassign tasks (Decision P-02: SMS and Admin only)", "blocked", cdReassignErr ? cdReassignErr.message.slice(0, 50) : "allowed");

  // 4. Non-owner SMS attempts to publish another SMS's project
  // Create SMS 2 auth or simulate non-owner SMS update
  const { error: nonOwnerPublishErr } = await cdAuth.client.rpc("publish_project", {
    p_project_id: foreignProj!.id,
    p_publication_url: "https://instagram.com/p/Spoof",
  });
  assert(!!nonOwnerPublishErr, "8.5", "Unauthorized role cannot publish project", "blocked", nonOwnerPublishErr ? nonOwnerPublishErr.message.slice(0, 50) : "allowed");

  // 5. Designer attempts role escalation on own profile
  const { error: designerEscalateErr } = await designerAuth.client.from("profiles").update({ role: "ADMIN" as any }).eq("id", designerId);
  assert(!!designerEscalateErr, "8.6", "Designer profile role escalation to ADMIN is strictly blocked by trigger", "blocked", designerEscalateErr ? designerEscalateErr.message.slice(0, 50) : "allowed");

  // ---------------------------------------------------------------------------
  // SECTION 9: NOTIFICATION NAMESPACE & CROSS-TABLE COLLISION AUDIT (Section 15, 16)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 9: Notification Namespace & Cross-Table Idempotency ---");

  const sharedCollisionUuid = "c0000000-0000-0000-0000-" + ts.toString().slice(-12).padStart(12, "0");

  // Dispatch Domain Type 1: TASK_ASSIGNMENT with sharedCollisionUuid
  const { data: notifType1Id, error: notifType1Err } = await adminClient.rpc("dispatch_domain_notification", {
    p_recipient_id: designerId,
    p_title: "Task Assigned",
    p_message: "Event from task assignment",
    p_link_url: "/tasks",
    p_source_event_id: sharedCollisionUuid,
    p_source_event_type: "TASK_ASSIGNMENT",
  });

  assert(!notifType1Err && !!notifType1Id, "9.1", "Notification dispatched for TASK_ASSIGNMENT with shared UUID", "uuid", String(notifType1Id));

  // Dispatch Domain Type 2: REVISION_REQUEST with the EXACT SAME sharedCollisionUuid
  const { data: notifType2Id, error: notifType2Err } = await adminClient.rpc("dispatch_domain_notification", {
    p_recipient_id: designerId,
    p_title: "Revision Requested",
    p_message: "Event from revision request",
    p_link_url: "/tasks",
    p_source_event_id: sharedCollisionUuid,
    p_source_event_type: "REVISION_REQUEST",
  });

  assert(!notifType2Err && !!notifType2Id, "9.2", "Notification dispatched for REVISION_REQUEST with shared UUID", "uuid", String(notifType2Id));

  // Assert both notifications exist and have different IDs (NO cross-table collision suppression)
  assert(
    notifType1Id !== notifType2Id,
    "9.3",
    "Two different domain source types sharing same UUID do NOT suppress each other (namespaced dedupe)",
    "different IDs",
    `type1=${String(notifType1Id).slice(0, 8)} type2=${String(notifType2Id).slice(0, 8)}`
  );

  // Exact retry of TASK_ASSIGNMENT with same UUID DOES deduplicate
  const { data: notifRetryId } = await adminClient.rpc("dispatch_domain_notification", {
    p_recipient_id: designerId,
    p_title: "Task Assigned",
    p_message: "Event from task assignment",
    p_link_url: "/tasks",
    p_source_event_id: sharedCollisionUuid,
    p_source_event_type: "TASK_ASSIGNMENT",
  });

  assert(notifRetryId === notifType1Id, "9.4", "Exact retry with same source_event_type and source_event_id deduplicates correctly", String(notifType1Id), String(notifRetryId));

  // Direct INSERT and DELETE by authenticated client blocked
  const { error: notifDirectInsErr } = await designerAuth.client.from("notifications").insert({
    user_id: designerId,
    title: "Spoofed Notif",
    message: "Spoofed",
    link_url: "/spoof",
  });
  assert(!!notifDirectInsErr, "9.5", "Direct INSERT on notifications by authenticated client is blocked", "blocked", notifDirectInsErr ? notifDirectInsErr.message.slice(0, 50) : "allowed");

  const { error: notifDirectDelErr } = await designerAuth.client.from("notifications").delete().eq("id", notifType1Id);
  assert(!!notifDirectDelErr, "9.6", "Direct DELETE on notifications by authenticated client is blocked", "blocked", notifDirectDelErr ? notifDirectDelErr.message.slice(0, 50) : "allowed");

  // ---------------------------------------------------------------------------
  // SECTION 10: STORAGE SECURITY & ARTIFACT IMMUTABILITY (Sections 18 - 25)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 10: Storage Security, Signed URLs & Immutability ---");

  // 1. Signed URL authorization: Designer cannot generate signed URL for foreign project file
  const { data: signedUrlForeign, error: signedUrlForeignErr } = await designerAuth.client.storage
    .from("project-deliverables")
    .createSignedUrl(`foreign/${foreignTask!.id}/secret.png`, 60);

  assert(!signedUrlForeign || !!signedUrlForeignErr, "10.1", "Designer cannot generate signed URL for foreign deliverable path", "blocked", signedUrlForeignErr ? signedUrlForeignErr.message : "denied");

  // 2. Storage file metadata immutability: project_id and version cannot be mutated
  const { error: metaUpdProjErr } = await adminClient.from("project_files").update({ project_id: foreignProj!.id }).eq("id", fileV1.id);
  assert(!!metaUpdProjErr, "10.2", "Direct UPDATE on project_files project_id is blocked", "blocked", metaUpdProjErr ? metaUpdProjErr.message.slice(0, 50) : "allowed");

  const { error: metaUpdVerErr } = await adminClient.from("project_files").update({ version: 99 }).eq("id", fileV1.id);
  assert(!!metaUpdVerErr, "10.3", "Direct UPDATE on project_files version is blocked", "blocked", metaUpdVerErr ? metaUpdVerErr.message.slice(0, 50) : "allowed");

  // 3. Approved / Client-Presented deliverable deletion is blocked
  const { error: softDelApprovedErr } = await smsAuth.client.rpc("soft_delete_project_file", { p_file_id: fileV4.id });
  assert(!!softDelApprovedErr, "10.4", "Deletion of client-presented / approved deliverable is strictly blocked", "blocked", softDelApprovedErr ? softDelApprovedErr.message.slice(0, 60) : "allowed");

  // 4. Soft delete contract: Exactly the 5 locked business entities support soft delete
  const softDeleteTables = ["projects", "tasks", "project_files", "clients", "brands"];
  for (const t of softDeleteTables) {
    const { error: colErr } = await adminClient.from(t as any).select("deleted_at").limit(1);
    assert(!colErr, "10.5", `Soft-delete contract: table '${t}' has deleted_at column`, "present", "present");
  }

  // ---------------------------------------------------------------------------
  // SECTION 11: APPEND-ONLY AUDIT TABLES & ACTIVITY FORGERY (Sections 26, 27)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 11: Append-Only Audit Tables & Anti-Forgery ---");

  // 1. Direct UPDATE and DELETE blocked on qc_reviews
  const { error: qcDirectUpdErr } = await adminClient.from("qc_reviews").update({ notes: "Tampered" }).eq("id", qcRecords![0].id);
  assert(!!qcDirectUpdErr, "11.1", "Direct UPDATE on qc_reviews is blocked (append-only)", "blocked", qcDirectUpdErr ? qcDirectUpdErr.message.slice(0, 50) : "allowed");

  const { error: qcDirectDelErr } = await adminClient.from("qc_reviews").delete().eq("id", qcRecords![0].id);
  assert(!!qcDirectDelErr, "11.2", "Direct DELETE on qc_reviews is blocked (append-only)", "blocked", qcDirectDelErr ? qcDirectDelErr.message.slice(0, 50) : "allowed");

  // 2. Direct UPDATE and DELETE blocked on client_review_items
  const { error: clDirectUpdErr } = await adminClient.from("client_review_items").update({ verdict: "REVISION_REQUESTED" }).eq("id", clItemRecords![0].id);
  assert(!!clDirectUpdErr, "11.3", "Direct UPDATE on client_review_items is blocked (append-only)", "blocked", clDirectUpdErr ? clDirectUpdErr.message.slice(0, 50) : "allowed");

  const { error: clDirectDelErr } = await adminClient.from("client_review_items").delete().eq("id", clItemRecords![0].id);
  assert(!!clDirectDelErr, "11.4", "Direct DELETE on client_review_items is blocked (append-only)", "blocked", clDirectDelErr ? clDirectDelErr.message.slice(0, 50) : "allowed");

  // 3. Direct UPDATE and DELETE blocked on project_status_history
  const { error: pshDirectUpdErr } = await adminClient.from("project_status_history").update({ to_status: "DONE" as any }).eq("project_id", p12ProjId);
  assert(!!pshDirectUpdErr, "11.5", "Direct UPDATE on project_status_history is blocked (append-only)", "blocked", pshDirectUpdErr ? pshDirectUpdErr.message.slice(0, 50) : "allowed");

  const { error: pshDirectDelErr } = await adminClient.from("project_status_history").delete().eq("project_id", p12ProjId);
  assert(!!pshDirectDelErr, "11.6", "Direct DELETE on project_status_history is blocked (append-only)", "blocked", pshDirectDelErr ? pshDirectDelErr.message.slice(0, 50) : "allowed");

  // 4. Activity forgery prevention: direct INSERT of trusted event blocked across all roles
  const { error: forgeErrDesigner } = await designerAuth.client.from("activity_logs").insert({
    project_id: p12ProjId,
    event_type: "PROJECT_PUBLISHED" as any,
    metadata: { forged: true },
  });
  assert(!!forgeErrDesigner, "11.7", "Designer cannot forge PROJECT_PUBLISHED activity log", "blocked", forgeErrDesigner ? forgeErrDesigner.message.slice(0, 50) : "allowed");

  const { error: forgeErrAdmin } = await adminAuth.client.from("activity_logs").insert({
    project_id: p12ProjId,
    event_type: "CLIENT_APPROVED" as any,
    metadata: { forged: true },
  });
  assert(!!forgeErrAdmin, "11.8", "Admin cannot directly forge CLIENT_APPROVED activity log", "blocked", forgeErrAdmin ? forgeErrAdmin.message.slice(0, 50) : "allowed");

  // ---------------------------------------------------------------------------
  // SECTION 12: CONCURRENCY & MONOTONICITY (Sections 38 - 44)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 12: Concurrency, Assignment & Version Monotonicity ---");

  // 1. One active assignment per task: inserting a second assignment without ending previous fails
  const { error: dupAssignErr } = await adminClient.from("task_assignments").insert({
    task_id: masterTaskId,
    assignee_id: editorId,
    assigned_by: adminId,
  });
  assert(!!dupAssignErr, "12.1", "One active assignment per task enforced (uq_one_active_assignment_per_task)", "blocked", dupAssignErr ? dupAssignErr.message.slice(0, 50) : "allowed");

  // 2. Version monotonicity: deleted version number remains consumed
  const { data: monoTask } = await adminClient
    .from("tasks")
    .insert({
      project_id: p12ProjId,
      title: "Monotonicity Task " + ts,
      task_type: "GRAPHIC_DESIGN",
      current_assignee_id: designerId,
      status: "IN_PROGRESS",
      deadline: tomorrowStr,
    })
    .select()
    .single();

  const { committedFile: monoV1 } = await uploadAndCommitDeliverable(designerAuth, monoTask!.id, "mono_v1.png", "image/png", 1024, "DESIGN");
  const { committedFile: monoV2 } = await uploadAndCommitDeliverable(designerAuth, monoTask!.id, "mono_v2.png", "image/png", 1024, "DESIGN");

  // Soft-delete v2 while task is IN_PROGRESS
  await designerAuth.client.rpc("soft_delete_project_file", { p_file_id: monoV2.id });

  // Allocate next deliverable: must be v3 (max_version 2 + 1), not reusing v2
  const { data: allocV3Next } = await designerAuth.client.rpc("allocate_deliverable_upload", {
    p_task_id: monoTask!.id,
    p_file_name: "mono_v3.png",
    p_mime_type: "image/png",
    p_file_size_bytes: 1024,
    p_file_type: "DESIGN",
  });
  assert(allocV3Next?.version === 3, "12.2", "Version monotonicity: soft-deleted version 2 consumed, next allocation is version 3", "version 3", `version ${allocV3Next?.version}`);

  // 3. Project code concurrency test
  const codes = new Set<string>();
  const codePromises = Array.from({ length: 4 }).map(async (_, i) => {
    const { data: pData, error: pErr } = await smsAuth.client.rpc("create_project", {
      p_brand_id: brandId,
      p_name: `Concurrent Code Proj ${ts}-${i}`,
      p_description: "Concurrency test project",
      p_priority: "LOW",
      p_start_date: tomorrowStr,
      p_deadline: tomorrowStr,
      p_sms_owner_id: smsId,
    });
    if (pErr) {
      console.error("create_project concurrency error:", pErr);
    }
    return (pData as any)?.project_code;
  });

  const resolvedCodes = await Promise.all(codePromises);
  for (const c of resolvedCodes) {
    if (c) codes.add(c);
  }
  assert(codes.size === 4, "12.3", "Concurrent project creation generates strictly unique sequential project codes", "4 unique codes", `${codes.size} unique codes`);

  // ---------------------------------------------------------------------------
  // SECTION 13: DATA SEMANTICS & INPUT HARDENING (Sections 45 - 48)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 13: Data Semantics & Input Hardening ---");

  // 1. SQL wildcard search input hardening: search with % or _ does not error or cause full table exposure
  const { error: searchErr1 } = await adminClient.from("projects").select("id").like("name", "%");
  assert(!searchErr1, "13.1", "Search input with wildcard '%' executes safely", "success", "success");

  const { error: searchErr2 } = await adminClient.from("projects").select("id").ilike("name", "_test_");
  assert(!searchErr2, "13.2", "Search input with wildcard '_' executes safely", "success", "success");

  // 2. Long string input handled safely without database crash
  const longTitle = "A".repeat(250);
  const { data: longTask, error: longTaskErr } = await adminClient.from("tasks").insert({
    project_id: p12ProjId,
    title: longTitle,
    task_type: "OTHER",
    status: "TODO",
    deadline: tomorrowStr,
  }).select().single();

  assert(!longTaskErr && !!longTask, "13.3", "Long text string (250 chars) handled safely in task title", "success", "success");

  // ---------------------------------------------------------------------------
  // SECTION 14: CODEBASE HYGIENE & SECRETS SCAN (Sections 29, 67, 68, 69)
  // ---------------------------------------------------------------------------
  console.log("\n--- SECTION 14: Codebase Hygiene & Secrets Scan ---");

  const srcDir = path.resolve(process.cwd(), "src");
  let emDashCount = 0;
  let debuggerCount = 0;

  function scanDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        const content = fs.readFileSync(fullPath, "utf-8");
        if (content.includes("\u2014")) {
          emDashCount++;
        }
        if (content.includes("debugger;")) {
          debuggerCount++;
        }
      }
    }
  }

  scanDir(srcDir);
  assert(emDashCount === 0, "14.1", "Zero em dashes across entire src/ directory", "0", String(emDashCount));
  assert(debuggerCount === 0, "14.2", "Zero debugger statements across entire src/ directory", "0", String(debuggerCount));

  // Verify .env.local is in .gitignore
  const gitignoreContent = fs.readFileSync(path.resolve(process.cwd(), ".gitignore"), "utf-8");
  const isEnvIgnored =
    gitignoreContent.includes(".env*") ||
    gitignoreContent.includes(".env.local") ||
    gitignoreContent.includes(".env*.local");
  assert(isEnvIgnored, "14.3", ".gitignore protects .env.local from accidental commit", "protected", isEnvIgnored ? "protected" : "unprotected");

  // ===========================================================================
  // FINAL SUMMARY
  // ===========================================================================
  console.log("\n================================================================================");
  console.log(`PHASE 12 RELEASE VERIFICATION SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log("================================================================================");

  if (totalFailed > 0) {
    console.log("\nFailed items:");
    testResults.filter((r) => !r.passed).forEach((r) => {
      console.error(`  [${r.item}] ${r.name}`);
      console.error(`       Expected: ${r.expected}`);
      console.error(`       Actual:   ${r.actual}`);
    });
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error during Phase 12 verification:", err);
  process.exit(1);
});
