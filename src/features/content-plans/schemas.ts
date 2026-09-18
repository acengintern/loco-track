import { z } from "zod";

export const contentPlanFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Judul konten minimal 3 karakter."),
  channel: z
    .string()
    .trim()
    .min(2, "Channel posting wajib diisi."),
  planned_post_date: z
    .string()
    .min(1, "Tanggal posting wajib diisi."),
  pillar: z
    .string()
    .trim()
    .optional()
    .nullable(),
  copy_draft: z
    .string()
    .trim()
    .optional()
    .nullable(),
  status: z.enum(["DRAFT", "APPROVED"]),
});

export type ContentPlanFormData = z.infer<typeof contentPlanFormSchema>;

export const PRESET_CHANNELS = [
  "Instagram Feed",
  "Instagram Story",
  "Instagram Reels",
  "TikTok",
  "YouTube",
  "LinkedIn",
] as const;
