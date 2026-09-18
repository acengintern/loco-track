import { z } from "zod";

export const scriptFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Judul naskah minimal 3 karakter."),
  content_plan_id: z
    .string()
    .optional()
    .nullable(),
  hook: z
    .string()
    .trim()
    .min(3, "Hook opening minimal 3 karakter."),
  body: z
    .string()
    .trim()
    .min(5, "Isi naskah minimal 5 karakter."),
  visual_cues: z
    .string()
    .trim()
    .min(3, "Petunjuk visual minimal 3 karakter."),
  call_to_action: z
    .string()
    .trim()
    .min(3, "Call to action minimal 3 karakter."),
  status: z.enum(["DRAFT", "READY"]),
});

export type ScriptFormData = z.infer<typeof scriptFormSchema>;
