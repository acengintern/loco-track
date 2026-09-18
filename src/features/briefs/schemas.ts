import { z } from "zod";

export const briefFormSchema = z.object({
  objective: z
    .string()
    .trim()
    .min(5, "Tujuan campaign minimal 5 karakter."),
  target_audience: z
    .string()
    .trim()
    .min(5, "Target audiens minimal 5 karakter."),
  key_message: z
    .string()
    .trim()
    .min(5, "Pesan utama minimal 5 karakter."),
  deliverables_summary: z
    .string()
    .trim()
    .min(5, "Ringkasan deliverable minimal 5 karakter."),
  reference_links: z
    .string()
    .trim()
    .optional()
    .nullable(),
});

export type BriefFormData = z.infer<typeof briefFormSchema>;
