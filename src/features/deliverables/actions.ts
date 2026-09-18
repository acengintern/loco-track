"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveProfile } from "@/lib/supabase/auth";
import {
  MAX_FILE_SIZE_BYTES,
  mapTaskTypeToFileCategory,
} from "./schemas";
import { getTaskDeliverables } from "./queries";
import type { DeliverableUploadAllocation, DeliverableFile } from "./types";
import type { TaskType } from "@/features/tasks/types";
import type { Database } from "@/types/database";

interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Uploads a deliverable file with transactional allocation, storage compensation,
 * and canonical project_files registration.
 */
export async function uploadDeliverableAction(
  formData: FormData
): Promise<ActionResponse<{ fileId: string; version: number; fileName: string }>> {
  let allocatedStoragePath: string | null = null;
  let supabaseClient: Awaited<ReturnType<typeof createClient>> | null = null;

  try {
    await requireActiveProfile();
    const taskId = formData.get("taskId") as string;
    const projectId = formData.get("projectId") as string;
    const file = formData.get("file") as File | null;
    const taskType = (formData.get("taskType") as TaskType) || "OTHER";

    if (!taskId || !projectId || !file) {
      return {
        success: false,
        error: "Data upload tidak lengkap (taskId, projectId, dan file wajib disertakan).",
      };
    }

    if (file.size <= 0) {
      return {
        success: false,
        error: "File yang dipilih kosong (0 byte).",
      };
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        success: false,
        error: "Ukuran file melebihi batas maksimum 500MB.",
      };
    }

    const supabase = await createClient();
    supabaseClient = supabase;

    const fileCategory = mapTaskTypeToFileCategory(taskType);
    const mimeType = file.type || "application/octet-stream";

    // Step 1: Concurrency-safe allocation via PostgreSQL RPC
    const { data: allocData, error: allocError } = await supabase.rpc(
      "allocate_deliverable_upload",
      {
        p_task_id: taskId,
        p_file_name: file.name,
        p_mime_type: mimeType,
        p_file_size_bytes: file.size,
        p_file_type: fileCategory,
      }
    );

    if (allocError) {
      return {
        success: false,
        error: allocError.message || "Gagal mengalokasikan versi deliverable.",
      };
    }

    const allocation = allocData as unknown as DeliverableUploadAllocation;
    allocatedStoragePath = allocation.storage_path;

    // Step 2: Upload file buffer to Supabase Storage
    const fileBytes = await file.arrayBuffer();
    const buffer = Buffer.from(fileBytes);

    const { error: storageError } = await supabase.storage
      .from("project-deliverables")
      .upload(allocation.storage_path, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (storageError) {
      return {
        success: false,
        error: `Gagal mengunggah file ke penyimpanan: ${storageError.message}`,
      };
    }

    // Step 3: Register file metadata in public.project_files
    const { data: fileId, error: commitError } = await supabase.rpc(
      "commit_deliverable_file",
      {
        p_file_id: allocation.file_id,
        p_task_id: taskId,
        p_asset_group_id: allocation.asset_group_id,
        p_version: allocation.version,
        p_storage_path: allocation.storage_path,
        p_file_name: file.name,
        p_file_type: fileCategory,
        p_mime_type: mimeType,
        p_file_size_bytes: file.size,
      }
    );

    if (commitError) {
      // Step 3b: Failure compensation - purge orphaned storage object immediately
      console.warn("DB commit failed after upload. Compensating by removing storage object:", allocatedStoragePath);
      await supabase.storage
        .from("project-deliverables")
        .remove([allocatedStoragePath]);

      return {
        success: false,
        error: `Gagal menyimpan metadata file: ${commitError.message}`,
      };
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/tasks");

    return {
      success: true,
      data: {
        fileId: fileId as string,
        version: allocation.version,
        fileName: file.name,
      },
    };
  } catch (err: unknown) {
    // If an unexpected error occurred after storage upload, attempt cleanup
    if (allocatedStoragePath && supabaseClient) {
      try {
        await supabaseClient.storage
          .from("project-deliverables")
          .remove([allocatedStoragePath]);
      } catch (cleanupErr) {
        console.error("Failed to clean up storage object during error recovery:", cleanupErr);
      }
    }

    console.error("uploadDeliverableAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan internal saat upload.",
    };
  }
}

/**
 * Generates a short-lived signed download/view URL (15 minutes expiry) with session validation.
 */
export async function getDeliverableSignedUrlAction(
  fileId: string,
  projectId: string
): Promise<ActionResponse<{ signedUrl: string; fileName: string }>> {
  try {
    const profile = await requireActiveProfile();
    const supabase = await createClient();

    // Fetch file details with task and project membership validation
    const { data: file, error: fileError } = await supabase
      .from("project_files")
      .select(`
        id,
        project_id,
        task_id,
        storage_bucket,
        storage_path,
        file_name,
        deleted_at,
        project:projects (
          id,
          sms_owner_id,
          deleted_at
        ),
        task:tasks (
          id,
          current_assignee_id,
          deleted_at
        )
      `)
      .eq("id", fileId)
      .is("deleted_at", null)
      .single();

    if (fileError || !file) {
      return {
        success: false,
        error: "File deliverable tidak ditemukan atau telah dihapus.",
      };
    }

    if (file.project_id !== projectId) {
      return {
        success: false,
        error: "File tidak sesuai dengan proyek yang diminta.",
      };
    }

    const project = Array.isArray(file.project) ? file.project[0] : file.project;
    const task = Array.isArray(file.task) ? file.task[0] : file.task;

    if (project?.deleted_at || task?.deleted_at) {
      return {
        success: false,
        error: "Proyek atau tugas telah diarsipkan.",
      };
    }

    const isGlobalReviewer =
      profile.role === "ADMIN" ||
      profile.role === "CREATIVE_DIRECTOR" ||
      profile.role === "ACCOUNT_EXECUTIVE";
    const isSmsOwner = project?.sms_owner_id === profile.id;
    const isTaskAssignee = task?.current_assignee_id === profile.id;

    if (!isGlobalReviewer && !isSmsOwner && !isTaskAssignee) {
      // Check project team membership
      const { data: membership } = await supabase
        .from("project_members")
        .select("id")
        .eq("project_id", projectId)
        .eq("user_id", profile.id)
        .maybeSingle();

      if (!membership) {
        return {
          success: false,
          error: "Anda tidak memiliki izin untuk mengunduh file ini.",
        };
      }
    }

    // Generate signed URL with 15 minutes (900 seconds) expiration
    const { data: signedData, error: signError } = await supabase.storage
      .from(file.storage_bucket)
      .createSignedUrl(file.storage_path, 900);

    if (signError || !signedData?.signedUrl) {
      return {
        success: false,
        error: signError?.message || "Gagal membuat URL akses file.",
      };
    }

    return {
      success: true,
      data: {
        signedUrl: signedData.signedUrl,
        fileName: file.file_name,
      },
    };
  } catch (err: unknown) {
    console.error("getDeliverableSignedUrlAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan internal.",
    };
  }
}

/**
 * Soft-deletes a deliverable file metadata via the soft_delete_project_file RPC.
 */
export async function softDeleteDeliverableAction(
  fileId: string,
  taskId: string,
  projectId: string
): Promise<ActionResponse> {
  try {
    const profile = await requireActiveProfile();
    const isCreative = profile.role === "GRAPHIC_DESIGNER" || profile.role === "VIDEO_EDITOR";
    const isAdmin = profile.role === "ADMIN";
    if (!isCreative && !isAdmin) {
      return {
        success: false,
        error: "Hanya PIC kreatif yang ditugaskan atau Administrator yang dapat menghapus file deliverable.",
      };
    }

    const supabase = await createClient();

    const { error } = await supabase.rpc("soft_delete_project_file", {
      p_file_id: fileId,
    });

    if (error) {
      return {
        success: false,
        error: error.message || "Gagal menghapus file deliverable.",
      };
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/tasks");
    return { success: true };
  } catch (err: unknown) {
    console.error("softDeleteDeliverableAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan internal.",
    };
  }
}

/**
 * Submits a task for internal QC review (IN_PROGRESS -> IN_REVIEW)
 * Precondition: task must have at least one active non-deleted deliverable file.
 */
export async function submitTaskForReviewAction(
  taskId: string,
  projectId: string
): Promise<ActionResponse> {
  try {
    const profile = await requireActiveProfile();
    const isCreative = profile.role === "GRAPHIC_DESIGNER" || profile.role === "VIDEO_EDITOR";
    if (!isCreative) {
      return {
        success: false,
        error: "Hanya PIC kreatif yang ditugaskan yang dapat mengajukan deliverable untuk review QC.",
      };
    }

    const supabase = await createClient();

    const { error } = await supabase.rpc("transition_task_status", {
      p_task_id: taskId,
      p_new_status: "IN_REVIEW",
    });

    if (error) {
      return {
        success: false,
        error: error.message || "Gagal mengajukan tugas untuk review.",
      };
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/tasks");
    return { success: true };
  } catch (err: unknown) {
    console.error("submitTaskForReviewAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan internal.",
    };
  }
}

/**
 * Server action to fetch deliverables for a task from client components.
 */
export async function getTaskDeliverablesAction(
  taskId: string
): Promise<ActionResponse<DeliverableFile[]>> {
  try {
    await requireActiveProfile();
    const deliverables = await getTaskDeliverables(taskId, false);
    return { success: true, data: deliverables };
  } catch (err: unknown) {
    console.error("getTaskDeliverablesAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat deliverable.",
    };
  }
}

/**
 * Allocates deliverable upload metadata and canonical storage path.
 * Runs on the server to lock the task row and allocate monotonic versioning.
 */
export async function allocateDeliverableUploadAction(params: {
  taskId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  taskType: TaskType;
}): Promise<ActionResponse<DeliverableUploadAllocation>> {
  try {
    const profile = await requireActiveProfile();
    const isCreative = profile.role === "GRAPHIC_DESIGNER" || profile.role === "VIDEO_EDITOR";
    const isAdmin = profile.role === "ADMIN";
    if (!isCreative && !isAdmin) {
      return {
        success: false,
        error: "Hanya PIC kreatif yang ditugaskan yang dapat mengunggah deliverable tugas ini.",
      };
    }

    const supabase = await createClient();

    if (params.fileSizeBytes <= 0) {
      return { success: false, error: "File yang dipilih kosong (0 byte)." };
    }
    if (params.fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      return { success: false, error: "Ukuran file melebihi batas maksimum 500MB." };
    }

    const fileCategory = mapTaskTypeToFileCategory(params.taskType);
    const { data: allocData, error: allocError } = await supabase.rpc(
      "allocate_deliverable_upload",
      {
        p_task_id: params.taskId,
        p_file_name: params.fileName,
        p_mime_type: params.mimeType,
        p_file_size_bytes: params.fileSizeBytes,
        p_file_type: fileCategory,
      }
    );

    if (allocError || !allocData) {
      return {
        success: false,
        error: allocError?.message || "Gagal mengalokasikan versi deliverable.",
      };
    }

    return {
      success: true,
      data: allocData as unknown as DeliverableUploadAllocation,
    };
  } catch (err: unknown) {
    console.error("allocateDeliverableUploadAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan internal.",
    };
  }
}

/**
 * Commits deliverable file metadata after browser has uploaded binary to storage.
 */
export async function commitDeliverableAction(params: {
  fileId: string;
  taskId: string;
  assetGroupId: string;
  version: number;
  storagePath: string;
  fileName: string;
  fileType: string;
  mimeType: string;
  fileSizeBytes: number;
  projectId: string;
}): Promise<ActionResponse<{ fileId: string }>> {
  try {
    const profile = await requireActiveProfile();
    const isCreative = profile.role === "GRAPHIC_DESIGNER" || profile.role === "VIDEO_EDITOR";
    const isAdmin = profile.role === "ADMIN";
    if (!isCreative && !isAdmin) {
      return {
        success: false,
        error: "Hanya PIC kreatif yang ditugaskan yang dapat mencatat deliverable tugas ini.",
      };
    }

    const supabase = await createClient();

    const { data: commitId, error: commitError } = await supabase.rpc(
      "commit_deliverable_file",
      {
        p_file_id: params.fileId,
        p_task_id: params.taskId,
        p_asset_group_id: params.assetGroupId,
        p_version: params.version,
        p_storage_path: params.storagePath,
        p_file_name: params.fileName,
        p_file_type: params.fileType as Database["public"]["Enums"]["file_category"],
        p_mime_type: params.mimeType,
        p_file_size_bytes: params.fileSizeBytes,
      }
    );

    if (commitError) {
      return {
        success: false,
        error: commitError.message || "Gagal mencatat metadata file deliverable.",
      };
    }

    revalidatePath(`/projects/${params.projectId}`);
    revalidatePath("/tasks");

    return {
      success: true,
      data: { fileId: commitId || params.fileId },
    };
  } catch (err: unknown) {
    console.error("commitDeliverableAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan internal.",
    };
  }
}

/**
 * Compensates a failed upload or commit by removing the uncommitted storage object.
 */
export async function compensateDeliverableUploadAction(
  storagePath: string
): Promise<ActionResponse> {
  try {
    await requireActiveProfile();
    const supabase = await createClient();

    const { error: removeError } = await supabase.storage
      .from("project-deliverables")
      .remove([storagePath]);

    if (removeError) {
      console.warn("Compensation remove warning:", removeError);
    }
    return { success: true };
  } catch (err: unknown) {
    console.error("compensateDeliverableUploadAction error:", err);
    return { success: false };
  }
}


