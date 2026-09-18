"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { QcVerdict } from "./types";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Start client review session (Round 1) for a project in INTERNAL_QC phase.
 * Transitions project to CLIENT_REVIEW.
 * Restricted to owning SMS or Admin.
 */
export async function startClientReviewAction(
  projectId: string
): Promise<ActionResult<{ client_review_id: string; round_number: number }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Sesi autentikasi telah berakhir. Silakan login kembali." };
    }

    const { data, error } = await supabase.rpc("start_client_review", {
      p_project_id: projectId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");

    return {
      success: true,
      data: data as { client_review_id: string; round_number: number },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memulai review client.",
    };
  }
}

/**
 * Record client verdict for a specific task/artifact in the active review round.
 * Restricted to owning SMS or Admin.
 */
export async function recordClientItemVerdictAction(
  reviewId: string,
  taskId: string,
  verdict: QcVerdict,
  feedback: string = "",
  projectId?: string
): Promise<ActionResult<{ task_id: string; verdict: QcVerdict }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Sesi autentikasi telah berakhir. Silakan login kembali." };
    }

    if (verdict === "REVISION_REQUESTED" && (!feedback || !feedback.trim())) {
      return { success: false, error: "Catatan feedback client wajib diisi saat meminta revisi." };
    }

    const { data, error } = await supabase.rpc("record_client_item_verdict", {
      p_review_id: reviewId,
      p_task_id: taskId,
      p_verdict: verdict,
      p_feedback: feedback.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (projectId) {
      revalidatePath(`/projects/${projectId}`);
    }
    revalidatePath("/tasks");
    revalidatePath("/approvals");

    return {
      success: true,
      data: data as { task_id: string; verdict: QcVerdict },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mencatat keputusan review client.",
    };
  }
}

/**
 * Start a subsequent client review round (Round N+1) after all revised tasks have been approved by CD.
 * Restricted to owning SMS or Admin.
 */
export async function startClientRePresentationAction(
  projectId: string
): Promise<ActionResult<{ client_review_id: string; round_number: number }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Sesi autentikasi telah berakhir. Silakan login kembali." };
    }

    const { data, error } = await supabase.rpc("start_client_re_presentation", {
      p_project_id: projectId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");

    return {
      success: true,
      data: data as { client_review_id: string; round_number: number },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mengajukan kembali ke client.",
    };
  }
}

/**
 * Finalize client approval for the project when all presented deliverables have received client approval.
 * Transitions project CLIENT_REVIEW -> APPROVED.
 * Restricted to owning SMS or Admin.
 */
export async function finalizeClientApprovalAction(
  projectId: string
): Promise<ActionResult<{ status: string; project_id: string }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Sesi autentikasi telah berakhir. Silakan login kembali." };
    }

    const { data, error } = await supabase.rpc("finalize_client_approval", {
      p_project_id: projectId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");

    return {
      success: true,
      data: data as { status: string; project_id: string },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menyelesaikan persetujuan client.",
    };
  }
}

/**
 * Publish the project with a validated live URL.
 * Transitions project APPROVED -> PUBLISHED.
 * Restricted to owning SMS or Admin.
 */
export async function publishProjectAction(
  projectId: string,
  publicationUrl: string,
  publishNote?: string
): Promise<ActionResult<{ status: string; publication_url: string }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Sesi autentikasi telah berakhir. Silakan login kembali." };
    }

    const cleanUrl = publicationUrl ? publicationUrl.trim() : "";
    if (!cleanUrl) {
      return { success: false, error: "Tautan publikasi (URL) wajib diisi." };
    }

    if (!/^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(cleanUrl)) {
      return {
        success: false,
        error: "Format tautan publikasi tidak valid. Harus diawali http:// atau https://.",
      };
    }

    const { data, error } = await supabase.rpc("publish_project", {
      p_project_id: projectId,
      p_publication_url: cleanUrl,
      p_publish_note: publishNote ? publishNote.trim() : null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/projects");

    return {
      success: true,
      data: data as { status: string; publication_url: string },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mempublikasikan project.",
    };
  }
}
