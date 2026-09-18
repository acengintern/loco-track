import { z } from "zod";
import { uuidSchema } from "@/lib/validators/uuid";
import type { FileCategory } from "./types";
import type { TaskType } from "@/features/tasks/types";

export const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500MB limit

export const ALLOWED_MIME_TYPES = [
  // Images / Design
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/vnd.adobe.photoshop",
  "application/pdf",
  // Video / Audio
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "audio/mpeg",
  "audio/wav",
  // Documents / Archives
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
];

export function mapTaskTypeToFileCategory(taskType?: TaskType | string): FileCategory {
  switch (taskType) {
    case "GRAPHIC_DESIGN":
      return "DESIGN";
    case "VIDEO_EDITING":
      return "VIDEO";
    case "CONTENT_PLAN":
    case "SCRIPT":
    case "PUBLISHING":
    case "OTHER":
    default:
      return "DOCUMENT";
  }
}

export const deliverableUploadInputSchema = z.object({
  taskId: uuidSchema("ID tugas tidak valid."),
  projectId: uuidSchema("ID project tidak valid."),
  fileName: z.string().min(1, "Nama file wajib diisi.").max(255, "Nama file terlalu panjang."),
  fileSize: z
    .number()
    .positive("Ukuran file harus lebih dari 0 byte.")
    .max(MAX_FILE_SIZE_BYTES, "Ukuran file melebihi batas maksimum 500MB."),
  mimeType: z.string().min(1, "MIME type wajib diisi."),
});

export type DeliverableUploadInput = z.infer<typeof deliverableUploadInputSchema>;
