/**
 * Smoke Test: QC Approvals Queue Upgrade (/approvals)
 * Validates:
 * 1. Strict QC task filtering (only requires_qc = true: GRAPHIC_DESIGN, VIDEO_EDITING).
 * 2. Accurate lifecycle copywriting (Internal QC Approved -> Client Review, never direct publish).
 * 3. Authoritative revision round detection & lineage-safe previous version matching.
 * 4. 4 Metric cards aggregation & rendering.
 * 5. Role-based access control (CD can submit verdict, non-CD read-only, Designer blocked).
 * 6. Clean anti-slop verification (no raw em-dashes, semantic markup).
 */

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getApprovalsQueue, getApprovalQueueStats } from "../src/features/approvals/queries";
import * as fs from "node:fs";
import * as path from "node:path";

// Auto-load .env.local
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

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failedCount++;
  }
}

async function getRoleSession(email: string, password = "password123") {
  let storedCookies: Array<{ name: string; value: string }> = [];
  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => storedCookies,
      setAll: (cookies) => {
        storedCookies = cookies;
      },
    },
  });

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    throw new Error(`Failed to authenticate ${email}: ${error?.message}`);
  }

  const cookieHeader = storedCookies.map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join("; ");

  return {
    client,
    session: data.session,
    user: data.user,
    cookieHeader,
  };
}

async function runApprovalsModuleSmoke() {
  console.log("================================================================================");
  console.log("SMOKE TEST: QC APPROVALS QUEUE UPGRADE (/approvals)");
  console.log("================================================================================\n");

  const targetProjectId = "99e2f078-5e0a-4130-824e-216b7edd312a"; // Active project
  const testAssetGroupId = crypto.randomUUID();

  const testTaskIds = {
    graphicDesign: crypto.randomUUID(),
    videoEditing: crypto.randomUUID(),
    contentPlan: crypto.randomUUID(),
    script: crypto.randomUUID(),
    publishing: crypto.randomUUID(),
  };

  const testFileIds = {
    fileV1: crypto.randomUUID(),
    fileV2: crypto.randomUUID(),
    videoFile: crypto.randomUUID(),
  };

  const testReviewId = crypto.randomUUID();
  const testRevReqId = crypto.randomUUID();

  try {
    // Ensure target project is active and not deleted
    await adminClient
      .from("projects")
      .update({ deleted_at: null, status: "PRODUCTION", deadline: "2026-09-30T03:23:32.658+00:00" })
      .eq("id", targetProjectId);

    // Authenticate sessions
    console.log("Authenticating test sessions...");
    const cdSession = await getRoleSession("cd@locotrack.local");
    const adminSession = await getRoleSession("admin@locotrack.local");
    const aeSession = await getRoleSession("ae@locotrack.local");
    const smsSession = await getRoleSession("sms@locotrack.local");
    const designerSession = await getRoleSession("designer@locotrack.local");

    // Provision test tasks with different disciplines
    console.log("\n1. Provisioning deterministic test tasks across disciplines...");
    const now = new Date();
    const deadlineNear = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(); // +2 days (critical)
    const deadlineFar = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(); // +10 days

    const { error: taskInsertError } = await adminClient.from("tasks").insert([
      {
        id: testTaskIds.graphicDesign,
        project_id: targetProjectId,
        title: "Koleksi Banner Promo Menu Baru (Revisi)",
        task_type: "GRAPHIC_DESIGN",
        requires_qc: true,
        status: "IN_REVIEW",
        priority: "HIGH",
        current_assignee_id: "00000000-0000-0000-0000-000000000005", // Diana Designer
        deadline: deadlineNear,
      },
      {
        id: testTaskIds.videoEditing,
        project_id: targetProjectId,
        title: "Video Reels Promo Launching Durasi 30s",
        task_type: "VIDEO_EDITING",
        requires_qc: true,
        status: "IN_REVIEW",
        priority: "URGENT",
        current_assignee_id: "00000000-0000-0000-0000-000000000006", // Evan Editor
        deadline: deadlineFar,
      },
      {
        id: testTaskIds.contentPlan,
        project_id: targetProjectId,
        title: "Pilar Konten Instagram Feed Bulan Depan",
        task_type: "CONTENT_PLAN",
        requires_qc: false,
        status: "IN_REVIEW",
        priority: "MEDIUM",
        current_assignee_id: "00000000-0000-0000-0000-000000000004", // SMS
        deadline: deadlineNear,
      },
      {
        id: testTaskIds.script,
        project_id: targetProjectId,
        title: "Naskah Voiceover Video Profil Brand",
        task_type: "SCRIPT",
        requires_qc: false,
        status: "IN_REVIEW",
        priority: "LOW",
        current_assignee_id: "00000000-0000-0000-0000-000000000004", // SMS
        deadline: deadlineFar,
      },
      {
        id: testTaskIds.publishing,
        project_id: targetProjectId,
        title: "Publikasi Feed & Story Jadwal Siang",
        task_type: "PUBLISHING",
        requires_qc: false,
        status: "IN_REVIEW",
        priority: "MEDIUM",
        current_assignee_id: "00000000-0000-0000-0000-000000000004", // SMS
        deadline: deadlineNear,
      },
    ]);

    if (taskInsertError) {
      console.warn("Could not insert tasks:", taskInsertError.message);
    } else {
      console.log("  5 test tasks across disciplines provisioned.");
    }

    // Provision multi-version files with lineage on testTaskIds.graphicDesign
    console.log("\n2. Provisioning candidate deliverable files and prior QC revision history...");
    const { error: fileInsertError } = await adminClient.from("project_files").insert([
      {
        id: testFileIds.fileV1,
        project_id: targetProjectId,
        task_id: testTaskIds.graphicDesign,
        asset_group_id: testAssetGroupId,
        version: 1,
        file_name: "banner-promo-v1.png",
        file_type: "DESIGN",
        mime_type: "image/png",
        file_size_bytes: 204800,
        storage_bucket: "deliverables",
        storage_path: `projects/${targetProjectId}/tasks/${testTaskIds.graphicDesign}/banner-promo-v1.png`,
        uploaded_by: "00000000-0000-0000-0000-000000000005",
      },
      {
        id: testFileIds.fileV2,
        project_id: targetProjectId,
        task_id: testTaskIds.graphicDesign,
        asset_group_id: testAssetGroupId,
        version: 2,
        file_name: "banner-promo-v2.png",
        file_type: "DESIGN",
        mime_type: "image/png",
        file_size_bytes: 215400,
        storage_bucket: "deliverables",
        storage_path: `projects/${targetProjectId}/tasks/${testTaskIds.graphicDesign}/banner-promo-v2.png`,
        uploaded_by: "00000000-0000-0000-0000-000000000005",
      },
      {
        id: testFileIds.videoFile,
        project_id: targetProjectId,
        task_id: testTaskIds.videoEditing,
        asset_group_id: crypto.randomUUID(),
        version: 1,
        file_name: "reels-promo-30s.mp4",
        file_type: "VIDEO",
        mime_type: "video/mp4",
        file_size_bytes: 15480000,
        storage_bucket: "deliverables",
        storage_path: `projects/${targetProjectId}/tasks/${testTaskIds.videoEditing}/reels-promo-30s.mp4`,
        uploaded_by: "00000000-0000-0000-0000-000000000006",
      },
    ]);

    if (fileInsertError) {
      console.warn("Could not insert files:", fileInsertError.message);
    } else {
      console.log("  3 deliverable files (image v1, image v2, video) provisioned.");
    }

    // Insert prior QC review and revision request for graphic design task (round 1 rejected)
    const { error: reviewInsertError } = await adminClient.from("qc_reviews").insert({
      id: testReviewId,
      project_id: targetProjectId,
      task_id: testTaskIds.graphicDesign,
      file_id: testFileIds.fileV1,
      reviewer_id: "00000000-0000-0000-0000-000000000002", // Creative Director
      result: "REVISION_REQUESTED",
      notes: "Sesuaikan kontras warna teks headline agar terbaca jelas pada layar mobile.",
      round_number: 1,
    });

    const { error: revReqInsertError } = await adminClient.from("revision_requests").insert({
      id: testRevReqId,
      project_id: targetProjectId,
      task_id: testTaskIds.graphicDesign,
      assigned_to: "00000000-0000-0000-0000-000000000005", // Diana Designer
      qc_review_id: testReviewId,
      requested_by: "00000000-0000-0000-0000-000000000002",
      source: "INTERNAL_QC",
      round_number: 1,
      notes: "Sesuaikan kontras warna teks headline agar terbaca jelas pada layar mobile.",
      status: "RESOLVED",
    });

    if (reviewInsertError || revReqInsertError) {
      console.warn("Could not insert prior review:", reviewInsertError?.message || revReqInsertError?.message);
    } else {
      console.log("  Prior QC review and revision request (Round 1) recorded.");
    }

    // 3. User Correction 1: Strict Task Filtering Verification
    console.log("\n3. Testing User Correction #1: Strict QC Task Discipline Filtering...");
    const queueItems = await getApprovalsQueue(cdSession.client as unknown as Parameters<typeof getApprovalsQueue>[0]);
    const taskIdsInQueue = queueItems.map((i) => i.task_id);

    assert(
      taskIdsInQueue.includes(testTaskIds.graphicDesign),
      "GRAPHIC_DESIGN task is present in QC Approvals Queue"
    );
    assert(
      taskIdsInQueue.includes(testTaskIds.videoEditing),
      "VIDEO_EDITING task is present in QC Approvals Queue"
    );
    assert(
      !taskIdsInQueue.includes(testTaskIds.contentPlan),
      "CONTENT_PLAN task is EXCLUDED from QC Queue (requires_qc = false)"
    );
    assert(
      !taskIdsInQueue.includes(testTaskIds.script),
      "SCRIPT task is EXCLUDED from QC Queue (requires_qc = false)"
    );
    assert(
      !taskIdsInQueue.includes(testTaskIds.publishing),
      "PUBLISHING task is EXCLUDED from QC Queue (requires_qc = false)"
    );

    // Verify all items in queue are strictly GRAPHIC_DESIGN or VIDEO_EDITING
    const invalidTypes = queueItems.filter(
      (i) => i.task_type !== "GRAPHIC_DESIGN" && i.task_type !== "VIDEO_EDITING"
    );
    assert(
      invalidTypes.length === 0,
      `100% of tasks in QC queue are strictly GRAPHIC_DESIGN or VIDEO_EDITING (found ${invalidTypes.length} invalid)`
    );

    // 4. User Correction 3: Authoritative Revision Round Detection & Lineage Matching
    console.log("\n4. Testing User Correction #3: Authoritative Revision Round & Lineage Matching...");
    const designItem = queueItems.find((i) => i.task_id === testTaskIds.graphicDesign);
    assert(Boolean(designItem), "Found test graphic design item in queue");

    if (designItem) {
      assert(designItem.has_prior_revisions === true, "Item authoritatively detected as revision round (has_prior_revisions = true)");
      assert(designItem.qc_round === 2, `Item round correctly computed as round 2 (actual: ${designItem.qc_round})`);
      assert(designItem.latest_file?.version === 2, "Latest candidate version is v2");
      assert(Boolean(designItem.previous_file), "Lineage-safe previous version is matched");
      assert(designItem.previous_file?.version === 1, "Previous file version is v1");
      assert(
        designItem.previous_revision_notes?.includes("kontras warna teks headline") || false,
        "Previous revision notes correctly retrieved from round history"
      );
    }

    const videoItem = queueItems.find((i) => i.task_id === testTaskIds.videoEditing);
    assert(Boolean(videoItem), "Found test video editing item in queue");
    if (videoItem) {
      assert(videoItem.has_prior_revisions === false, "First-time video submission has has_prior_revisions = false");
      assert(videoItem.qc_round === 1, "First-time video submission is Ronde 1");
      assert(videoItem.latest_file?.mime_type === "video/mp4", "Video item retains correct video/mp4 mime type");
    }

    // 5. Metric Cards Aggregation Calculation
    console.log("\n5. Testing 4 Metric Cards Aggregation (getApprovalQueueStats)...");
    const stats = getApprovalQueueStats(queueItems);

    assert(stats.totalInReview === queueItems.length, `totalInReview matches total items (${stats.totalInReview})`);
    assert(stats.urgentCount >= 2, `urgentCount reflects HIGH and URGENT items (${stats.urgentCount})`);
    assert(stats.revisionRoundCount >= 1, `revisionRoundCount counts items with prior revisions (${stats.revisionRoundCount})`);
    assert(stats.criticalDeadlineCount >= 1, `criticalDeadlineCount detects deadlines <= 3 days (${stats.criticalDeadlineCount})`);

    // 6. Route Access & Authorization Matrix
    console.log("\n6. Testing Route Access Controls on /approvals...");

    const cdRes = await fetch(`${baseUrl}/approvals`, {
      headers: { Cookie: cdSession.cookieHeader },
      redirect: "manual",
    });
    assert(cdRes.status === 200, "Creative Director can access /approvals (HTTP 200)");

    const adminRes = await fetch(`${baseUrl}/approvals`, {
      headers: { Cookie: adminSession.cookieHeader },
      redirect: "manual",
    });
    assert(adminRes.status === 200, "Admin can access /approvals for inspection (HTTP 200)");

    const aeRes = await fetch(`${baseUrl}/approvals`, {
      headers: { Cookie: aeSession.cookieHeader },
      redirect: "manual",
    });
    assert(aeRes.status === 200, "Account Executive can access /approvals for inspection (HTTP 200)");

    const smsRes = await fetch(`${baseUrl}/approvals`, {
      headers: { Cookie: smsSession.cookieHeader },
      redirect: "manual",
    });
    assert(smsRes.status === 200, "Social Media Specialist can access /approvals for inspection (HTTP 200)");

    const designerRes = await fetch(`${baseUrl}/approvals`, {
      headers: { Cookie: designerSession.cookieHeader },
      redirect: "manual",
    });
    const designerText = await designerRes.text();
    const isDesignerBlocked =
      designerRes.status === 403 ||
      designerRes.status === 307 ||
      designerRes.status === 302 ||
      designerText.includes("Akses Dibatasi") ||
      designerText.includes("unauthorized") ||
      designerText.includes("NEXT_REDIRECT");
    assert(isDesignerBlocked, "Graphic Designer is blocked from accessing /approvals (HTTP redirect / 403 / Akses Dibatasi)");

    // 7. Rendered HTML Verification (Cards, Filters, Lifecycle Copy, Anti-Slop)
    console.log("\n7. Testing Rendered HTML Markup on /approvals...");
    const cdHtml = await (
      await fetch(`${baseUrl}/approvals`, {
        headers: { Cookie: cdSession.cookieHeader },
      })
    ).text();

    // Strip script tags to test visible UI copy
    const cleanHtml = cdHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

    // Check 4 Metric Cards in DOM
    assert(cleanHtml.includes("Menunggu Review QC"), "Metric Card 1 'Menunggu Review QC' rendered");
    assert(cleanHtml.includes("Prioritas Mendesak"), "Metric Card 2 'Prioritas Mendesak' rendered");
    assert(cleanHtml.includes("Putaran Revisi"), "Metric Card 3 'Putaran Revisi' rendered");
    assert(cleanHtml.includes("Tenggat Kritis"), "Metric Card 4 'Tenggat Kritis' rendered");

    // Check Filter dropdown elements
    assert(cleanHtml.includes("Semua Tipe Disiplin"), "Filter option 'Semua Tipe Disiplin' present");
    assert(cleanHtml.includes("Desain Grafis"), "Filter option 'Desain Grafis' present");
    assert(cleanHtml.includes("Video Editing"), "Filter option 'Video Editing' present");

    // Strict check: Content Plan, Script, Publishing must NOT be in the discipline select
    assert(
      !cleanHtml.includes(">Content Plan<") && !cleanHtml.includes(">Script<") && !cleanHtml.includes(">Publishing<"),
      "Discipline filter strictly excludes Content Plan, Script, and Publishing options"
    );

    // User Correction 2: Lifecycle Flow Copywriting
    console.log("\n8. Testing User Correction #2: Accurate Lifecycle Flow Copywriting...");
    assert(
      !cleanHtml.includes("siap publikasi") && !cleanHtml.includes("langsung publikasi"),
      "Zero false claims that QC Approved means ready for publishing"
    );
    assert(
      cleanHtml.includes("peninjauan klien") || cleanHtml.includes("Client Review") || cleanHtml.includes("klien"),
      "Accurate lifecycle copy explains deliverable advances to Client Review"
    );

    // Anti-slop check
    console.log("\n9. Testing Anti-Slop Cleanliness...");
    const hasRawEmDash = cleanHtml.includes("—");
    assert(!hasRawEmDash, "Zero raw em-dashes (—) in rendered HTML");

    // Check accessibility markers
    assert(cleanHtml.includes("aria-label="), "Accessible aria-label attributes present");
    assert(cleanHtml.includes("<time"), "Semantic <time> elements used for timestamps");

    // 10. End-to-End QC Verdict Submission
    console.log("\n10. Testing End-to-End QC Verdict Submission via RPC...");
    // Submit QC Approval on the video task
    const { error: rpcError } = await cdSession.client.rpc("submit_qc_verdict", {
      p_task_id: testTaskIds.videoEditing,
      p_verdict: "APPROVED",
      p_notes: "",
    });

    assert(!rpcError, `Creative Director submitted APPROVED verdict successfully (${rpcError?.message || "OK"})`);

    // Verify task status transitioned
    const { data: updatedTask } = await adminClient
      .from("tasks")
      .select("status")
      .eq("id", testTaskIds.videoEditing)
      .single();

    assert(
      updatedTask?.status === "APPROVED",
      `Task status transitioned to APPROVED in database (actual: ${updatedTask?.status})`
    );

    // Verify non-CD role cannot submit verdict
    const { error: unauthorizedError } = await designerSession.client.rpc("submit_qc_verdict", {
      p_task_id: testTaskIds.graphicDesign,
      p_verdict: "APPROVED",
      p_notes: "",
    });
    assert(
      Boolean(unauthorizedError),
      "Non-CD role (Designer) is rejected from submitting QC verdict via RPC"
    );

  } catch (err) {
    console.error("Unexpected error in smoke test:", err);
    failedCount++;
  } finally {
    // Teardown test artifacts (soft delete to respect append-only constraints)
    console.log("\nTeardown: Cleaning up test artifacts...");
    await adminClient.from("tasks").update({ deleted_at: new Date().toISOString() }).in("id", Object.values(testTaskIds));
    await adminClient.from("project_files").update({ deleted_at: new Date().toISOString() }).in("id", Object.values(testFileIds));
    console.log("Cleanup complete.");
  }

  console.log("\n================================================================================");
  console.log(`SMOKE TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("================================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runApprovalsModuleSmoke().catch((e) => {
  console.error("Unhandled rejection:", e);
  process.exit(1);
});
