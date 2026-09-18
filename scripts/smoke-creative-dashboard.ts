import { createServerClient } from "@supabase/ssr";
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

async function getRoleSessionCookie(email: string): Promise<string> {
  let storedCookies: Array<{ name: string; value: string }> = [];
  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => storedCookies,
      setAll: (cookies) => {
        storedCookies = cookies;
      },
    },
  });

  const { error } = await client.auth.signInWithPassword({
    email,
    password: "password123",
  });

  if (error) {
    throw new Error(`Failed to sign in as ${email}: ${error.message}`);
  }

  return storedCookies.map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join("; ");
}

async function runCreativeDashboardSmokeTests() {
  console.log("================================================================================");
  console.log("SMOKE TEST: REFINED CREATIVE DASHBOARD (ACTIONABLE WORK VIEW)");
  console.log("================================================================================\n");

  // 1. Test Graphic Designer Dashboard
  console.log("1. Testing Graphic Designer (Diana Designer) Dashboard...");
  const designerCookie = await getRoleSessionCookie("designer@locotrack.local");
  const designerRes = await fetch(`${baseUrl}/dashboard`, {
    headers: { Cookie: designerCookie },
  });

  assert(designerRes.status === 200, "Designer can access /dashboard (HTTP 200)");
  const designerHtml = await designerRes.text();

  // 4 Metric Cards Verification
  assert(
    designerHtml.includes("Tugas Aktif Saya"),
    'Dashboard has metric card "Tugas Aktif Saya"'
  );
  assert(
    designerHtml.includes("Perlu Revisi"),
    'Dashboard has metric card "Perlu Revisi"'
  );
  assert(
    designerHtml.includes("Deadline Dekat / Terlambat"),
    'Dashboard has metric card "Deadline Dekat / Terlambat"'
  );
  assert(
    designerHtml.includes("Menunggu Review QC"),
    'Dashboard has metric card "Menunggu Review QC"'
  );
  assert(
    !designerHtml.includes("Sedang Dikerjakan"),
    'Dashboard no longer has redundant "Sedang Dikerjakan" metric card'
  );

  // Section: Prioritas Saya Hari Ini
  assert(
    designerHtml.includes("Prioritas Saya Hari Ini"),
    'Dashboard contains main section "Prioritas Saya Hari Ini"'
  );

  // Check that no ISO strings are rendered in visible HTML (outside script tags)
  const visibleHtml = designerHtml.replace(/<script[\s\S]*?<\/script>/gi, "");
  const hasIsoDate = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(visibleHtml);
  assert(!hasIsoDate, "Dashboard contains zero raw ISO timestamps in visible UI");

  // Section: Project Saya
  if (designerHtml.includes("Project Saya")) {
    assert(
      designerHtml.includes("Lihat Task"),
      'Section "Project Saya" provides direct "Lihat Task" action'
    );
  } else {
    console.log("  [INFO] Designer currently has 0 active projects");
  }

  // Section: Feedback Terbaru or Clean Empty State
  if (designerHtml.includes("Feedback Terbaru")) {
    assert(
      designerHtml.includes("Buka Tugas"),
      'Feedback section provides direct "Buka Tugas" CTA'
    );
    assert(
      designerHtml.includes("Revisi Internal") || designerHtml.includes("Revisi dari Client"),
      'Feedback section distinguishes "Revisi Internal" vs "Revisi dari Client"'
    );
  }

  // 2. Test Video Editor Dashboard
  console.log("\n2. Testing Video Editor (Evan Editor) Dashboard...");
  const editorCookie = await getRoleSessionCookie("editor@locotrack.local");
  const editorRes = await fetch(`${baseUrl}/dashboard`, {
    headers: { Cookie: editorCookie },
  });

  assert(editorRes.status === 200, "Editor can access /dashboard (HTTP 200)");
  const editorHtml = await editorRes.text();

  assert(
    editorHtml.includes("Tugas Aktif Saya") &&
      editorHtml.includes("Perlu Revisi") &&
      editorHtml.includes("Deadline Dekat / Terlambat") &&
      editorHtml.includes("Menunggu Review QC"),
    "Editor receives the identical 4 metric cards"
  );
  assert(
    editorHtml.includes("Prioritas Saya Hari Ini"),
    'Editor receives "Prioritas Saya Hari Ini" section'
  );

  // Check accurate empty state if Editor has 0 active tasks
  if (!editorHtml.includes("Daftar Tugas Aktif Saya")) {
    assert(
      editorHtml.includes("Semua tugas Anda sudah selesai.") ||
        editorHtml.includes("Belum ada tugas yang ditugaskan."),
      "Editor with 0 active tasks receives accurate contextual empty state"
    );
  }

  console.log("\n================================================================================");
  console.log(`TOTAL RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("================================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runCreativeDashboardSmokeTests().catch((err) => {
  console.error("Error executing smoke test:", err);
  process.exit(1);
});
