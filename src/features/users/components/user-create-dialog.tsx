"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS } from "@/constants/navigation";
import type { UserRole } from "@/lib/supabase/provisioning";
import { createUserSchema, type CreateUserInput } from "../schemas";
import { createUserAction } from "../actions";

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  ADMIN: "Tata kelola sistem, akun personel, dan audit.",
  CREATIVE_DIRECTOR: "Pemeriksaan QC internal, persetujuan, dan pengawasan mutu.",
  ACCOUNT_EXECUTIVE: "Pemantauan jadwal kampanye client dan progres tim.",
  SOCIAL_MEDIA_SPECIALIST: "Operasional project, pembuatan task, dan distribusi konten.",
  GRAPHIC_DESIGNER: "Eksekusi desain grafis, deliverable, dan revisi.",
  VIDEO_EDITOR: "Eksekusi penyuntingan video, render, dan revisi.",
};

interface UserCreateDialogProps {
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function UserCreateDialog({ onSuccess, trigger }: UserCreateDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isPending, setIsPending] = React.useState(false);

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      fullName: "",
      email: "",
      username: "",
      role: "GRAPHIC_DESIGNER",
      password: "",
      sendInvite: false,
    },
  });

  const sendInvite = useWatch({ control: form.control, name: "sendInvite" });
  const selectedRole = useWatch({ control: form.control, name: "role" });

  const onSubmit = async (values: CreateUserInput) => {
    setIsPending(true);
    setServerError(null);

    const res = await createUserAction(values);

    setIsPending(false);

    if (!res.success) {
      setServerError(res.error || "Gagal membuat pengguna baru.");
      return;
    }

    form.reset();
    setOpen(false);
    onSuccess?.();
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      form.reset();
      setServerError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button size="sm" className="gap-1.5 h-8 text-xs">
              <UserPlus className="size-3.5" />
              <span>Tambah Pengguna</span>
            </Button>
          )
        }
      />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Tambah Pengguna Baru
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Daftarkan akun personel agency baru ke dalam sistem dan tentukan peran aksesnya.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {serverError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Nama Lengkap */}
          <div className="space-y-1.5">
            <label
              htmlFor="user-full-name"
              className="text-xs font-medium text-foreground"
            >
              Nama Lengkap <span className="text-destructive">*</span>
            </label>
            <Input
              id="user-full-name"
              placeholder="Contoh: Sarah Pratiwi"
              className="h-8 text-xs"
              {...form.register("fullName")}
            />
            {form.formState.errors.fullName && (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.fullName.message}
              </p>
            )}
          </div>

          {/* Nama Pengguna (Username) */}
          <div className="space-y-1.5">
            <label
              htmlFor="user-username"
              className="text-xs font-medium text-foreground"
            >
              Nama Pengguna (Username) <span className="text-destructive">*</span>
            </label>
            <Input
              id="user-username"
              placeholder="Contoh: sarah.p"
              className="h-8 text-xs"
              {...form.register("username")}
            />
            <p className="text-[11px] text-muted-foreground">
              Digunakan personel untuk masuk ke sistem tanpa mengetik email.
            </p>
            {form.formState.errors.username && (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.username.message}
              </p>
            )}
          </div>

          {/* Alamat Email */}
          <div className="space-y-1.5">
            <label
              htmlFor="user-email"
              className="text-xs font-medium text-foreground"
            >
              Alamat Email <span className="text-destructive">*</span>
            </label>
            <Input
              id="user-email"
              type="email"
              placeholder="nama@locotrack.local"
              className="h-8 text-xs"
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          {/* Peran / Role */}
          <div className="space-y-1.5">
            <label
              htmlFor="user-role"
              className="text-xs font-medium text-foreground"
            >
              Peran Akun <span className="text-destructive">*</span>
            </label>
            <Select
              value={selectedRole}
              onValueChange={(val) => {
                if (val) form.setValue("role", val as UserRole);
              }}
            >
              <SelectTrigger id="user-role" className="h-8 text-xs w-full">
                <SelectValue placeholder="Pilih peran pengguna" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRole && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {ROLE_DESCRIPTIONS[selectedRole]}
              </p>
            )}
            {form.formState.errors.role && (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.role.message}
              </p>
            )}
          </div>

          {/* Password vs Send Invite */}
          <div className="space-y-3 rounded-md border border-border/70 bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              <input
                id="user-send-invite"
                type="checkbox"
                className="rounded border-input text-primary focus:ring-primary size-3.5"
                {...form.register("sendInvite")}
              />
              <label
                htmlFor="user-send-invite"
                className="text-xs font-medium text-foreground cursor-pointer"
              >
                Kirim tautan undangan via email (pengguna mengatur kata sandi sendiri)
              </label>
            </div>

            {!sendInvite && (
              <div className="space-y-1.5 pt-1">
                <label
                  htmlFor="user-password"
                  className="text-xs font-medium text-foreground"
                >
                  Kata Sandi Awal <span className="text-destructive">*</span>
                </label>
                <Input
                  id="user-password"
                  type="password"
                  placeholder="Minimal 8 karakter"
                  className="h-8 text-xs"
                  {...form.register("password")}
                />
                <p className="text-[11px] text-muted-foreground">
                  Berikan kata sandi awal ini kepada personel terkait untuk login pertama kali.
                </p>
                {form.formState.errors.password && (
                  <p className="text-[11px] text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="h-8 text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="h-8 text-xs gap-1.5"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              <span>Simpan Pengguna</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
