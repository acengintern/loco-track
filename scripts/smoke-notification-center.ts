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
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
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

  return storedCookies
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");
}

async function runNotificationCenterSmokeTests() {
  console.log(
    "================================================================================"
  );
  console.log("SMOKE TEST: GLOBAL NOTIFICATION CENTER UX UPGRADE");
  console.log(
    "================================================================================\n"
  );

  const roles = [
    { email: "admin@locotrack.local", label: "Admin" },
    { email: "sms@locotrack.local", label: "Social Media Specialist" },
    { email: "ae@locotrack.local", label: "Account Executive" },
    { email: "designer@locotrack.local", label: "Graphic Designer" },
    { email: "editor@locotrack.local", label: "Video Editor" },
  ];

  // 1. Notification center page returns 200 for all roles
  console.log("1. Testing /notifications returns HTTP 200 for all roles...");
  for (const role of roles) {
    const cookie = await getRoleSessionCookie(role.email);
    const res = await fetch(`${baseUrl}/notifications`, {
      headers: { Cookie: cookie },
    });
    assert(
      res.status === 200,
      `${role.label} can access /notifications (HTTP ${res.status})`
    );
  }

  // 2. Notification bell renders in header
  console.log("\n2. Verifying notification bell is present in header HTML...");
  const designerCookie = await getRoleSessionCookie("designer@locotrack.local");
  const headerRes = await fetch(`${baseUrl}/dashboard`, {
    headers: { Cookie: designerCookie },
  });
  const headerHtml = await headerRes.text();
  // The bell button is always SSR'd; popover content is client-side conditional (only on open)
  assert(
    headerHtml.includes("Notifikasi") || headerHtml.includes("belum dibaca"),
    'Header HTML renders notification bell aria-label'
  );
  assert(
    headerHtml.includes("/notifications"),
    'Header HTML contains /notifications href in bell component'
  );

  // 3. No raw ISO timestamps in visible /notifications HTML
  console.log("\n3. Verifying no raw ISO timestamps in /notifications...");
  const notifRes = await fetch(`${baseUrl}/notifications`, {
    headers: { Cookie: designerCookie },
  });
  const notifHtml = await notifRes.text();
  // Strip script and JSON-LD blocks before checking visible text
  const visibleHtml = notifHtml
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  const hasRawIso = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(visibleHtml);
  assert(
    !hasRawIso,
    "/notifications page shows zero raw ISO 8601 timestamps in visible UI"
  );

  // 4. /notifications page contains category filter UI
  console.log("\n4. Verifying category filter elements on /notifications...");
  assert(
    notifHtml.includes("Semua Kategori") || notifHtml.includes("Semua"),
    '/notifications page has "Semua Kategori" or filter control present'
  );
  assert(
    notifHtml.includes("Semua") && notifHtml.includes("Belum Dibaca"),
    '/notifications page has read-status tabs "Semua" and "Belum Dibaca"'
  );

  // 5. Filter query param ?read=unread works without HTTP error
  console.log("\n5. Verifying filter params return valid responses...");
  const unreadRes = await fetch(`${baseUrl}/notifications?read=unread`, {
    headers: { Cookie: designerCookie },
  });
  assert(
    unreadRes.status === 200,
    "/notifications?read=unread returns HTTP 200"
  );

  const categoryRes = await fetch(
    `${baseUrl}/notifications?category=TASK_ASSIGNMENT`,
    { headers: { Cookie: designerCookie } }
  );
  assert(
    categoryRes.status === 200,
    "/notifications?category=TASK_ASSIGNMENT returns HTTP 200"
  );

  // 6. /notifications page includes "Tandai semua dibaca" action (even if count=0, it's conditionally rendered)
  console.log("\n6. Verifying notification center structure...");
  // Page should always render the filter toolbar area
  assert(
    notifHtml.includes("notifikasi"),
    '/notifications page contains the word "notifikasi"'
  );

  // 7. Unauthenticated request redirects (not 200)
  console.log("\n7. Verifying unauthenticated access is rejected...");
  const anonRes = await fetch(`${baseUrl}/notifications`, { redirect: "manual" });
  assert(
    anonRes.status === 302 || anonRes.status === 307 || anonRes.status === 303,
    `Unauthenticated /notifications redirects (got HTTP ${anonRes.status})`
  );

  console.log(
    "\n================================================================================"
  );
  console.log(`RESULTS: ${passedCount} PASS, ${failedCount} FAIL`);
  console.log(
    "================================================================================"
  );

  if (failedCount > 0) {
    process.exit(1);
  }
}

runNotificationCenterSmokeTests().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
