"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import type { UserListItem } from "../types";
import { updateUserSchema, type UpdateUserInput } from "../schemas";
import { updateUserAction } from "../actions";

interface UserEditDialogProps {
  user: UserListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function UserEditDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
}: UserEditDialogProps) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isPending, setIsPending] = React.useState(false);

  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      id: user?.id || "",
      fullName: user?.fullName || "",
      username: user?.username || "",
      role: user?.role || "GRAPHIC_DESIGNER",
    },
  });

  React.useEffect(() => {
    if (user) {
      form.reset({
        id: user.id,
        fullName: user.fullName,
        username: user.username || "",
        role: user.role,
      });
    }
  }, [user, form]);

  const handleDialogChange = (newOpen: boolean) => {
    if (!newOpen) {
      setServerError(null);
    }
    onOpenChange(newOpen);
  };

  const selectedRole = useWatch({ control: form.control, name: "role" });

  const onSubmit = async (values: UpdateUserInput) => {
    setIsPending(true);
    setServerError(null);

    const res = await updateUserAction(values);

    setIsPending(false);

    if (!res.success) {
      setServerError(res.error || "Gagal memperbarui data pengguna.");
      return;
    }

    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Edit Profil & Peran Pengguna
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Perbarui nama lengkap, username login, atau sesuaikan peran operasional personel agency.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {serverError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Email (Read-only reference) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Alamat Email (Identitas Login Alternatif)
            </label>
            <Input
              value={user?.email || ""}
              disabled
              className="h-8 text-xs bg-muted/50 cursor-not-allowed opacity-80"
            />
          </div>

          {/* Nama Pengguna (Username) */}
          <div className="space-y-1.5">
            <label
              htmlFor="edit-user-username"
              className="text-xs font-medium text-foreground"
            >
              Nama Pengguna (Username)
            </label>
            <Input
              id="edit-user-username"
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

          {/* Nama Lengkap */}
          <div className="space-y-1.5">
            <label
              htmlFor="edit-user-fullname"
              className="text-xs font-medium text-foreground"
            >
              Nama Lengkap <span className="text-destructive">*</span>
            </label>
            <Input
              id="edit-user-fullname"
              className="h-8 text-xs"
              {...form.register("fullName")}
            />
            {form.formState.errors.fullName && (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.fullName.message}
              </p>
            )}
          </div>

          {/* Peran / Role */}
          <div className="space-y-1.5">
            <label
              htmlFor="edit-user-role"
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
              <SelectTrigger id="edit-user-role" className="h-8 text-xs w-full">
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
            {form.formState.errors.role && (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.role.message}
              </p>
            )}
          </div>

          <DialogFooter className="pt-4 mt-6 border-t border-border/60 gap-2.5 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
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
              <span>Simpan Perubahan</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
