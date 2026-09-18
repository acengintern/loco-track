"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/supabase/auth";
import { contentPlanFormSchema, type ContentPlanFormData } from "./schemas";

export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function createContentPlanAction(
  projectId: string,
  rawInput: ContentPlanFormData
): Promise<ActionResponse<{ id: string }>> {
  try {
    const profile = await requireActiveProfile();
    const supabase = await createClient();

    // Verify project and permissions
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
        error: "Anda tidak memiliki izin untuk menambah content plan pada project ini.",
      };
    }

    // T-004 Content lock check
    if (
      ["PRODUCTION", "INTERNAL_QC", "CLIENT_REVIEW", "APPROVED", "PUBLISHED", "DONE"].includes(
        project.status
      )
    ) {
      return {
        success: false,
        error:
          "Dokumen perencanaan tidak dapat diedit setelah project masuk tahap produksi.",
      };
    }

    const validated = contentPlanFormSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || "Data content plan tidak valid.",
      };
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("content_plans")
      .insert({
        project_id: projectId,
        title: validated.data.title,
        channel: validated.data.channel,
        planned_post_date: validated.data.planned_post_date,
        pillar: validated.data.pillar?.trim() || null,
        copy_draft: validated.data.copy_draft?.trim() || null,
        status: validated.data.status,
        created_by: profile.id,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      console.error("Error creating content plan:", insertErr);
      return {
        success: false,
        error: "Gagal menyimpan content plan baru.",
      };
    }

    // Log activity
    await supabase.rpc("log_project_activity", {
      p_project_id: projectId,
      p_event_type: "CONTENT_PLAN_CREATED",
      p_metadata: {
        content_plan_id: inserted.id,
        title: validated.data.title,
        channel: validated.data.channel,
      },
    });

    revalidatePath(`/projects/${projectId}`);
    return {
      success: true,
      data: { id: inserted.id },
    };
  } catch (err) {
    console.error("Exception in createContentPlanAction:", err);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat memproses content plan.",
    };
  }
}

export async function updateContentPlanAction(
  contentPlanId: string,
  projectId: string,
  rawInput: ContentPlanFormData
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
        error: "Anda tidak memiliki izin untuk mengubah content plan pada project ini.",
      };
    }

    // T-004 Content lock check
    if (
      ["PRODUCTION", "INTERNAL_QC", "CLIENT_REVIEW", "APPROVED", "PUBLISHED", "DONE"].includes(
        project.status
      )
    ) {
      return {
        success: false,
        error:
          "Dokumen perencanaan tidak dapat diedit setelah project masuk tahap produksi.",
      };
    }

    const validated = contentPlanFormSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || "Data perubahan content plan tidak valid.",
      };
    }

    const { error: updateErr } = await supabase
      .from("content_plans")
      .update({
        title: validated.data.title,
        channel: validated.data.channel,
        planned_post_date: validated.data.planned_post_date,
        pillar: validated.data.pillar?.trim() || null,
        copy_draft: validated.data.copy_draft?.trim() || null,
        status: validated.data.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contentPlanId)
      .eq("project_id", projectId);

    if (updateErr) {
      console.error("Error updating content plan:", updateErr);
      return {
        success: false,
        error: "Gagal memperbarui content plan.",
      };
    }

    // Log activity
    await supabase.rpc("log_project_activity", {
      p_project_id: projectId,
      p_event_type: "CONTENT_PLAN_UPDATED",
      p_metadata: {
        content_plan_id: contentPlanId,
        title: validated.data.title,
        status: validated.data.status,
      },
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("Exception in updateContentPlanAction:", err);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat memproses pembaruan content plan.",
    };
  }
}

export async function exceptionalUpdateContentPlanAction(
  contentPlanId: string,
  projectId: string,
  rawInput: ContentPlanFormData,
  reason: string
): Promise<ActionResponse> {
  try {
    await requireActiveProfile();
    const supabase = await createClient();

    if (!reason || !reason.trim()) {
      return {
        success: false,
        error: "Alasan revisi luar biasa wajib dicantumkan.",
      };
    }

    const validated = contentPlanFormSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || "Data content plan tidak valid.",
      };
    }

    const { error: rpcErr } = await supabase.rpc("exceptional_content_update", {
      p_entity_type: "content_plan",
      p_entity_id: contentPlanId,
      p_patch: {
        title: validated.data.title,
        channel: validated.data.channel,
        planned_post_date: validated.data.planned_post_date,
        pillar: validated.data.pillar?.trim() || null,
        copy_draft: validated.data.copy_draft?.trim() || null,
        status: validated.data.status,
      },
      p_reason: reason.trim(),
    });

    if (rpcErr) {
      console.error("Error in exceptional content plan update:", rpcErr);
      return {
        success: false,
        error: rpcErr.message || "Gagal melakukan revisi content plan luar biasa.",
      };
    }

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("Exception in exceptionalUpdateContentPlanAction:", err);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat memproses revisi content plan.",
    };
  }
}
