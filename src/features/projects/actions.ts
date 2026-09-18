"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/supabase/auth";
import {
  createProjectSchema,
  updateProjectSchema,
  addProjectMemberSchema,
  type CreateProjectFormData,
  type UpdateProjectFormData,
  type AddProjectMemberData,
} from "./schemas";

export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function createProjectAction(
  rawInput: CreateProjectFormData
): Promise<ActionResponse<{ id: string; project_code: string }>> {
  try {
    const profile = await requireActiveProfile();

    if (profile.role !== "ADMIN" && profile.role !== "SOCIAL_MEDIA_SPECIALIST") {
      return {
        success: false,
        error: "Anda tidak memiliki izin untuk membuat project baru.",
      };
    }

    const validated = createProjectSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || "Data project tidak valid.",
      };
    }

    const supabase = await createClient();

    // Determine target SMS owner
    let targetSmsOwnerId: string | null = null;
    if (profile.role === "ADMIN") {
      targetSmsOwnerId = validated.data.sms_owner_id || profile.id;
    } else {
      targetSmsOwnerId = profile.id;
    }

    const deadlineIso = new Date(`${validated.data.deadline}T23:59:59.000Z`).toISOString();

    // Call atomic PostgreSQL RPC (Section 5 & 6)
    const { data: result, error: rpcError } = await supabase.rpc("create_project", {
      p_brand_id: validated.data.brand_id,
      p_name: validated.data.name,
      p_description: validated.data.description?.trim() || null,
      p_priority: validated.data.priority,
      p_start_date: validated.data.start_date,
      p_deadline: deadlineIso,
      p_sms_owner_id: targetSmsOwnerId,
    });

    if (rpcError || !result) {
      console.error("Error creating project via atomic RPC:", rpcError);
      return {
        success: false,
        error: rpcError?.message || "Gagal membuat project baru.",
      };
    }

    const projectData = result as unknown as { id: string; project_code: string };

    revalidatePath("/projects");
    revalidatePath("/dashboard");
    revalidatePath("/activity");
    return {
      success: true,
      data: { id: projectData.id, project_code: projectData.project_code },
    };
  } catch (err) {
    console.error("Exception in createProjectAction:", err);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat memproses pembuatan project.",
    };
  }
}

export async function updateProjectAction(
  id: string,
  rawInput: UpdateProjectFormData
): Promise<ActionResponse> {
  try {
    const profile = await requireActiveProfile();
    const supabase = await createClient();

    // Verify existing project & permission
    const { data: existing, error: fetchError } = await supabase
      .from("projects")
      .select("id, status, brand_id, sms_owner_id, project_code")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existing) {
      return {
        success: false,
        error: "Project tidak ditemukan atau telah diarsipkan.",
      };
    }

    const isAdmin = profile.role === "ADMIN";
    const isOwner = profile.role === "SOCIAL_MEDIA_SPECIALIST" && existing.sms_owner_id === profile.id;

    if (!isAdmin && !isOwner) {
      return {
        success: false,
        error: "Anda tidak memiliki izin untuk mengubah project ini.",
      };
    }

    const validated = updateProjectSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || "Data perubahan tidak valid.",
      };
    }

    // Brand change check: only allowed if still BRIEF_RECEIVED
    let newBrandId = existing.brand_id;
    if (validated.data.brand_id && validated.data.brand_id !== existing.brand_id) {
      if (existing.status !== "BRIEF_RECEIVED") {
        return {
          success: false,
          error: "Brand project tidak dapat diubah setelah project bergerak dari tahap Brief Received.",
        };
      }
      newBrandId = validated.data.brand_id;
    }

    // SMS Owner change: only Admin can change
    let newSmsOwnerId = existing.sms_owner_id;
    if (isAdmin && validated.data.sms_owner_id && validated.data.sms_owner_id !== existing.sms_owner_id) {
      newSmsOwnerId = validated.data.sms_owner_id;

      // Ensure new owner is added to members
      await supabase
        .from("project_members")
        .upsert(
          { project_id: id, user_id: newSmsOwnerId },
          { onConflict: "project_id,user_id" }
        );
    }

    const deadlineIso = new Date(`${validated.data.deadline}T23:59:59.000Z`).toISOString();

    const { error: updateError } = await supabase
      .from("projects")
      .update({
        name: validated.data.name,
        description: validated.data.description?.trim() || null,
        priority: validated.data.priority,
        start_date: validated.data.start_date,
        deadline: deadlineIso,
        brand_id: newBrandId,
        sms_owner_id: newSmsOwnerId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .is("deleted_at", null);

    if (updateError) {
      console.error("Error updating project:", updateError);
      return {
        success: false,
        error: "Gagal memperbarui data project.",
      };
    }

    // Log activity
    await supabase.rpc("log_project_activity", {
      p_project_id: id,
      p_event_type: "PROJECT_UPDATED",
      p_metadata: {
        name: validated.data.name,
        priority: validated.data.priority,
        updated_by: profile.id,
      },
    });

    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    return { success: true };
  } catch (err) {
    console.error("Exception in updateProjectAction:", err);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat memperbarui project.",
    };
  }
}

export async function archiveProjectAction(id: string): Promise<ActionResponse> {
  try {
    const profile = await requireActiveProfile();
    const supabase = await createClient();

    const { data: existing, error: fetchError } = await supabase
      .from("projects")
      .select("id, sms_owner_id, project_code")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existing) {
      return {
        success: false,
        error: "Project tidak ditemukan atau telah diarsipkan.",
      };
    }

    const isAdmin = profile.role === "ADMIN";
    const isOwner = profile.role === "SOCIAL_MEDIA_SPECIALIST" && existing.sms_owner_id === profile.id;

    if (!isAdmin && !isOwner) {
      return {
        success: false,
        error: "Hanya Administrator atau penanggung jawab project yang dapat mengarsipkan project.",
      };
    }

    const { error: archiveError } = await supabase
      .from("projects")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .is("deleted_at", null);

    if (archiveError) {
      console.error("Error archiving project:", archiveError);
      return {
        success: false,
        error: "Gagal mengarsipkan project.",
      };
    }

    await supabase.rpc("log_project_activity", {
      p_project_id: id,
      p_event_type: "PROJECT_ARCHIVED",
      p_metadata: {
        project_code: existing.project_code,
        archived_by: profile.id,
      },
    });

    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    return { success: true };
  } catch (err) {
    console.error("Exception in archiveProjectAction:", err);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat mengarsipkan project.",
    };
  }
}

export async function addProjectMemberAction(
  rawInput: AddProjectMemberData
): Promise<ActionResponse> {
  try {
    const profile = await requireActiveProfile();
    const validated = addProjectMemberSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: "Data penugasan anggota tim tidak valid.",
      };
    }

    const supabase = await createClient();

    // Verify project & authority
    const { data: project, error: projError } = await supabase
      .from("projects")
      .select("id, sms_owner_id")
      .eq("id", validated.data.project_id)
      .is("deleted_at", null)
      .single();

    if (projError || !project) {
      return { success: false, error: "Project tidak ditemukan." };
    }

    const isAdmin = profile.role === "ADMIN";
    const isOwner = profile.role === "SOCIAL_MEDIA_SPECIALIST" && project.sms_owner_id === profile.id;

    if (!isAdmin && !isOwner) {
      return {
        success: false,
        error: "Hanya Administrator atau penanggung jawab project yang dapat menambah anggota tim.",
      };
    }

    // Verify target user is active
    const { data: targetUser, error: userError } = await supabase
      .from("profiles")
      .select("id, full_name, role, is_active")
      .eq("id", validated.data.user_id)
      .single();

    if (userError || !targetUser || !targetUser.is_active) {
      return { success: false, error: "Pengguna tidak aktif atau tidak ditemukan." };
    }

    const { error: insertError } = await supabase
      .from("project_members")
      .insert({
        project_id: validated.data.project_id,
        user_id: validated.data.user_id,
      });

    if (insertError) {
      if (insertError.code === "23505") {
        return { success: false, error: "Pengguna sudah terdaftar dalam tim project ini." };
      }
      console.error("Error adding project member:", insertError);
      return { success: false, error: "Gagal menambahkan anggota ke dalam tim project." };
    }

    // Log activity
    await supabase.rpc("log_project_activity", {
      p_project_id: validated.data.project_id,
      p_event_type: "MEMBER_ADDED",
      p_metadata: {
        user_id: targetUser.id,
        full_name: targetUser.full_name,
        role: targetUser.role,
      },
    });

    revalidatePath(`/projects/${validated.data.project_id}`);
    return { success: true };
  } catch (err) {
    console.error("Exception in addProjectMemberAction:", err);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat menambahkan anggota tim.",
    };
  }
}

export async function removeProjectMemberAction(
  projectId: string,
  userId: string
): Promise<ActionResponse> {
  try {
    const profile = await requireActiveProfile();
    const supabase = await createClient();

    // Verify project & authority
    const { data: project, error: projError } = await supabase
      .from("projects")
      .select("id, sms_owner_id")
      .eq("id", projectId)
      .is("deleted_at", null)
      .single();

    if (projError || !project) {
      return { success: false, error: "Project tidak ditemukan." };
    }

    const isAdmin = profile.role === "ADMIN";
    const isOwner = profile.role === "SOCIAL_MEDIA_SPECIALIST" && project.sms_owner_id === profile.id;

    if (!isAdmin && !isOwner) {
      return {
        success: false,
        error: "Hanya Administrator atau penanggung jawab project yang dapat menghapus anggota tim.",
      };
    }

    // Guard: SMS owner cannot remove themselves
    if (userId === project.sms_owner_id) {
      return {
        success: false,
        error: "Penanggung jawab project (SMS) tidak dapat dihapus dari roster tim.",
      };
    }

    const { error: deleteError } = await supabase
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", userId);

    if (deleteError) {
      if (deleteError.message?.includes("assigned to active tasks")) {
        return {
          success: false,
          error:
            "Anggota tim tidak dapat dihapus karena masih memiliki penugasan tugas (task) aktif pada project ini. Alihkan penugasan tugas terlebih dahulu.",
        };
      }
      console.error("Error removing project member:", deleteError);
      return { success: false, error: "Gagal menghapus anggota dari tim project." };
    }

    // Log activity
    await supabase.rpc("log_project_activity", {
      p_project_id: projectId,
      p_event_type: "MEMBER_REMOVED",
      p_metadata: {
        user_id: userId,
        removed_by: profile.id,
      },
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("Exception in removeProjectMemberAction:", err);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat menghapus anggota tim.",
    };
  }
}

export async function transitionProjectPhaseAction(
  projectId: string,
  targetPhase: "CONTENT_PLANNING" | "SCRIPT_READY" | "PRODUCTION"
): Promise<ActionResponse<{ success: boolean }>> {
  try {
    const profile = await requireActiveProfile();
    const supabase = await createClient();

    if (targetPhase === "PRODUCTION") {
      return {
        success: false,
        error: "Transisi ke tahap Produksi dikelola pada Phase 7 melalui modul Tasks.",
      };
    }

    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("id, status, sms_owner_id")
      .eq("id", projectId)
      .is("deleted_at", null)
      .single();

    if (projErr || !project) {
      return {
        success: false,
        error: "Project tidak ditemukan atau telah diarsipkan.",
      };
    }

    const canTransition =
      profile.role === "ADMIN" ||
      (profile.role === "SOCIAL_MEDIA_SPECIALIST" &&
        project.sms_owner_id === profile.id);

    if (!canTransition) {
      return {
        success: false,
        error: "Hanya Administrator atau penanggung jawab SMS yang dapat memajukan fase perencanaan project.",
      };
    }

    const { error: rpcErr } = await supabase.rpc("transition_project_phase", {
      p_project_id: projectId,
      p_target_phase: targetPhase,
    });

    if (rpcErr) {
      console.error("Error executing transition_project_phase RPC:", rpcErr);
      return {
        success: false,
        error: rpcErr.message || "Gagal memajukan fase project.",
      };
    }

    revalidatePath(`/projects/${projectId}`);
    return {
      success: true,
      data: { success: true },
    };
  } catch (err) {
    console.error("Exception in transitionProjectPhaseAction:", err);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat memproses transisi fase project.",
    };
  }
}

export async function toggleScriptNotRequiredAction(
  projectId: string,
  notRequired: boolean
): Promise<ActionResponse> {
  try {
    const profile = await requireActiveProfile();
    const supabase = await createClient();

    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("id, status, sms_owner_id")
      .eq("id", projectId)
      .is("deleted_at", null)
      .single();

    if (projErr || !project) {
      return {
        success: false,
        error: "Project tidak ditemukan atau telah diarsipkan.",
      };
    }

    const canManage =
      profile.role === "ADMIN" ||
      (profile.role === "SOCIAL_MEDIA_SPECIALIST" &&
        project.sms_owner_id === profile.id);

    if (!canManage) {
      return {
        success: false,
        error: "Hanya Administrator atau penanggung jawab SMS yang dapat mengubah ketentuan naskah project.",
      };
    }

    const { error: rpcErr } = await supabase.rpc("set_project_script_not_required", {
      p_project_id: projectId,
      p_not_required: notRequired,
    });

    if (rpcErr) {
      console.error("Error executing set_project_script_not_required RPC:", rpcErr);
      return {
        success: false,
        error: rpcErr.message || "Gagal memperbarui ketentuan naskah project.",
      };
    }

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("Exception in toggleScriptNotRequiredAction:", err);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat memperbarui ketentuan naskah project.",
    };
  }
}

