import { z } from "zod";
import type { UserRole } from "@/lib/supabase/provisioning";

const validRoles: [UserRole, ...UserRole[]] = [
  "ADMIN",
  "CREATIVE_DIRECTOR",
  "ACCOUNT_EXECUTIVE",
  "SOCIAL_MEDIA_SPECIALIST",
  "GRAPHIC_DESIGNER",
  "VIDEO_EDITOR",
];

export const createUserSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Nama lengkap minimal 2 karakter.")
      .max(100, "Nama lengkap maksimal 100 karakter."),
    email: z
      .string()
      .trim()
      .email("Format alamat email tidak valid.")
      .max(255, "Alamat email maksimal 255 karakter."),
    username: z
      .string()
      .trim()
      .min(3, "Nama pengguna minimal 3 karakter.")
      .max(30, "Nama pengguna maksimal 30 karakter.")
      .regex(
        /^[a-zA-Z0-9_.-]+$/,
        "Nama pengguna hanya boleh berisi huruf, angka, titik, strip, atau underscore."
      )
      .toLowerCase(),
    role: z.enum(validRoles, {
      message: "Pilih peran pengguna yang valid.",
    }),
    password: z
      .string()
      .min(8, "Kata sandi minimal 8 karakter.")
      .max(72, "Kata sandi maksimal 72 karakter.")
      .optional()
      .or(z.literal("")),
    sendInvite: z.boolean(),
  })
  .refine(
    (data) => {
      // If sendInvite is false, password must be provided and have at least 8 characters
      if (!data.sendInvite) {
        return Boolean(data.password && data.password.length >= 8);
      }
      return true;
    },
    {
      message: "Kata sandi minimal 8 karakter wajib diisi jika tidak mengirim undangan email.",
      path: ["password"],
    }
  );

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  id: z.string().uuid("ID pengguna tidak valid."),
  fullName: z
    .string()
    .trim()
    .min(2, "Nama lengkap minimal 2 karakter.")
    .max(100, "Nama lengkap maksimal 100 karakter."),
  username: z
    .string()
    .trim()
    .min(3, "Nama pengguna minimal 3 karakter.")
    .max(30, "Nama pengguna maksimal 30 karakter.")
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      "Nama pengguna hanya boleh berisi huruf, angka, titik, strip, atau underscore."
    )
    .toLowerCase()
    .optional()
    .or(z.literal("")),
  role: z.enum(validRoles, {
    message: "Pilih peran pengguna yang valid.",
  }),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const toggleUserStatusSchema = z.object({
  id: z.string().uuid("ID pengguna tidak valid."),
  isActive: z.boolean(),
});

export type ToggleUserStatusInput = z.infer<typeof toggleUserStatusSchema>;

export const resetPasswordSchema = z.object({
  id: z.string().uuid("ID pengguna tidak valid."),
  password: z
    .string()
    .min(8, "Kata sandi baru minimal 8 karakter.")
    .max(72, "Kata sandi baru maksimal 72 karakter."),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
