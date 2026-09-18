import { z } from "zod";
import { uuidSchema } from "@/lib/validators/uuid";

export const taskCreateSchema = z.object({
  title: z
    .string()
    .min(2, "Judul tugas minimal 2 karakter.")
    .max(150, "Judul tugas maksimal 150 karakter."),
  task_type: z.enum(
    ["GRAPHIC_DESIGN", "VIDEO_EDITING", "OTHER"],
    {
      message: "Pilih tipe tugas produksi yang valid.",
    }
  ),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  deadline: z.string().min(1, "Batas waktu pengerjaan tugas wajib diisi."),
  notes: z.string().nullable().optional(),
  content_plan_id: uuidSchema().nullable().optional(),
  script_id: uuidSchema().nullable().optional(),
  assignee_id: uuidSchema().nullable().optional(),
});

export type TaskCreateInput = z.infer<typeof taskCreateSchema>;

export const taskFormSchema = taskCreateSchema;
export type TaskFormInput = TaskCreateInput;

export const taskUpdateSchema = z.object({
  title: z
    .string()
    .min(2, "Judul tugas minimal 2 karakter.")
    .max(150, "Judul tugas maksimal 150 karakter."),
  task_type: z
    .enum(["GRAPHIC_DESIGN", "VIDEO_EDITING", "OTHER"])
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  deadline: z.string().min(1, "Batas waktu pengerjaan tugas wajib diisi."),
  notes: z.string().optional().default(""),
  content_plan_id: uuidSchema().nullable().optional(),
  script_id: uuidSchema().nullable().optional(),
});

export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;

export const taskReassignSchema = z.object({
  assignee_id: uuidSchema("Pilih anggota tim PIC yang valid."),
});

export type TaskReassignInput = z.infer<typeof taskReassignSchema>;
