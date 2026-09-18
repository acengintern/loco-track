"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/supabase/auth";
import { briefFormSchema, type BriefFormData } from "./schemas";

export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function saveBriefAction(
  projectId: string,
  rawInput: BriefFormData
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
        error: "Anda tidak memiliki izin untuk mengelola brief project ini.",
      };
    }

    // T-004 Content lock check for ordinary edits
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

    const validated = briefFormSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || "Data brief tidak valid.",
      };
    }

    // Check if brief exists
    const { data: existingBrief } = await supabase
      .from("briefs")
      .select("id")
      .eq("project_id", projectId)
      .maybeSingle();

    let briefId = existingBrief?.id;

    if (existingBrief) {
      // Update
      const { error: updateErr } = await supabase
        .from("briefs")
        .update({
          objective: validated.data.objective,
          target_audience: validated.data.target_audience,
          key_message: validated.data.key_message,
          deliverables_summary: validated.data.deliverables_summary,
          reference_links: validated.data.reference_links?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingBrief.id);

      if (updateErr) {
        console.error("Error updating brief:", updateErr);
        return {
          success: false,
          error: "Gagal memperbarui brief.",
        };
      }

      // Log activity
      await supabase.rpc("log_project_activity", {
        p_project_id: projectId,
        p_event_type: "BRIEF_UPDATED",
        p_metadata: { brief_id: briefId },
      });
    } else {
      // Insert
      const { data: inserted, error: insertErr } = await supabase
        .from("briefs")
        .insert({
          project_id: projectId,
          objective: validated.data.objective,
          target_audience: validated.data.target_audience,
          key_message: validated.data.key_message,
          deliverables_summary: validated.data.deliverables_summary,
          reference_links: validated.data.reference_links?.trim() || null,
          created_by: profile.id,
        })
        .select("id")
        .single();

      if (insertErr || !inserted) {
        console.error("Error inserting brief:", insertErr);
        return {
          success: false,
          error: "Gagal menyimpan brief baru.",
        };
      }

      briefId = inserted.id;

      // Log activity
      await supabase.rpc("log_project_activity", {
        p_project_id: projectId,
        p_event_type: "BRIEF_CREATED",
        p_metadata: { brief_id: briefId },
      });
    }

    revalidatePath(`/projects/${projectId}`);
    return {
      success: true,
      data: { id: briefId! },
    };
  } catch (err) {
    console.error("Exception in saveBriefAction:", err);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat memproses brief.",
    };
  }
}

export async function exceptionalUpdateBriefAction(
  briefId: string,
  projectId: string,
  rawInput: BriefFormData,
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

    const validated = briefFormSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || "Data brief tidak valid.",
      };
    }

    const { error: rpcErr } = await supabase.rpc("exceptional_content_update", {
      p_entity_type: "brief",
      p_entity_id: briefId,
      p_patch: {
        objective: validated.data.objective,
        target_audience: validated.data.target_audience,
        key_message: validated.data.key_message,
        deliverables_summary: validated.data.deliverables_summary,
        reference_links: validated.data.reference_links?.trim() || null,
      },
      p_reason: reason.trim(),
    });

    if (rpcErr) {
      console.error("Error in exceptional brief update:", rpcErr);
      return {
        success: false,
        error: rpcErr.message || "Gagal melakukan revisi brief luar biasa.",
      };
    }

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("Exception in exceptionalUpdateBriefAction:", err);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat memproses revisi brief.",
    };
  }
}
