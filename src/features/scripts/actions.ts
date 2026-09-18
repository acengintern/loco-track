"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/supabase/auth";
import { scriptFormSchema, type ScriptFormData } from "./schemas";

export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function createScriptAction(
  projectId: string,
  rawInput: ScriptFormData
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
        error: "Anda tidak memiliki izin untuk menambah naskah pada project ini.",
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
          "Dokumen naskah tidak dapat diedit setelah project masuk tahap produksi.",
      };
    }

    const validated = scriptFormSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || "Data naskah tidak valid.",
      };
    }

    // Verify content plan belongs to this project if provided
    if (validated.data.content_plan_id) {
      const { data: plan, error: planErr } = await supabase
        .from("content_plans")
        .select("id, project_id")
        .eq("id", validated.data.content_plan_id)
        .single();

      if (planErr || !plan || plan.project_id !== projectId) {
        return {
          success: false,
          error: "Content plan yang dipilih tidak valid untuk project ini.",
        };
      }
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("scripts")
      .insert({
        project_id: projectId,
        content_plan_id: validated.data.content_plan_id || null,
        title: validated.data.title,
        hook: validated.data.hook,
        body: validated.data.body,
        visual_cues: validated.data.visual_cues,
        call_to_action: validated.data.call_to_action,
        status: validated.data.status,
        created_by: profile.id,
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      console.error("Error creating script:", insertErr);
      return {
        success: false,
        error: "Gagal menyimpan naskah baru.",
      };
    }

    // Log activity
    await supabase.rpc("log_project_activity", {
      p_project_id: projectId,
      p_event_type: "SCRIPT_CREATED",
      p_metadata: {
        script_id: inserted.id,
        title: validated.data.title,
      },
    });

    if (validated.data.status === "READY") {
      await supabase.rpc("log_project_activity", {
        p_project_id: projectId,
        p_event_type: "SCRIPT_READY",
        p_metadata: {
          script_id: inserted.id,
          title: validated.data.title,
        },
      });
    }

    revalidatePath(`/projects/${projectId}`);
    return {
      success: true,
      data: { id: inserted.id },
    };
  } catch (err) {
    console.error("Exception in createScriptAction:", err);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat memproses naskah.",
    };
  }
}

export async function updateScriptAction(
  scriptId: string,
  projectId: string,
  rawInput: ScriptFormData
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
        error: "Anda tidak memiliki izin untuk mengubah naskah pada project ini.",
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
          "Dokumen naskah tidak dapat diedit setelah project masuk tahap produksi.",
      };
    }

    const validated = scriptFormSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || "Data perubahan naskah tidak valid.",
      };
    }

    // Verify content plan belongs to this project if provided
    if (validated.data.content_plan_id) {
      const { data: plan, error: planErr } = await supabase
        .from("content_plans")
        .select("id, project_id")
        .eq("id", validated.data.content_plan_id)
        .single();

      if (planErr || !plan || plan.project_id !== projectId) {
        return {
          success: false,
          error: "Content plan yang dipilih tidak valid untuk project ini.",
        };
      }
    }

    // Check old status for SCRIPT_READY transition logging
    const { data: oldScript } = await supabase
      .from("scripts")
      .select("status")
      .eq("id", scriptId)
      .single();

    const { error: updateErr } = await supabase
      .from("scripts")
      .update({
        content_plan_id: validated.data.content_plan_id || null,
        title: validated.data.title,
        hook: validated.data.hook,
        body: validated.data.body,
        visual_cues: validated.data.visual_cues,
        call_to_action: validated.data.call_to_action,
        status: validated.data.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scriptId)
      .eq("project_id", projectId);

    if (updateErr) {
      console.error("Error updating script:", updateErr);
      return {
        success: false,
        error: "Gagal memperbarui naskah.",
      };
    }

    // Log activity
    await supabase.rpc("log_project_activity", {
      p_project_id: projectId,
      p_event_type: "SCRIPT_UPDATED",
      p_metadata: {
        script_id: scriptId,
        title: validated.data.title,
        status: validated.data.status,
      },
    });

    if (oldScript?.status !== "READY" && validated.data.status === "READY") {
      await supabase.rpc("log_project_activity", {
        p_project_id: projectId,
        p_event_type: "SCRIPT_READY",
        p_metadata: {
          script_id: scriptId,
          title: validated.data.title,
        },
      });
    }

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("Exception in updateScriptAction:", err);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat memproses pembaruan naskah.",
    };
  }
}

export async function exceptionalUpdateScriptAction(
  scriptId: string,
  projectId: string,
  rawInput: ScriptFormData,
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

    const validated = scriptFormSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || "Data naskah tidak valid.",
      };
    }

    // Verify content plan belongs to this project if provided
    if (validated.data.content_plan_id) {
      const { data: plan, error: planErr } = await supabase
        .from("content_plans")
        .select("id, project_id")
        .eq("id", validated.data.content_plan_id)
        .single();

      if (planErr || !plan || plan.project_id !== projectId) {
        return {
          success: false,
          error: "Content plan yang dipilih tidak valid untuk project ini.",
        };
      }
    }

    const { error: rpcErr } = await supabase.rpc("exceptional_content_update", {
      p_entity_type: "script",
      p_entity_id: scriptId,
      p_patch: {
        title: validated.data.title,
        hook: validated.data.hook,
        body: validated.data.body,
        visual_cues: validated.data.visual_cues,
        call_to_action: validated.data.call_to_action,
        status: validated.data.status,
        content_plan_id: validated.data.content_plan_id || null,
      },
      p_reason: reason.trim(),
    });

    if (rpcErr) {
      console.error("Error in exceptional script update:", rpcErr);
      return {
        success: false,
        error: rpcErr.message || "Gagal melakukan revisi naskah luar biasa.",
      };
    }

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("Exception in exceptionalUpdateScriptAction:", err);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat memproses revisi naskah.",
    };
  }
}
