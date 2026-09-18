"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { QcVerdict } from "./types";
import { getTaskQcHistory, getTaskRevisionRequests } from "./queries";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Submit an internal QC verdict for an IN_REVIEW task.
 * Restricted to CREATIVE_DIRECTOR role.
 */
export async function submitQcVerdictAction(
  taskId: string,
  projectId: string,
  verdict: QcVerdict,
  notes: string = ""
): Promise<ActionResult<{ verdict: QcVerdict; round_number: number }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Sesi autentikasi telah berakhir. Silakan login kembali." };
    }

    if (verdict === "REVISION_REQUESTED" && (!notes || !notes.trim())) {
      return { success: false, error: "Catatan revisi wajib diisi secara jelas dan dapat ditindaklanjuti." };
    }

    const { data, error } = await supabase.rpc("submit_qc_verdict", {
      p_task_id: taskId,
      p_verdict: verdict,
      p_notes: notes.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/approvals");
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/tasks");

    return {
      success: true,
      data: data as { verdict: QcVerdict; round_number: number },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menyimpan keputusan QC.",
    };
  }
}

/**
 * Transition task from REVISION_REQUESTED to IN_PROGRESS.
 * Executed by assigned creative to resume work.
 */
export async function resumeRevisionWorkAction(
  taskId: string,
  projectId: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Sesi autentikasi telah berakhir. Silakan login kembali." };
    }

    const { error } = await supabase.rpc("transition_task_status", {
      p_task_id: taskId,
      p_new_status: "IN_PROGRESS",
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/tasks");
    revalidatePath(`/projects/${projectId}`);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal melanjutkan pengerjaan tugas.",
    };
  }
}

/**
 * Fetch task QC and revision history for client inspection components.
 */
export async function getTaskQcHistoryAction(taskId: string) {
  try {
    const [qcReviews, revisionRequests] = await Promise.all([
      getTaskQcHistory(taskId),
      getTaskRevisionRequests(taskId),
    ]);

    return {
      success: true,
      data: {
        qcReviews,
        revisionRequests,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat riwayat QC.",
      data: { qcReviews: [], revisionRequests: [] },
    };
  }
}
