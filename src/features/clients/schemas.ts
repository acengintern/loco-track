import { z } from "zod";

export const clientFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama client minimal 2 karakter.")
    .max(100, "Nama client maksimal 100 karakter."),
  description: z
    .string()
    .trim()
    .max(500, "Deskripsi maksimal 500 karakter.")
    .optional(),
  contact_name: z
    .string()
    .trim()
    .max(100, "Nama kontak maksimal 100 karakter.")
    .optional(),
  contact_email: z
    .string()
    .trim()
    .email("Format email kontak tidak valid.")
    .optional()
    .or(z.literal("")),
  contact_phone: z
    .string()
    .trim()
    .max(30, "Nomor telepon maksimal 30 karakter.")
    .optional(),
  is_active: z.boolean(),
});

export type ClientFormData = z.infer<typeof clientFormSchema>;
