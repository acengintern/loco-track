// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { createClient } from "@supabase/supabase-js";
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

import { createServerClient } from "@supabase/ssr";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
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

async function runPhase11SmokeTests() {
  console.log("=== PHASE 11 LIVE UI & ROLE SMOKE TESTS ===");

  const roles = [
    { email: "admin@locotrack.local", role: "ADMIN", keyContent: "Distribusi Status Workflow" },
    { email: "cd@locotrack.local", role: "CREATIVE_DIRECTOR", keyContent: "Quality Control (QC)" },
    { email: "ae@locotrack.local", role: "ACCOUNT_EXECUTIVE", keyContent: "Project Dalam Review Klien" },
    { email: "sms@locotrack.local", role: "SOCIAL_MEDIA_SPECIALIST", keyContent: "Siap Dipresentasikan ke Klien" },
    { email: "designer@locotrack.local", role: "GRAPHIC_DESIGNER", keyContent: "Daftar Tugas Aktif Saya" },
    { email: "editor@locotrack.local", role: "VIDEO_EDITOR", keyContent: "Daftar Tugas Aktif Saya" },
  ];

  // 1. Role-specific /dashboard rendering
  console.log("\n1. Testing Role-Specific Dashboard Rendering...");
  for (const r of roles) {
    const cookie = await getRoleSessionCookie(r.email);
    const res = await fetch(`${baseUrl}/dashboard`, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });

    assert(res.status === 200, `${r.role} can access /dashboard (200 OK)`);
    const html = await res.text();
    assert(
      html.includes(r.keyContent),
      `${r.role} dashboard contains characteristic UI section: "${r.keyContent}"`
    );
  }

  // 2. Team / Workload page authorization
  console.log("\n2. Testing /team Route Authorization Guard...");
  const teamAllowed = ["admin@locotrack.local", "cd@locotrack.local", "ae@locotrack.local"];
  const teamDenied = ["sms@locotrack.local", "designer@locotrack.local", "editor@locotrack.local"];

  for (const email of teamAllowed) {
    const cookie = await getRoleSessionCookie(email);
    const res = await fetch(`${baseUrl}/team`, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    assert(res.status === 200, `${email} can access /team (200 OK)`);
    const html = await res.text();
    assert(
      html.includes("Matriks Distribusi Beban Kerja"),
      `${email} /team page renders workload matrix table`
    );
  }

  for (const email of teamDenied) {
    const cookie = await getRoleSessionCookie(email);
    const res = await fetch(`${baseUrl}/team`, {
      headers: { Cookie: cookie },
    });
    const html = await res.text();
    const isBlocked =
      res.status === 307 ||
      html.includes("NEXT_REDIRECT;replace;/unauthorized;307;") ||
      html.includes("/unauthorized");
    assert(
      isBlocked,
      `${email} blocked from /team (redirected 307 to /unauthorized)`
    );
  }

  // 3. Activity page access across all roles
  console.log("\n3. Testing /activity Route Access Across All Roles...");
  for (const r of roles) {
    const cookie = await getRoleSessionCookie(r.email);
    const res = await fetch(`${baseUrl}/activity`, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    assert(res.status === 200, `${r.role} can access /activity (200 OK)`);
    const html = await res.text();
    assert(
      html.includes("Log Aktivitas"),
      `${r.role} /activity page renders activity log shell`
    );
  }

  // 4. Notification Bell presence in header
  console.log("\n4. Testing Notification Bell Presence in Shell Header...");
  const adminCookie = await getRoleSessionCookie("admin@locotrack.local");
  const headerRes = await fetch(`${baseUrl}/dashboard`, {
    headers: { Cookie: adminCookie },
  });
  const headerHtml = await headerRes.text();
  assert(
    headerHtml.includes("Notifikasi"),
    "Header contains accessible Notification Bell trigger"
  );

  console.log("\n=============================================");
  console.log(`PHASE 11 LIVE SMOKE TESTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=============================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPhase11SmokeTests().catch((err) => {
  console.error("Live smoke test error:", err);
  process.exit(1);
});
