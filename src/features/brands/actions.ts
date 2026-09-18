"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/supabase/auth";
import { brandFormSchema, type BrandFormData } from "./schemas";

export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function createBrandAction(
  rawInput: BrandFormData
): Promise<ActionResponse<{ id: string }>> {
  try {
    const profile = await requireActiveProfile();

    if (profile.role !== "ADMIN" && profile.role !== "SOCIAL_MEDIA_SPECIALIST") {
      return {
        success: false,
        error: "Anda tidak memiliki izin untuk membuat brand baru.",
      };
    }

    const validated = brandFormSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || "Data brand tidak valid.",
      };
    }

    const supabase = await createClient();

    // Check duplicate code
    const { data: existingCode } = await supabase
      .from("brands")
      .select("id")
      .eq("code", validated.data.code)
      .maybeSingle();

    if (existingCode) {
      return {
        success: false,
        error: "Kode brand sudah digunakan.",
      };
    }

    const { data: created, error } = await supabase
      .from("brands")
      .insert({
        client_id: validated.data.client_id,
        name: validated.data.name,
        code: validated.data.code.toUpperCase(),
        description: validated.data.description?.trim() || null,
        created_by: profile.id,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating brand:", error);
      return {
        success: false,
        error: "Gagal membuat brand. Silakan coba lagi.",
      };
    }

    revalidatePath("/brands");
    revalidatePath("/clients");
    revalidatePath("/projects");
    return { success: true, data: { id: created.id } };
  } catch (err) {
    console.error("Exception in createBrandAction:", err);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat memproses pembuatan brand.",
    };
  }
}

export async function updateBrandAction(
  id: string,
  rawInput: BrandFormData
): Promise<ActionResponse> {
  try {
    const profile = await requireActiveProfile();

    if (profile.role !== "ADMIN" && profile.role !== "SOCIAL_MEDIA_SPECIALIST") {
      return {
        success: false,
        error: "Anda tidak memiliki izin untuk memperbarui brand.",
      };
    }

    const validated = brandFormSchema.safeParse(rawInput);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.issues[0]?.message || "Data brand tidak valid.",
      };
    }

    const supabase = await createClient();

    // Check duplicate code on another brand
    const { data: existingCode } = await supabase
      .from("brands")
      .select("id")
      .eq("code", validated.data.code)
      .neq("id", id)
      .maybeSingle();

    if (existingCode) {
      return {
        success: false,
        error: "Kode brand sudah digunakan.",
      };
    }

    const { error } = await supabase
      .from("brands")
      .update({
        client_id: validated.data.client_id,
        name: validated.data.name,
        code: validated.data.code.toUpperCase(),
        description: validated.data.description?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) {
      console.error("Error updating brand:", error);
      return {
        success: false,
        error: "Gagal memperbarui data brand.",
      };
    }

    revalidatePath("/brands");
    revalidatePath(`/brands/${id}`);
    revalidatePath("/projects");
    return { success: true };
  } catch (err) {
    console.error("Exception in updateBrandAction:", err);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat memperbarui data brand.",
    };
  }
}

export async function archiveBrandAction(id: string): Promise<ActionResponse> {
  try {
    const profile = await requireActiveProfile();

    // Section 14 & 54: ADMIN only may soft-delete brands
    if (profile.role !== "ADMIN") {
      return {
        success: false,
        error: "Hanya Administrator yang memiliki wewenang untuk mengarsipkan brand.",
      };
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("brands")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) {
      // Catch T-003 trigger rejection
      if (
        error.message?.includes("active or historical projects exist") ||
        error.message?.includes("trg_check_brand_deletion")
      ) {
        return {
          success: false,
          error: "Brand tidak dapat diarsipkan karena masih memiliki riwayat project.",
        };
      }

      console.error("Error archiving brand:", error);
      return {
        success: false,
        error: "Gagal mengarsipkan brand. Silakan coba lagi.",
      };
    }

    revalidatePath("/brands");
    revalidatePath(`/brands/${id}`);
    revalidatePath("/projects");
    return { success: true };
  } catch (err) {
    console.error("Exception in archiveBrandAction:", err);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat mengarsipkan brand.",
    };
  }
}
