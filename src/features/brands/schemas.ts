import { z } from "zod";
import { uuidSchema } from "@/lib/validators/uuid";

export const brandFormSchema = z.object({
  client_id: uuidSchema("Pilih client yang valid."),
  name: z
    .string()
    .trim()
    .min(2, "Nama brand minimal 2 karakter.")
    .max(100, "Nama brand maksimal 100 karakter."),
  code: z
    .string()
    .trim()
    .min(2, "Kode brand minimal 2 karakter.")
    .max(10, "Kode brand maksimal 10 karakter.")
    .regex(
      /^[A-Z0-9]+$/,
      "Kode brand hanya boleh menggunakan huruf kapital dan angka tanpa spasi."
    ),
  description: z
    .string()
    .trim()
    .max(500, "Deskripsi maksimal 500 karakter.")
    .optional(),
  is_active: z.boolean(),
});

export type BrandFormData = z.infer<typeof brandFormSchema>;
