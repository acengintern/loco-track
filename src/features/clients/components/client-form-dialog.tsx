"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientFormSchema, type ClientFormData } from "../schemas";
import { createClientAction, updateClientAction } from "../actions";
import type { ClientRow } from "../types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientToEdit?: ClientRow | null;
  onSuccess?: () => void;
}

export function ClientFormDialog({
  open,
  onOpenChange,
  clientToEdit,
  onSuccess,
}: ClientFormDialogProps) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const isEditing = Boolean(clientToEdit);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: "",
      description: "",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      is_active: true,
    },
  });

  React.useEffect(() => {
    if (clientToEdit) {
      reset({
        name: clientToEdit.name,
        description: clientToEdit.description || "",
        contact_name: clientToEdit.contact_name || "",
        contact_email: clientToEdit.contact_email || "",
        contact_phone: clientToEdit.contact_phone || "",
        is_active: clientToEdit.is_active,
      });
    } else {
      reset({
        name: "",
        description: "",
        contact_name: "",
        contact_email: "",
        contact_phone: "",
        is_active: true,
      });
    }
  }, [clientToEdit, reset, open]);

  const onSubmit = async (data: ClientFormData) => {
    setServerError(null);
    try {
      if (isEditing && clientToEdit) {
        const res = await updateClientAction(clientToEdit.id, data);
        if (!res.success) {
          const msg = res.error || "Gagal memperbarui client.";
          setServerError(msg);
          toast.error(msg);
          return;
        }
        toast.success("Data client berhasil diperbarui.");
      } else {
        const res = await createClientAction(data);
        if (!res.success) {
          const msg = res.error || "Gagal membuat client.";
          setServerError(msg);
          toast.error(msg);
          return;
        }
        toast.success("Client baru berhasil ditambahkan.");
      }

      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch {
      const msg = "Terjadi kesalahan teknis. Silakan coba kembali.";
      setServerError(msg);
      toast.error(msg);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) setServerError(null);
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle className="text-base font-semibold">
            {isEditing ? "Edit Data Client" : "Tambah Client Baru"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isEditing
              ? "Perbarui informasi kontak dan status aktif perusahaan client."
              : "Masukkan informasi profil dan kontak utama client agency."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
            {serverError && (
              <div
                role="alert"
                className="rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive font-medium"
              >
                {serverError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="client-name" className="text-xs font-medium">
                Nama Client <span className="text-destructive">*</span>
              </Label>
              <Input
                id="client-name"
                type="text"
                placeholder="Contoh: PT Unilever Indonesia"
                disabled={isSubmitting}
                className="text-xs"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-[11px] text-destructive font-medium">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-desc" className="text-xs font-medium">
                Deskripsi Singkat
              </Label>
              <Input
                id="client-desc"
                type="text"
                placeholder="Catatan ringkas hubungan bisnis atau kategori industri"
                disabled={isSubmitting}
                className="text-xs"
                {...register("description")}
              />
              {errors.description && (
                <p className="text-[11px] text-destructive font-medium">
                  {errors.description.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="client-contact" className="text-xs font-medium">
                  Nama Kontak Utama
                </Label>
                <Input
                  id="client-contact"
                  type="text"
                  placeholder="Nama PIC client"
                  disabled={isSubmitting}
                  className="text-xs"
                  {...register("contact_name")}
                />
                {errors.contact_name && (
                  <p className="text-[11px] text-destructive font-medium">
                    {errors.contact_name.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client-phone" className="text-xs font-medium">
                  Nomor Telepon
                </Label>
                <Input
                  id="client-phone"
                  type="tel"
                  placeholder="+62 812..."
                  disabled={isSubmitting}
                  className="text-xs"
                  {...register("contact_phone")}
                />
                {errors.contact_phone && (
                  <p className="text-[11px] text-destructive font-medium">
                    {errors.contact_phone.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-email" className="text-xs font-medium">
                Email Kontak
              </Label>
              <Input
                id="client-email"
                type="email"
                placeholder="pic@perusahaan.com"
                disabled={isSubmitting}
                className="text-xs"
                {...register("contact_email")}
              />
              {errors.contact_email && (
                <p className="text-[11px] text-destructive font-medium">
                  {errors.contact_email.message}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="client-is-active"
                type="checkbox"
                className="size-4 rounded border-border text-primary focus:ring-ring"
                disabled={isSubmitting}
                {...register("is_active")}
              />
              <Label
                htmlFor="client-is-active"
                className="text-xs font-medium cursor-pointer"
              >
                Status client aktif
              </Label>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting
                ? "Menyimpan..."
                : isEditing
                ? "Simpan Perubahan"
                : "Buat Client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
