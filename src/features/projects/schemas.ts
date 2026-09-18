import { z } from "zod";
import { uuidSchema } from "@/lib/validators/uuid";

export const PROJECT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const createProjectSchema = z
  .object({
    brand_id: uuidSchema("Pilih brand yang valid."),
    name: z
      .string()
      .trim()
      .min(3, "Nama project minimal 3 karakter.")
      .max(150, "Nama project maksimal 150 karakter."),
    description: z
      .string()
      .trim()
      .max(1000, "Deskripsi maksimal 1000 karakter.")
      .optional(),
    priority: z.enum(PROJECT_PRIORITIES, {
      message: "Pilih prioritas project yang valid.",
    }),
    start_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal mulai harus YYYY-MM-DD."),
    deadline: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}$/,
        "Format tanggal batas akhir (deadline) harus YYYY-MM-DD."
      ),
    sms_owner_id: uuidSchema("Pilih penanggung jawab SMS yang valid.")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) => {
      if (data.start_date && data.deadline) {
        return new Date(data.deadline) >= new Date(data.start_date);
      }
      return true;
    },
    {
      message: "Tanggal batas akhir (deadline) tidak boleh lebih awal dari tanggal mulai.",
      path: ["deadline"],
    }
  );

export type CreateProjectFormData = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Nama project minimal 3 karakter.")
      .max(150, "Nama project maksimal 150 karakter."),
    description: z
      .string()
      .trim()
      .max(1000, "Deskripsi maksimal 1000 karakter.")
      .optional(),
    priority: z.enum(PROJECT_PRIORITIES, {
      message: "Pilih prioritas project yang valid.",
    }),
    start_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal mulai harus YYYY-MM-DD."),
    deadline: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}$/,
        "Format tanggal batas akhir (deadline) harus YYYY-MM-DD."
      ),
    brand_id: uuidSchema("Pilih brand yang valid.").optional(),
    sms_owner_id: uuidSchema("Pilih penanggung jawab SMS yang valid.")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) => {
      if (data.start_date && data.deadline) {
        return new Date(data.deadline) >= new Date(data.start_date);
      }
      return true;
    },
    {
      message: "Tanggal batas akhir (deadline) tidak boleh lebih awal dari tanggal mulai.",
      path: ["deadline"],
    }
  );

export type UpdateProjectFormData = z.infer<typeof updateProjectSchema>;

export const addProjectMemberSchema = z.object({
  project_id: uuidSchema("ID project tidak valid."),
  user_id: uuidSchema("Pilih anggota tim yang valid."),
});

export type AddProjectMemberData = z.infer<typeof addProjectMemberSchema>;
