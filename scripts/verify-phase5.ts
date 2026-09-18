import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

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

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    totalPassed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    totalFailed++;
  }
}

async function createAuthenticatedClient(email: string) {
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

async function runVerification() {
  console.log("=== PHASE 5 AUTOMATED VERIFICATION SUITE ===\n");

  // Authenticate test users
  console.log("1. Authenticating test users...");
  const adminAuth = await createAuthenticatedClient("admin@locotrack.local");
  const smsAuth = await createAuthenticatedClient("sms@locotrack.local");
  const cdAuth = await createAuthenticatedClient("cd@locotrack.local");
  const designerAuth = await createAuthenticatedClient("designer@locotrack.local");

  assert(Boolean(adminAuth.user.id), "Admin authenticated");
  assert(Boolean(smsAuth.user.id), "SMS authenticated");
  assert(Boolean(cdAuth.user.id), "CD authenticated");
  assert(Boolean(designerAuth.user.id), "Designer authenticated");

  // -------------------------------------------------------------
  // Test 2: Client CRUD and Permission Boundaries
  // -------------------------------------------------------------
  console.log("\n2. Client CRUD & Permissions...");

  // Admin creates client
  const testClientName = `Client Test ${Date.now()}`;
  const { data: clientAdmin, error: errAdminClient } = await adminAuth.client
    .from("clients")
    .insert({
      name: testClientName,
      description: "Deskripsi client untuk testing",
      contact_name: "Budi Santoso",
      contact_email: "budi@test.com",
      created_by: adminAuth.user.id,
    })
    .select("id, name")
    .single();

  assert(!errAdminClient && clientAdmin?.name === testClientName, "ADMIN can create client");

  // SMS creates client
  const testClientSMS = `Client SMS ${Date.now()}`;
  const { data: clientSMS, error: errSMSClient } = await smsAuth.client
    .from("clients")
    .insert({
      name: testClientSMS,
      description: "Dibuat oleh SMS",
      contact_name: "Ani Wijaya",
      created_by: smsAuth.user.id,
    })
    .select("id, name")
    .single();

  assert(!errSMSClient && clientSMS?.name === testClientSMS, "SMS can create client");

  if (!clientAdmin || !clientSMS) {
    throw new Error("Client creation prerequisite failed.");
  }

  // Designer cannot create client (RLS rejection)
  const { error: errDesignerClient } = await designerAuth.client
    .from("clients")
    .insert({
      name: "Illegal Client",
      created_by: designerAuth.user.id,
    });

  assert(Boolean(errDesignerClient), "DESIGNER is rejected from creating client by RLS");

  // SMS updates client
  const { error: errUpdateClient } = await smsAuth.client
    .from("clients")
    .update({ description: "Deskripsi diperbarui oleh SMS" })
    .eq("id", clientSMS.id);

  assert(!errUpdateClient, "SMS can update client");

  // SMS cannot soft-delete client (Admin only)
  const { error: errSMSDeleteClient } = await smsAuth.client
    .from("clients")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", clientSMS.id);

  assert(Boolean(errSMSDeleteClient), "SMS is rejected from archiving/deleting client by RLS");

  // Admin can soft-delete client
  const { error: errAdminDeleteClient } = await adminAuth.client
    .from("clients")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", clientSMS.id);

  assert(!errAdminDeleteClient, "ADMIN can archive client");

  // -------------------------------------------------------------
  // Test 3: Brand CRUD and Code Uniqueness
  // -------------------------------------------------------------
  console.log("\n3. Brand CRUD & Uniqueness...");

  const brandCodeA = `BR${Math.floor(1000 + Math.random() * 9000)}`;
  const { data: brandA, error: errCreateBrandA } = await smsAuth.client
    .from("brands")
    .insert({
      client_id: clientAdmin.id,
      name: "Brand Alpha",
      code: brandCodeA,
      description: "Brand testing alpha",
      created_by: smsAuth.user.id,
    })
    .select("id, code, name")
    .single();

  assert(!errCreateBrandA && brandA?.code === brandCodeA, "SMS can create brand");

  if (!brandA) {
    throw new Error("Brand A creation prerequisite failed.");
  }

  // Duplicate brand code must fail
  const { error: errDuplicateBrand } = await smsAuth.client
    .from("brands")
    .insert({
      client_id: clientAdmin.id,
      name: "Brand Duplicate",
      code: brandCodeA,
      created_by: smsAuth.user.id,
    });

  assert(Boolean(errDuplicateBrand), "Duplicate brand code is rejected by unique constraint");

  // Designer cannot create brand
  const { error: errDesignerBrand } = await designerAuth.client
    .from("brands")
    .insert({
      client_id: clientAdmin.id,
      name: "Illegal Brand",
      code: `XX${Math.floor(1000 + Math.random() * 9000)}`,
      created_by: designerAuth.user.id,
    });

  assert(Boolean(errDesignerBrand), "DESIGNER is rejected from creating brand by RLS");

  // -------------------------------------------------------------
  // Test 4: Project Creation and Atomic Code Generation
  // -------------------------------------------------------------
  console.log("\n4. Project Creation & Code Generation...");

  // Generate atomic project code via RPC
  const { data: code1, error: errRpc1 } = await smsAuth.client.rpc(
    "generate_project_code",
    { p_brand_id: brandA.id }
  );

  assert(!errRpc1 && typeof code1 === "string", `Project code generated: ${code1}`);
  const currentYear = new Date().getFullYear();
  assert(
    code1.startsWith(`${brandCodeA}-${currentYear}-`),
    `Code format matches ${brandCodeA}-${currentYear}-XXXX`
  );

  // SMS creates project
  const testProjectName = "Project Alpha Campaign";
  const deadlineStr = new Date(Date.now() + 14 * 86400000).toISOString();
  const { data: project1, error: errInsertProj1 } = await smsAuth.client
    .from("projects")
    .insert({
      project_code: code1,
      brand_id: brandA.id,
      name: testProjectName,
      status: "BRIEF_RECEIVED",
      priority: "HIGH",
      start_date: new Date().toISOString().split("T")[0],
      deadline: deadlineStr,
      sms_owner_id: smsAuth.user.id,
      created_by: smsAuth.user.id,
    })
    .select("id, project_code, name, priority, status")
    .single();

  assert(!errInsertProj1 && project1?.project_code === code1, "SMS successfully created project");

  if (!project1) {
    throw new Error("Project 1 creation prerequisite failed.");
  }

  // SMS owner inserted into project_members
  const { error: errMemberAdd } = await smsAuth.client
    .from("project_members")
    .insert({
      project_id: project1.id,
      user_id: smsAuth.user.id,
    });

  assert(!errMemberAdd, "SMS owner added to project_members");

  // Log activity via secure RPC (using allowed event type)
  const { data: logId, error: errLog } = await smsAuth.client.rpc(
    "log_project_activity",
    {
      p_project_id: project1.id,
      p_event_type: "PROJECT_UPDATED",
      p_metadata: { project_code: project1.project_code, name: project1.name },
    }
  );

  assert(!errLog && Boolean(logId), "Activity log recorded via log_project_activity RPC");

  // Generate second project code for same brand to verify incrementing sequence
  const { data: code2, error: errRpc2 } = await smsAuth.client.rpc(
    "generate_project_code",
    { p_brand_id: brandA.id }
  );

  assert(!errRpc2 && code2 !== code1, `Second project code incremented: ${code2}`);

  // Create second project
  const { data: project2, error: errInsertProj2 } = await smsAuth.client
    .from("projects")
    .insert({
      project_code: code2,
      brand_id: brandA.id,
      name: "Project Alpha Part 2",
      status: "BRIEF_RECEIVED",
      priority: "MEDIUM",
      start_date: new Date().toISOString().split("T")[0],
      deadline: deadlineStr,
      sms_owner_id: smsAuth.user.id,
      created_by: smsAuth.user.id,
    })
    .select("id, project_code")
    .single();

  assert(!errInsertProj2 && Boolean(project2), "Second project created successfully");

  if (!project1 || !project2) {
    throw new Error("Project creation prerequisite failed.");
  }

  // Designer cannot create project (RLS rejection)
  const { error: errDesignerProject } = await designerAuth.client
    .from("projects")
    .insert({
      project_code: "ILLEGAL-001",
      brand_id: brandA.id,
      name: "Illegal Project",
      sms_owner_id: smsAuth.user.id,
      created_by: designerAuth.user.id,
      deadline: deadlineStr,
    });

  assert(Boolean(errDesignerProject), "DESIGNER is rejected from creating projects by RLS");

  // -------------------------------------------------------------
  // Test 5: T-003 Brand Archive Guard Trigger
  // -------------------------------------------------------------
  console.log("\n5. T-003 Brand Archive Guard Trigger...");

  // Brand A has active projects (project1, project2). Attempting to soft-delete Brand A must fail!
  const { error: errArchiveBrandWithProjects } = await adminAuth.client
    .from("brands")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", brandA.id);

  assert(
    Boolean(errArchiveBrandWithProjects),
    "T-003: Postgres trigger successfully blocks archiving brand with associated projects"
  );

  // Create Brand B without projects
  const brandCodeB = `B2${Math.floor(1000 + Math.random() * 9000)}`;
  const { data: brandB, error: errCreateBrandB } = await adminAuth.client
    .from("brands")
    .insert({
      client_id: clientAdmin.id,
      name: "Brand Without Projects",
      code: brandCodeB,
      created_by: adminAuth.user.id,
    })
    .select("id")
    .single();

  assert(!errCreateBrandB && Boolean(brandB), "Brand without projects created");

  if (!brandB) {
    throw new Error("Brand B creation prerequisite failed.");
  }

  // Admin archives Brand B (no projects) -> should succeed
  const { error: errArchiveBrandWithoutProjects } = await adminAuth.client
    .from("brands")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", brandB.id);

  assert(!errArchiveBrandWithoutProjects, "Brand without projects can be archived by ADMIN");

  // -------------------------------------------------------------
  // Test 6: Role-Scoped Visibility & Project Membership
  // -------------------------------------------------------------
  console.log("\n6. Role-Scoped Visibility & Membership...");

  // CD has global visibility
  const { data: cdProjects } = await cdAuth.client
    .from("projects")
    .select("id")
    .is("deleted_at", null);

  assert((cdProjects?.length || 0) >= 2, "CREATIVE_DIRECTOR has global project visibility");

  // Designer is NOT a member yet, so Designer should NOT see project1
  const { data: designerBeforeProjects } = await designerAuth.client
    .from("projects")
    .select("id")
    .eq("id", project1.id);

  assert(
    (designerBeforeProjects?.length || 0) === 0,
    "DESIGNER cannot see project prior to being added to project_members"
  );

  // SMS owner adds Designer to project1
  const { error: errAddDesignerMember } = await smsAuth.client
    .from("project_members")
    .insert({
      project_id: project1.id,
      user_id: designerAuth.user.id,
    });

  assert(!errAddDesignerMember, "SMS owner successfully added DESIGNER to project1 members");

  // Now Designer CAN see project1!
  const { data: designerAfterProjects } = await designerAuth.client
    .from("projects")
    .select("id")
    .eq("id", project1.id);

  assert(
    designerAfterProjects?.length === 1 && designerAfterProjects[0].id === project1.id,
    "DESIGNER now has scoped visibility to project1 through project_members"
  );

  // Designer still CANNOT see project2 (not a member)
  const { data: designerProject2 } = await designerAuth.client
    .from("projects")
    .select("id")
    .eq("id", project2.id);

  assert(
    (designerProject2?.length || 0) === 0,
    "DESIGNER remains isolated from project2 (not a member)"
  );

  // SMS owner removes Designer from project1
  const { error: errRemoveDesigner } = await smsAuth.client
    .from("project_members")
    .delete()
    .eq("project_id", project1.id)
    .eq("user_id", designerAuth.user.id);

  assert(!errRemoveDesigner, "SMS owner successfully removed DESIGNER from project1");

  // Designer no longer sees project1
  const { data: designerRevokedProjects } = await designerAuth.client
    .from("projects")
    .select("id")
    .eq("id", project1.id);

  assert(
    (designerRevokedProjects?.length || 0) === 0,
    "DESIGNER visibility revoked after removal from project_members"
  );

  // -------------------------------------------------------------
  // Test 7: Project Metadata Update and Archiving
  // -------------------------------------------------------------
  console.log("\n7. Project Metadata Update & Archiving...");

  // SMS owner updates project1 metadata
  const { error: errUpdateProj1 } = await smsAuth.client
    .from("projects")
    .update({
      description: "Deskripsi project telah diperbarui oleh SMS owner",
      priority: "URGENT",
    })
    .eq("id", project1.id);

  assert(!errUpdateProj1, "SMS owner can update project metadata");

  // Non-member Designer cannot update project1
  const { data: updatedRows } = await designerAuth.client
    .from("projects")
    .update({ name: "Hacked Project" })
    .eq("id", project1.id)
    .select("id");

  const { data: currentProject } = await adminAuth.client
    .from("projects")
    .select("name")
    .eq("id", project1.id)
    .single();

  assert(
    (updatedRows?.length || 0) === 0 && currentProject?.name !== "Hacked Project",
    "DESIGNER is blocked from updating project by RLS (0 rows affected, data unchanged)"
  );

  // SMS owner archives project2
  const { error: errArchiveProj2 } = await smsAuth.client
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", project2.id);

  assert(!errArchiveProj2, "SMS owner can soft-delete / archive project");

  // Verify project2 is filtered from active projects
  const { data: activeProjectsAfterArchive } = await smsAuth.client
    .from("projects")
    .select("id")
    .eq("id", project2.id)
    .is("deleted_at", null);

  assert(
    (activeProjectsAfterArchive?.length || 0) === 0,
    "Archived project is successfully excluded from active queries"
  );

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log("\n=== VERIFICATION SUMMARY ===");
  console.log(`Total tests run: ${totalPassed + totalFailed}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);

  if (totalFailed > 0) {
    console.error("\nVerification FAILED!");
    process.exit(1);
  } else {
    console.log("\nAll Phase 5 verification checks PASSED successfully!");
    process.exit(0);
  }
}

runVerification().catch((err) => {
  console.error("Unhandled error in verification suite:", err);
  process.exit(1);
});
