"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/supabase/auth";
import {
  taskCreateSchema,
  taskUpdateSchema,
  taskReassignSchema,
  type TaskCreateInput,
  type TaskUpdateInput,
} from "./schemas";
import type { TaskStatus, PriorityLevel } from "./types";

interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Creates a new production task with optional initial assignment atomically.
 */
export async function createProductionTaskAction(
  projectId: string,
  input: TaskCreateInput
): Promise<ActionResponse<{ taskId: string }>> {
  try {
    await requireActiveProfile();
    const parsed = taskCreateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Data input tugas tidak valid.",
      };
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc("create_production_task", {
      p_project_id: projectId,
      p_title: parsed.data.title,
      p_task_type: parsed.data.task_type,
      p_priority: parsed.data.priority,
      p_deadline: parsed.data.deadline,
      p_notes: parsed.data.notes || null,
      p_content_plan_id: parsed.data.content_plan_id || null,
      p_script_id: parsed.data.script_id || null,
      p_assignee_id: parsed.data.assignee_id || null,
    });

    if (error) {
      return {
        success: false,
        error: error.message || "Gagal membuat tugas produksi.",
      };
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/tasks");

    const res = data as { success: boolean; task_id: string };
    return {
      success: true,
      data: { taskId: res.task_id },
    };
  } catch (err: unknown) {
    console.error("createProductionTaskAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan internal.",
    };
  }
}

/**
 * Updates task safe metadata (title, notes, priority, deadline, planning links).
 */
export async function updateTaskMetadataAction(
  taskId: string,
  projectId: string,
  input: TaskUpdateInput
): Promise<ActionResponse> {
  try {
    await requireActiveProfile();
    const parsed = taskUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Data input update tidak valid.",
      };
    }

    const supabase = await createClient();

    const { error } = await supabase.rpc("update_task_metadata", {
      p_task_id: taskId,
      p_title: parsed.data.title,
      p_priority: parsed.data.priority,
      p_deadline: parsed.data.deadline,
      p_notes: parsed.data.notes || null,
      p_content_plan_id: parsed.data.content_plan_id || null,
      p_script_id: parsed.data.script_id || null,
      p_task_type: parsed.data.task_type || null,
    });

    if (error) {
      return {
        success: false,
        error: error.message || "Gagal memperbarui metadata tugas.",
      };
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/tasks");
    return { success: true };
  } catch (err: unknown) {
    console.error("updateTaskMetadataAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan internal.",
    };
  }
}

/**
 * Atomically reassigns a task to a new creative PIC and ensures project membership.
 */
export async function reassignTaskAction(
  taskId: string,
  projectId: string,
  newAssigneeId: string,
  expectedCurrentAssigneeId?: string | null
): Promise<ActionResponse> {
  try {
    await requireActiveProfile();
    const parsed = taskReassignSchema.safeParse({ assignee_id: newAssigneeId });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Pilihan PIC tidak valid.",
      };
    }

    const supabase = await createClient();

    // Concurrency verification: verify current assignment has not changed concurrently
    const { data: currentTask, error: fetchErr } = await supabase
      .from("tasks")
      .select("id, current_assignee_id, status")
      .eq("id", taskId)
      .is("deleted_at", null)
      .single();

    if (fetchErr || !currentTask) {
      return {
        success: false,
        error: "Tugas tidak ditemukan atau telah dihapus.",
      };
    }

    if (
      expectedCurrentAssigneeId !== undefined &&
      currentTask.current_assignee_id !== expectedCurrentAssigneeId
    ) {
      return {
        success: false,
        error: "PIC tugas telah berubah. Muat ulang data lalu coba lagi.",
      };
    }

    const { error } = await supabase.rpc("reassign_task", {
      p_task_id: taskId,
      p_new_assignee_id: newAssigneeId,
    });

    if (error) {
      return {
        success: false,
        error: error.message || "Gagal mengalihkan penugasan tugas.",
      };
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/tasks");
    return { success: true };
  } catch (err: unknown) {
    console.error("reassignTaskAction error:", err);
    return {
      success: false,
      error: "Gagal mengalihkan PIC. Coba lagi.",
    };
  }
}

/**
 * Transitions task status through the controlled transition_task_status RPC.
 */
export async function transitionTaskStatusAction(
  taskId: string,
  projectId: string,
  newStatus: TaskStatus
): Promise<ActionResponse> {
  try {
    const profile = await requireActiveProfile();
    const supabase = await createClient();

    // Fetch task state and parent project state
    const { data: task, error: fetchError } = await supabase
      .from("tasks")
      .select("id, current_assignee_id, status, deleted_at, project:projects(id, status)")
      .eq("id", taskId)
      .single();

    if (fetchError || !task || task.deleted_at) {
      return {
        success: false,
        error: "Tugas tidak ditemukan atau telah diarsipkan.",
      };
    }

    const projectData = Array.isArray(task.project) ? task.project[0] : task.project;
    if (projectData?.status === "PUBLISHED" || projectData?.status === "CANCELLED") {
      return {
        success: false,
        error: "Proyek sudah selesai atau dibatalkan. Tidak dapat mengubah status tugas.",
      };
    }

    // Starting work (IN_PROGRESS) is strictly restricted to the active assigned creative PIC
    if (newStatus === "IN_PROGRESS") {
      if (profile.role !== "GRAPHIC_DESIGNER" && profile.role !== "VIDEO_EDITOR") {
        return {
          success: false,
          error: "Hanya PIC kreatif (Desainer Grafis atau Video Editor) yang dapat memulai pengerjaan tugas.",
        };
      }

      if (!task.current_assignee_id || task.current_assignee_id !== profile.id) {
        return {
          success: false,
          error: "Anda bukan PIC yang ditugaskan untuk tugas ini.",
        };
      }

      if (task.status !== "TODO" && task.status !== "REVISION_REQUESTED") {
        return {
          success: false,
          error: "Tugas tidak dalam status yang dapat dimulai pengerjaannya.",
        };
      }
    }

    const { error } = await supabase.rpc("transition_task_status", {
      p_task_id: taskId,
      p_new_status: newStatus,
    });

    if (error) {
      let userMsg = "Gagal mengubah status tugas.";
      if (error.message.includes("Unauthorized") || error.message.includes("Hanya PIC")) {
        userMsg = "Anda tidak memiliki izin untuk memulai pengerjaan tugas ini.";
      } else if (error.message.includes("Invalid status transition")) {
        userMsg = "Perubahan status tugas tidak diizinkan oleh alur kerja.";
      } else if (error.message.includes("Task not found")) {
        userMsg = "Tugas tidak ditemukan.";
      }
      return {
        success: false,
        error: userMsg,
      };
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/tasks");
    return { success: true };
  } catch (err: unknown) {
    console.error("transitionTaskStatusAction error:", err);
    return {
      success: false,
      error: "Terjadi kendala sistem saat mengubah status tugas. Coba lagi.",
    };
  }
}

/**
 * Starts production phase via narrow transactional RPC start_production.
 */
export async function startProductionAction(
  projectId: string
): Promise<ActionResponse<{ productionTaskCount: number }>> {
  try {
    await requireActiveProfile();
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("start_production", {
      p_project_id: projectId,
    });

    if (error) {
      return {
        success: false,
        error: error.message || "Gagal memulai tahap produksi.",
      };
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/tasks");

    const res = data as { success: boolean; production_task_count: number };
    return {
      success: true,
      data: { productionTaskCount: res.production_task_count },
    };
  } catch (err: unknown) {
    console.error("startProductionAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan internal.",
    };
  }
}

/**
 * Soft deletes a task via archive_task RPC.
 */
export async function archiveTaskAction(
  taskId: string,
  projectId: string
): Promise<ActionResponse> {
  try {
    await requireActiveProfile();
    const supabase = await createClient();

    const { error } = await supabase.rpc("archive_task", {
      p_task_id: taskId,
    });

    if (error) {
      return {
        success: false,
        error: error.message || "Gagal mengarsipkan tugas.",
      };
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/tasks");
    return { success: true };
  } catch (err: unknown) {
    console.error("archiveTaskAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan internal.",
    };
  }
}

/**
 * Bulk reassigns multiple tasks to an active creative member atomically.
 */
export async function bulkAssignTasksAction(
  taskIds: string[],
  newAssigneeId: string,
  projectId?: string
): Promise<ActionResponse<{ succeededCount: number; failedCount: number; errors: string[] }>> {
  try {
    const profile = await requireActiveProfile();
    if (profile.role !== "ADMIN" && profile.role !== "SOCIAL_MEDIA_SPECIALIST") {
      return {
        success: false,
        error: "Hanya Administrator atau Social Media Specialist yang dapat menugaskan PIC secara massal.",
      };
    }

    if (!taskIds || taskIds.length === 0) {
      return { success: false, error: "Tidak ada tugas yang dipilih." };
    }

    const parsed = taskReassignSchema.safeParse({ assignee_id: newAssigneeId });
    if (!parsed.success) {
      return { success: false, error: "PIC pengganti tidak valid." };
    }

    const supabase = await createClient();
    let succeededCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const taskId of taskIds) {
      const { error } = await supabase.rpc("reassign_task", {
        p_task_id: taskId,
        p_new_assignee_id: newAssigneeId,
      });

      if (error) {
        failedCount++;
        errors.push(`Tugas ${taskId}: ${error.message}`);
      } else {
        succeededCount++;
      }
    }

    if (projectId) {
      revalidatePath(`/projects/${projectId}`);
    }
    revalidatePath("/tasks");

    return {
      success: true,
      data: { succeededCount, failedCount, errors },
    };
  } catch (err: unknown) {
    console.error("bulkAssignTasksAction error:", err);
    return {
      success: false,
      error: "Gagal memproses penugasan massal.",
    };
  }
}

/**
 * Bulk updates priority level for selected active tasks.
 */
export async function bulkUpdateTasksPriorityAction(
  taskIds: string[],
  priority: PriorityLevel,
  projectId?: string
): Promise<ActionResponse<{ updatedCount: number }>> {
  try {
    const profile = await requireActiveProfile();
    if (profile.role !== "ADMIN" && profile.role !== "SOCIAL_MEDIA_SPECIALIST") {
      return {
        success: false,
        error: "Hanya Administrator atau Social Media Specialist yang dapat mengubah prioritas tugas.",
      };
    }

    if (!taskIds || taskIds.length === 0) {
      return { success: false, error: "Tidak ada tugas yang dipilih." };
    }

    const supabase = await createClient();
    const { error, count } = await supabase
      .from("tasks")
      .update({ priority, updated_at: new Date().toISOString() })
      .in("id", taskIds)
      .is("deleted_at", null);

    if (error) {
      return {
        success: false,
        error: error.message || "Gagal memperbarui prioritas tugas terpilih.",
      };
    }

    if (projectId) {
      revalidatePath(`/projects/${projectId}`);
    }
    revalidatePath("/tasks");

    return {
      success: true,
      data: { updatedCount: count ?? taskIds.length },
    };
  } catch (err: unknown) {
    console.error("bulkUpdateTasksPriorityAction error:", err);
    return {
      success: false,
      error: "Gagal memperbarui prioritas tugas terpilih.",
    };
  }
}

/**
 * Bulk archives multiple tasks via atomic archive_task RPC.
 */
export async function bulkArchiveTasksAction(
  taskIds: string[],
  projectId?: string
): Promise<ActionResponse<{ succeededCount: number; failedCount: number }>> {
  try {
    const profile = await requireActiveProfile();
    if (profile.role !== "ADMIN" && profile.role !== "SOCIAL_MEDIA_SPECIALIST") {
      return {
        success: false,
        error: "Hanya Administrator atau Social Media Specialist yang dapat mengarsipkan tugas.",
      };
    }

    if (!taskIds || taskIds.length === 0) {
      return { success: false, error: "Tidak ada tugas yang dipilih." };
    }

    const supabase = await createClient();
    let succeededCount = 0;
    let failedCount = 0;

    for (const taskId of taskIds) {
      const { error } = await supabase.rpc("archive_task", {
        p_task_id: taskId,
      });
      if (error) {
        failedCount++;
      } else {
        succeededCount++;
      }
    }

    if (projectId) {
      revalidatePath(`/projects/${projectId}`);
    }
    revalidatePath("/tasks");

    return {
      success: true,
      data: { succeededCount, failedCount },
    };
  } catch (err: unknown) {
    console.error("bulkArchiveTasksAction error:", err);
    return {
      success: false,
      error: "Gagal mengarsipkan tugas terpilih.",
    };
  }
}

/**
 * Records a client review verdict for an individual task directly.
 * Enables rolling client reviews without waiting for all other tasks in the project.
 */
export async function recordTaskClientVerdictAction(params: {
  taskId: string;
  verdict: "APPROVED" | "REVISION_REQUESTED";
  feedback?: string;
  projectId?: string;
}): Promise<ActionResponse<{ task_id: string; verdict: string }>> {
  try {
    const profile = await requireActiveProfile();
    if (profile.role !== "ADMIN" && profile.role !== "SOCIAL_MEDIA_SPECIALIST") {
      return {
        success: false,
        error: "Hanya Administrator atau Social Media Specialist yang dapat mencatat review klien.",
      };
    }

    if (params.verdict === "REVISION_REQUESTED" && (!params.feedback || !params.feedback.trim())) {
      return {
        success: false,
        error: "Catatan feedback revisi klien wajib diisi saat meminta revisi.",
      };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("record_task_client_verdict", {
      p_task_id: params.taskId,
      p_verdict: params.verdict,
      p_feedback: params.feedback ? params.feedback.trim() : "",
    });

    if (error) {
      return {
        success: false,
        error: error.message || "Gagal mencatat keputusan review klien untuk tugas ini.",
      };
    }

    if (params.projectId) {
      revalidatePath(`/projects/${params.projectId}`);
    }
    revalidatePath("/tasks");
    revalidatePath("/approvals");

    return {
      success: true,
      data: data as { task_id: string; verdict: string },
    };
  } catch (err: unknown) {
    console.error("recordTaskClientVerdictAction error:", err);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat memproses review klien.",
    };
  }
}

/**
 * Publishes an individual task after client approval with a validated live URL.
 * Marks task COMPLETED and records publication details.
 */
export async function publishTaskAction(params: {
  taskId: string;
  publicationUrl: string;
  publishNote?: string;
  projectId?: string;
}): Promise<ActionResponse<{ task_id: string; status: string; publication_url: string }>> {
  try {
    const profile = await requireActiveProfile();
    if (profile.role !== "ADMIN" && profile.role !== "SOCIAL_MEDIA_SPECIALIST") {
      return {
        success: false,
        error: "Hanya Administrator atau Social Media Specialist yang dapat mempublikasikan tugas.",
      };
    }

    const cleanUrl = params.publicationUrl ? params.publicationUrl.trim() : "";
    if (!cleanUrl) {
      return {
        success: false,
        error: "Tautan publikasi (URL) wajib diisi.",
      };
    }

    if (!/^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(cleanUrl)) {
      return {
        success: false,
        error: "Format tautan publikasi tidak valid. Harus diawali http:// atau https://.",
      };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("publish_task", {
      p_task_id: params.taskId,
      p_publication_url: cleanUrl,
      p_publish_note: params.publishNote ? params.publishNote.trim() : null,
    });

    if (error) {
      return {
        success: false,
        error: error.message || "Gagal mempublikasikan tugas.",
      };
    }

    if (params.projectId) {
      revalidatePath(`/projects/${params.projectId}`);
    }
    revalidatePath("/tasks");
    revalidatePath("/dashboard");

    return {
      success: true,
      data: data as { task_id: string; status: string; publication_url: string },
    };
  } catch (err: unknown) {
    console.error("publishTaskAction error:", err);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat mempublikasikan tugas.",
    };
  }
}
