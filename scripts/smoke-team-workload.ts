/**
 * Smoke Test: Creative Director Team Workload Operational Snapshot
 * Validates route guards, visual snapshot components, data parity,
 * accessibility attributes, human copy standards, and empty state.
 */

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { getTeamWorkloadData } from "../src/features/team/queries";
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

async function runTeamWorkloadSmoke() {
  console.log("================================================================================");
  console.log("SMOKE TEST: CD TEAM WORKLOAD OPERATIONAL SNAPSHOT & DATA PARITY");
  console.log("================================================================================\n");

  const testTaskIds = [
    "fa000000-0000-4000-a000-000000000001",
    "fa000000-0000-4000-a000-000000000002",
    "fa000000-0000-4000-a000-000000000003",
  ];
  const targetProjectId = "99e2f078-5e0a-4130-824e-216b7edd312a"; // active PRODUCTION project

  try {
    // 0. Setup Deterministic Test Tasks
    console.log("0. Setting up deterministic test tasks for team workload snapshot...");
    await adminClient.from("tasks").delete().in("id", testTaskIds);

    const { error: insertError } = await adminClient.from("tasks").insert([
      {
        id: testTaskIds[0],
        project_id: targetProjectId,
        title: "Desain Feed Instagram Reveal Menu",
        task_type: "GRAPHIC_DESIGN",
        status: "IN_PROGRESS",
        priority: "HIGH",
        current_assignee_id: "00000000-0000-0000-0000-000000000005", // Diana Designer
        deadline: "2026-09-22T10:00:00Z",
      },
      {
        id: testTaskIds[1],
        project_id: targetProjectId,
        title: "Revisi Format Story Promo",
        task_type: "GRAPHIC_DESIGN",
        status: "REVISION_REQUESTED",
        priority: "URGENT",
        current_assignee_id: "00000000-0000-0000-0000-000000000005", // Diana Designer
        deadline: "2026-09-20T10:00:00Z",
      },
      {
        id: testTaskIds[2],
        project_id: targetProjectId,
        title: "Rough Cut Video Teaser Reels",
        task_type: "VIDEO_EDITING",
        status: "TODO",
        priority: "MEDIUM",
        current_assignee_id: "00000000-0000-0000-0000-000000000006", // Evan Editor
        deadline: "2026-09-25T10:00:00Z",
      },
    ]);

    if (insertError) {
      console.warn("Could not insert test tasks:", insertError.message);
    } else {
      console.log("  3 test tasks provisioned successfully.");
    }

    // 1. Route Access Controls
    console.log("\n1. Testing Route Access Controls on /team...");
    const cdSession = await getRoleSession("cd@locotrack.local");
    const adminSession = await getRoleSession("admin@locotrack.local");
    const designerSession = await getRoleSession("designer@locotrack.local");

    const cdRes = await fetch(`${baseUrl}/team`, {
      headers: { Cookie: cdSession.cookieHeader },
      redirect: "manual",
    });
    assert(cdRes.status === 200, "Creative Director can access /team (HTTP 200)");

    const adminRes = await fetch(`${baseUrl}/team`, {
      headers: { Cookie: adminSession.cookieHeader },
      redirect: "manual",
    });
    assert(adminRes.status === 200, "Admin can access /team (HTTP 200)");

    const designerRes = await fetch(`${baseUrl}/team`, {
      headers: { Cookie: designerSession.cookieHeader },
      redirect: "manual",
    });
    const designerText = await designerRes.text();
    const designerBlocked =
      designerRes.status === 307 ||
      designerRes.status === 403 ||
      designerText.includes("Akses Dibatasi") ||
      designerText.includes("NEXT_REDIRECT");
    assert(designerBlocked, "Graphic Designer is denied access to /team (Redirect to unauthorized)");

    // 2. UI Content & Component Structure
    console.log("\n2. Verifying UI Elements on /team for Creative Director...");
    const cdHtml = await cdRes.text();

    // Metric Cards
    assert(cdHtml.includes("Personel Kreatif Aktif"), 'Metric card "Personel Kreatif Aktif" is present');
    assert(cdHtml.includes("Total Tugas Berjalan"), 'Metric card "Total Tugas Berjalan" is present');
    assert(cdHtml.includes("Mendekati Deadline"), 'Metric card "Mendekati Deadline" is present');
    assert(cdHtml.includes("Melewati Deadline"), 'Metric card "Melewati Deadline" is present');

    // Snapshot Section Headers
    assert(cdHtml.includes("Snapshot Beban Tim"), 'Section "Snapshot Beban Tim" is present');
    assert(cdHtml.includes("Beban per Personel"), 'Visual A "Beban per Personel" is present');
    assert(cdHtml.includes("Distribusi Status Tugas"), 'Visual B "Distribusi Status Tugas" is present');
    assert(cdHtml.includes("Risiko Deadline"), 'Visual C "Risiko Deadline" is present');
    assert(cdHtml.includes("Deadline Terdekat"), 'Section "Deadline Terdekat" strip is present');
    assert(cdHtml.includes("Matriks Distribusi Beban Kerja"), 'Detail Table "Matriks Distribusi Beban Kerja" is present');

    // 3. Accessibility & Semantic Compliance
    console.log("\n3. Verifying Accessibility & Semantic Attributes...");
    assert(cdHtml.includes('role="group"'), 'Semantic role="group" is used for segmented visualization');
    assert(!cdHtml.includes('role="progressbar"'), 'role="progressbar" is NOT used for non-target visual progress');

    // 4. Human Copy Standards
    console.log("\n4. Verifying Human Copy Standards...");
    assert(cdHtml.includes("Belum Dikerjakan"), 'Human label "Belum Dikerjakan" is used (not raw TODO)');
    assert(cdHtml.includes("Proses"), 'Human label "Proses" is used');
    assert(cdHtml.includes("Revisi"), 'Human label "Revisi" is used');
    assert(cdHtml.includes("QC"), 'Human label "QC" is used');

    // Verify no raw unmapped enum headers in visible UI
    const visibleHtml = cdHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    assert(!visibleHtml.includes("<th>TODO</th>"), "Table does not contain raw <th>TODO</th>");
    assert(!visibleHtml.includes("IN_PROGRESS"), "Visible UI does not contain raw enum IN_PROGRESS");
    assert(!visibleHtml.includes("REVISION_REQUESTED"), "Visible UI does not contain raw enum REVISION_REQUESTED");

    // Check for raw ISO timestamps in rendered markup
    const rawIsoMatch = visibleHtml.match(/>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    assert(!rawIsoMatch, "/team contains zero raw ISO timestamps in visible HTML");

    // 5. Query Integrity & Single Source of Truth Parity
    console.log("\n5. Testing Query Integrity & Single Source of Truth Data Parity...");
    const data = await getTeamWorkloadData(cdSession.client);

    assert(data.totalActiveCreatives >= 2, `Active creatives found: ${data.totalActiveCreatives}`);
    assert(data.totalActiveTasks >= 3, `Total active tasks detected: ${data.totalActiveTasks}`);
    assert(data.statusDistribution.total === data.totalActiveTasks, `statusDistribution.total (${data.statusDistribution.total}) matches totalActiveTasks (${data.totalActiveTasks})`);

    const statusSum =
      data.statusDistribution.todo +
      data.statusDistribution.inProgress +
      data.statusDistribution.revision +
      data.statusDistribution.inReview;
    assert(statusSum === data.totalActiveTasks, `Sum of status segments (${statusSum}) equals total active tasks (${data.totalActiveTasks})`);

    const riskSum =
      data.deadlineRisk.overdue +
      data.deadlineRisk.dueSoon +
      data.deadlineRisk.safe +
      data.deadlineRisk.noDeadline;
    assert(riskSum === data.totalActiveTasks, `Sum of risk segments (${riskSum}) equals total active tasks (${data.totalActiveTasks})`);

    const memberTaskSum = data.members.reduce((acc, m) => acc + m.totalActiveTasks, 0);
    assert(memberTaskSum === data.totalActiveTasks, `Sum of member tasks (${memberTaskSum}) equals total active tasks (${data.totalActiveTasks})`);

    // Nearest deadlines ordering verification
    assert(data.nearestDeadlines.length <= 5, `nearestDeadlines is capped at max 5 items (actual: ${data.nearestDeadlines.length})`);

    if (data.nearestDeadlines.length > 1) {
      let correctlyOrdered = true;
      for (let i = 0; i < data.nearestDeadlines.length - 1; i++) {
        const current = data.nearestDeadlines[i];
        const next = data.nearestDeadlines[i + 1];
        if (!current.isOverdue && next.isOverdue) {
          correctlyOrdered = false;
          break;
        }
      }
      assert(correctlyOrdered, "nearestDeadlines maintains actionable ordering (overdue items prioritized first)");
    } else {
      assert(true, "nearestDeadlines ordering invariant holds");
    }
  } finally {
    // 6. Cleanup & Empty State Verification
    console.log("\n6. Cleaning up test tasks & verifying empty state behavior...");
    await adminClient.from("tasks").delete().in("id", testTaskIds);

    const cdSession = await getRoleSession("cd@locotrack.local");
    const emptyRes = await fetch(`${baseUrl}/team`, {
      headers: { Cookie: cdSession.cookieHeader },
      redirect: "manual",
    });
    const emptyHtml = await emptyRes.text();
    const hasEmptyState = emptyHtml.includes("Belum ada tugas aktif untuk divisualisasikan.");
    assert(hasEmptyState, 'Empty state banner correctly rendered when creative tasks count is 0');
  }

  console.log("\n================================================================================");
  console.log(`RESULTS: ${passedCount} PASS, ${failedCount} FAIL`);
  console.log("================================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTeamWorkloadSmoke().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
