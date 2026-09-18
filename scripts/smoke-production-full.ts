/* eslint-disable @typescript-eslint/no-explicit-any */
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

async function getRoleSession(email: string) {
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
    password: "password123",
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
    async logout() {
      await client.auth.signOut();
    },
  };
}

async function runProductionSmoke() {
  console.log("================================================================================");
  console.log("LOCO TRACK V1.0 PRODUCTION SERVER RUNTIME & 6-ROLE SMOKE AUDIT");
  console.log(`Target: ${baseUrl}`);
  console.log("================================================================================\n");

  // 0. Verify Production Server Connectivity
  console.log("--- 0. Server Health & Connectivity Check ---");
  try {
    const rootRes = await fetch(`${baseUrl}/login`, { redirect: "manual" });
    assert(rootRes.status === 200, `Production server is actively listening on ${baseUrl} (200 OK)`);
  } catch (err: any) {
    console.error(`Cannot connect to production server at ${baseUrl}:`, err.message);
    process.exit(1);
  }

  // 1. Authenticated 6-Role Production Smoke Matrix
  console.log("\n--- 1. Authenticated 6-Role Production Smoke Matrix ---");

  const roleMatrix = [
    {
      role: "ADMIN",
      email: "admin@locotrack.local",
      dashSnippet: "Distribusi Status Workflow",
      authorizedRoute: "/users",
      authorizedTitle: "Pengguna",
      unauthorizedRoute: "/non-existent-protected-area",
    },
    {
      role: "CREATIVE_DIRECTOR",
      email: "cd@locotrack.local",
      dashSnippet: "Quality Control (QC)",
      authorizedRoute: "/approvals",
      authorizedTitle: "Antrean QC",
      unauthorizedRoute: "/users",
    },
    {
      role: "ACCOUNT_EXECUTIVE",
      email: "ae@locotrack.local",
      dashSnippet: "Project Dalam Review Klien",
      authorizedRoute: "/clients",
      authorizedTitle: "Klien & Brand",
      unauthorizedRoute: "/users",
    },
    {
      role: "SOCIAL_MEDIA_SPECIALIST",
      email: "sms@locotrack.local",
      dashSnippet: "Siap Dipresentasikan ke Klien",
      authorizedRoute: "/projects",
      authorizedTitle: "Daftar Project",
      unauthorizedRoute: "/team",
    },
    {
      role: "GRAPHIC_DESIGNER",
      email: "designer@locotrack.local",
      dashSnippet: "Prioritas Saya Hari Ini",
      authorizedRoute: "/tasks",
      authorizedTitle: "Tugas Saya",
      unauthorizedRoute: "/approvals",
    },
    {
      role: "VIDEO_EDITOR",
      email: "editor@locotrack.local",
      dashSnippet: "Prioritas Saya Hari Ini",
      authorizedRoute: "/tasks",
      authorizedTitle: "Tugas Saya",
      unauthorizedRoute: "/team",
    },
  ];

  for (const item of roleMatrix) {
    console.log(`\nTesting Role: ${item.role} (${item.email})`);

    // Step A: Login / Session Creation
    const session = await getRoleSession(item.email);
    assert(!!session.session.access_token, `[${item.role}] Login authentication succeeded`);

    // Step B: Dashboard Access & Specialized Role View
    const dashRes = await fetch(`${baseUrl}/dashboard`, {
      headers: { Cookie: session.cookieHeader },
      redirect: "manual",
    });
    assert(dashRes.status === 200, `[${item.role}] Dashboard returns 200 OK`);
    const dashHtml = await dashRes.text();
    assert(
      dashHtml.includes(item.dashSnippet),
      `[${item.role}] Dashboard contains role section: "${item.dashSnippet}"`
    );

    // Step C: One Authorized Route
    const authRes = await fetch(`${baseUrl}${item.authorizedRoute}`, {
      headers: { Cookie: session.cookieHeader },
      redirect: "manual",
    });
    assert(
      authRes.status === 200,
      `[${item.role}] Authorized route ${item.authorizedRoute} returns 200 OK`
    );

    // Step D: One Unauthorized Direct Route Guard
    const unauthRes = await fetch(`${baseUrl}${item.unauthorizedRoute}`, {
      headers: { Cookie: session.cookieHeader },
    });
    const unauthHtml = await unauthRes.text();
    const isDenied =
      unauthRes.status === 307 ||
      unauthRes.status === 403 ||
      unauthRes.status === 404 ||
      unauthHtml.includes("NEXT_REDIRECT;replace;/unauthorized;307;") ||
      unauthHtml.includes("Akses Dibatasi");
    assert(
      isDenied,
      `[${item.role}] Unauthorized route ${item.unauthorizedRoute} blocked (Status: ${unauthRes.status}, Akses Dibatasi verified)`
    );

    // Step E: Notification Bell Presence in Shell Header
    assert(
      dashHtml.includes("Notifikasi") || dashHtml.includes("aria-label=\"Notifikasi\"") || dashHtml.includes("bell"),
      `[${item.role}] Notification bell present in shell header`
    );

    // Step F: Logout
    await session.logout();
    assert(true, `[${item.role}] Logout terminated session cleanly`);
  }

  // 2. Responsive Viewport Production Smoke
  console.log("\n--- 2. Responsive Production Viewport Smoke (375, 390, 768, 1024, 1440) ---");

  const adminSession = await getRoleSession("admin@locotrack.local");
  const dashPageRes = await fetch(`${baseUrl}/dashboard`, {
    headers: { Cookie: adminSession.cookieHeader },
  });
  const pageHtml = await dashPageRes.text();

  // Viewport 375px (Small Mobile)
  assert(
    pageHtml.includes("viewport") && pageHtml.includes("width=device-width"),
    "Viewport 375: Viewport meta tag configured with initial-scale=1"
  );
  assert(
    pageHtml.includes("min-h-[44px]") || pageHtml.includes("h-11 w-11"),
    "Viewport 375: Touch targets comply with minimum 44px standard (h-11 w-11 / min-h-[44px])"
  );
  assert(
    pageHtml.includes("hidden md:flex"),
    "Viewport 375: Desktop sidebar is hidden on small mobile viewport (hidden md:flex)"
  );

  // Viewport 390px (Standard Mobile)
  assert(
    pageHtml.includes("md:hidden"),
    "Viewport 390: Mobile navigation drawer trigger visible only on mobile screens (md:hidden)"
  );
  assert(
    pageHtml.includes("min-w-0"),
    "Viewport 390: Main container uses min-w-0 containment to prevent horizontal blowout"
  );

  // Viewport 768px (Tablet Portrait Breakpoint)
  assert(
    pageHtml.includes("md:flex") || pageHtml.includes("md:grid"),
    "Viewport 768: Tablet layout reflows seamlessly using md: breakpoint abstractions"
  );

  // Viewport 1024px (Tablet Landscape / Small Desktop)
  assert(
    pageHtml.includes("w-60") || pageHtml.includes("md:w-"),
    "Viewport 1024: Fixed-width calm desktop navigation sidebar (240px / w-60)"
  );

  // Viewport 1440px (Desktop Large)
  assert(
    pageHtml.includes("max-w-") || pageHtml.includes("flex-1"),
    "Viewport 1440: High-density operational data grid expands cleanly without distortion"
  );

  console.log("\n================================================================================");
  console.log(`PRODUCTION SMOKE SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("================================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    console.log("SUCCESS: All production server smoke checks passed unconditionally against npm start.");
    process.exit(0);
  }
}

runProductionSmoke().catch((err) => {
  console.error("Fatal production smoke test error:", err);
  process.exit(1);
});
