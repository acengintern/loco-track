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

async function runCreativeProjectsSmokeTest() {
  console.log("================================================================================");
  console.log("SMOKE TEST: CREATIVE ROLE PROJECTS PAGE REFINEMENT");
  console.log("================================================================================\n");

  // 1. Test Graphic Designer Projects Page
  console.log("1. Testing Graphic Designer (Diana Designer) Projects View...");
  const designerCookie = await getRoleSessionCookie("designer@locotrack.local");
  const designerRes = await fetch(`${baseUrl}/projects`, {
    headers: { Cookie: designerCookie },
  });

  assert(designerRes.status === 200, "Designer can access /projects (HTTP 200)");
  const designerHtml = await designerRes.text();

  assert(
    designerHtml.includes("Project Terkait Saya"),
    'Designer sees contextual header "Project Terkait Saya"'
  );
  assert(
    !designerHtml.includes("Direktori Project"),
    'Designer does NOT see managerial header "Direktori Project"'
  );
  assert(
    !designerHtml.includes("Buat Project"),
    'Designer does NOT see "Buat Project" action button'
  );
  assert(
    designerHtml.includes("KPKN-2026-0001") || designerHtml.includes("Campaign Menu Musim Panas"),
    "Designer sees assigned/member project KPKN-2026-0001"
  );
  assert(
    !designerHtml.includes("Project Beta Isolated Campaign") && !designerHtml.includes("ACM-2026-0002"),
    "Designer does NOT see unrelated project ACM-2026-0002 (Zero leakage)"
  );
  assert(
    designerHtml.includes("Tugas Saya") && designerHtml.includes("Status Pengerjaan"),
    'Designer table displays creative execution columns "Tugas Saya" and "Status Pengerjaan"'
  );
  assert(
    designerHtml.includes("Lihat Tugas") && designerHtml.includes("tab=tasks"),
    'Designer has direct quick-action "Lihat Tugas" linking to ?tab=tasks (Kanban)'
  );

  // 2. Test Video Editor Projects Page
  console.log("\n2. Testing Video Editor (Evan Editor) Projects View...");
  const editorCookie = await getRoleSessionCookie("editor@locotrack.local");
  const editorRes = await fetch(`${baseUrl}/projects`, {
    headers: { Cookie: editorCookie },
  });

  assert(editorRes.status === 200, "Editor can access /projects (HTTP 200)");
  const editorHtml = await editorRes.text();

  assert(
    editorHtml.includes("Project Terkait Saya"),
    'Editor sees contextual header "Project Terkait Saya"'
  );
  assert(
    !editorHtml.includes("Direktori Project"),
    'Editor does NOT see managerial header "Direktori Project"'
  );
  assert(
    !editorHtml.includes("Buat Project"),
    'Editor does NOT see "Buat Project" action button'
  );
  assert(
    editorHtml.includes("KPKN-2026-0001") || editorHtml.includes("Campaign Menu Musim Panas"),
    "Editor sees assigned/member project KPKN-2026-0001"
  );
  assert(
    !editorHtml.includes("Project Beta Isolated Campaign") && !editorHtml.includes("ACM-2026-0002"),
    "Editor does NOT see unrelated project ACM-2026-0002 (Zero leakage)"
  );
  assert(
    editorHtml.includes("Lihat Tugas"),
    'Editor has quick-action "Lihat Tugas"'
  );

  // 3. Test Admin Standard vs Creative Preview
  console.log("\n3. Testing Admin Standard vs Mode Kreatif Preview...");
  const adminCookie = await getRoleSessionCookie("admin@locotrack.local");

  // Admin standard view
  const adminRes = await fetch(`${baseUrl}/projects`, {
    headers: { Cookie: adminCookie },
  });
  assert(adminRes.status === 200, "Admin can access standard /projects (HTTP 200)");
  const adminHtml = await adminRes.text();

  assert(
    adminHtml.includes("Direktori Project"),
    'Admin standard view shows managerial header "Direktori Project"'
  );
  assert(
    adminHtml.includes("Buat Project"),
    'Admin standard view has "Buat Project" button'
  );
  assert(
    adminHtml.includes("Mode Kreatif"),
    'Admin standard view has "Mode Kreatif" preview toggle'
  );

  // Admin creative preview view (?view=creative)
  const adminPreviewRes = await fetch(`${baseUrl}/projects?view=creative`, {
    headers: { Cookie: adminCookie },
  });
  assert(adminPreviewRes.status === 200, "Admin can access /projects?view=creative (HTTP 200)");
  const adminPreviewHtml = await adminPreviewRes.text();

  assert(
    adminPreviewHtml.includes("Project Terkait Saya"),
    'Admin in preview mode sees "Project Terkait Saya"'
  );
  assert(
    !adminPreviewHtml.includes("Buat Project"),
    'Admin in preview mode does NOT see "Buat Project"'
  );
  assert(
    adminPreviewHtml.includes("Mode Admin"),
    'Admin in preview mode sees "Mode Admin" return toggle'
  );

  // 4. Test Social Media Specialist (Managerial Role)
  console.log("\n4. Testing Social Media Specialist Managerial View...");
  const smsCookie = await getRoleSessionCookie("sms@locotrack.local");
  const smsRes = await fetch(`${baseUrl}/projects`, {
    headers: { Cookie: smsCookie },
  });
  assert(smsRes.status === 200, "SMS can access /projects (HTTP 200)");
  const smsHtml = await smsRes.text();

  assert(
    smsHtml.includes("Direktori Project"),
    'SMS sees managerial header "Direktori Project"'
  );
  assert(
    smsHtml.includes("Buat Project"),
    'SMS sees "Buat Project" button'
  );
  assert(
    !smsHtml.includes("Mode Kreatif"),
    'SMS does not have Admin preview toggle'
  );

  console.log("\n================================================================================");
  console.log(`TOTAL RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("================================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runCreativeProjectsSmokeTest().catch((err) => {
  console.error("Error executing smoke test:", err);
  process.exit(1);
});
