"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/supabase/auth";
import { clientFormSchema, type ClientFormData } from "./schemas";

export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function createClientAction(
  rawInput: ClientFormData
): Promise<ActionResponse<{ id: string }>> {
  try {
    const profile = await requireActiveProfile();

    if (profile.role !== "ADMIN" && profile.role !== "SOCIAL_MEDIA_SPECIALIST") {
      return {
        success: false,
        error: "Anda tidak memiliki izin untuk membuat client baru.",
      };
    }

    const validated = clientFormSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || "Data client tidak valid.",
      };
    }

    const supabase = await createClient();

    // Check for duplicate name among active clients
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .ilike("name", validated.data.name)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        error: "Client dengan nama tersebut sudah tersedia.",
      };
    }

    const { data: created, error } = await supabase
      .from("clients")
      .insert({
        name: validated.data.name,
        description: validated.data.description?.trim() || null,
        contact_name: validated.data.contact_name?.trim() || null,
        contact_email: validated.data.contact_email?.trim() || null,
        contact_phone: validated.data.contact_phone?.trim() || null,
        is_active: validated.data.is_active,
        created_by: profile.id,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating client:", error);
      return {
        success: false,
        error: "Gagal membuat client. Silakan coba beberapa saat lagi.",
      };
    }

    revalidatePath("/clients");
    revalidatePath("/projects");
    return { success: true, data: { id: created.id } };
  } catch (err) {
    console.error("Exception in createClientAction:", err);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat memproses pembuatan client.",
    };
  }
}

export async function updateClientAction(
  id: string,
  rawInput: ClientFormData
): Promise<ActionResponse> {
  try {
    const profile = await requireActiveProfile();

    if (profile.role !== "ADMIN" && profile.role !== "SOCIAL_MEDIA_SPECIALIST") {
      return {
        success: false,
        error: "Anda tidak memiliki izin untuk memperbarui client.",
      };
    }

    const validated = clientFormSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || "Data client tidak valid.",
      };
    }

    const supabase = await createClient();

    // Check duplicate name on another active client
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .ilike("name", validated.data.name)
      .neq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        error: "Client dengan nama tersebut sudah digunakan oleh client lain.",
      };
    }

    const { error } = await supabase
      .from("clients")
      .update({
        name: validated.data.name,
        description: validated.data.description?.trim() || null,
        contact_name: validated.data.contact_name?.trim() || null,
        contact_email: validated.data.contact_email?.trim() || null,
        contact_phone: validated.data.contact_phone?.trim() || null,
        is_active: validated.data.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) {
      console.error("Error updating client:", error);
      return {
        success: false,
        error: "Gagal memperbarui data client.",
      };
    }

    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
    revalidatePath("/projects");
    return { success: true };
  } catch (err) {
    console.error("Exception in updateClientAction:", err);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat memperbarui data client.",
    };
  }
}

export async function archiveClientAction(id: string): Promise<ActionResponse> {
  try {
    const profile = await requireActiveProfile();

    // Section 9: ADMIN only may soft-delete clients
    if (profile.role !== "ADMIN") {
      return {
        success: false,
        error: "Hanya Administrator yang memiliki wewenang untuk mengarsipkan client.",
      };
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("clients")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) {
      console.error("Error archiving client:", error);
      return {
        success: false,
        error: "Gagal mengarsipkan client. Silakan coba lagi.",
      };
    }

    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
    revalidatePath("/projects");
    return { success: true };
  } catch (err) {
    console.error("Exception in archiveClientAction:", err);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat mengarsipkan client.",
    };
  }
}
