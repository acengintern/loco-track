"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { brandFormSchema, type BrandFormData } from "../schemas";
import { createBrandAction, updateBrandAction } from "../actions";
import type { BrandRow } from "../types";
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface ClientOption {
  id: string;
  name: string;
}

interface BrandFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandToEdit?: BrandRow | null;
  clients: ClientOption[];
  preselectedClientId?: string;
  onSuccess?: () => void;
}

export function BrandFormDialog({
  open,
  onOpenChange,
  brandToEdit,
  clients,
  preselectedClientId,
  onSuccess,
}: BrandFormDialogProps) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const isEditing = Boolean(brandToEdit);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BrandFormData>({
    resolver: zodResolver(brandFormSchema),
    defaultValues: {
      client_id: preselectedClientId || "",
      name: "",
      code: "",
      description: "",
      is_active: true,
    },
  });

  const selectedClientId = useWatch({ control, name: "client_id" });

  const selectedClientLabel = React.useMemo(() => {
    if (!selectedClientId || selectedClientId === "NONE") return "Pilih client...";
    const found = clients.find((c) => c.id === selectedClientId);
    return found ? found.name : "Data tidak tersedia";
  }, [selectedClientId, clients]);

  React.useEffect(() => {
    if (brandToEdit) {
      reset({
        client_id: brandToEdit.client_id,
        name: brandToEdit.name,
        code: brandToEdit.code,
        description: brandToEdit.description || "",
        is_active: true,
      });
    } else {
      reset({
        client_id: preselectedClientId || (clients.length > 0 ? clients[0].id : ""),
        name: "",
        code: "",
        description: "",
        is_active: true,
      });
    }
  }, [brandToEdit, preselectedClientId, clients, reset, open]);

  const onSubmit = async (data: BrandFormData) => {
    setServerError(null);
    try {
      if (isEditing && brandToEdit) {
        const res = await updateBrandAction(brandToEdit.id, data);
        if (!res.success) {
          const msg = res.error || "Gagal memperbarui brand.";
          setServerError(msg);
          toast.error(msg);
          return;
        }
        toast.success("Data brand berhasil diperbarui.");
      } else {
        const res = await createBrandAction(data);
        if (!res.success) {
          const msg = res.error || "Gagal membuat brand.";
          setServerError(msg);
          toast.error(msg);
          return;
        }
        toast.success("Brand baru berhasil ditambahkan.");
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
            {isEditing ? "Edit Data Brand" : "Tambah Brand Baru"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isEditing
              ? "Perbarui nama, kode, atau informasi brand."
              : "Daftarkan brand baru di bawah naungan perusahaan client."}
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
              <Label htmlFor="brand-client-select" className="text-xs font-medium">
                Perusahaan Client <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedClientId || "NONE"}
                onValueChange={(val) => {
                  setValue("client_id", !val || val === "NONE" ? "" : val, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
                disabled={isSubmitting || Boolean(preselectedClientId && !isEditing)}
              >
                <SelectTrigger id="brand-client-select" className="text-xs h-9 w-full">
                  <SelectValue placeholder="Pilih client...">
                    {selectedClientLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Pilih client...</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.client_id && (
                <p className="text-[11px] text-destructive font-medium">
                  {errors.client_id.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="brand-name" className="text-xs font-medium">
                Nama Brand <span className="text-destructive">*</span>
              </Label>
              <Input
                id="brand-name"
                type="text"
                placeholder="Contoh: Lifebuoy"
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
              <Label htmlFor="brand-code" className="text-xs font-medium">
                Kode Brand (2-10 Karakter Huruf/Angka Kapital){" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="brand-code"
                type="text"
                placeholder="Contoh: LFB"
                disabled={isSubmitting}
                className="text-xs uppercase font-mono tracking-wider"
                {...register("code", {
                  onChange: (e) => {
                    e.target.value = e.target.value.toUpperCase();
                  },
                })}
              />
              <p className="text-[10px] text-muted-foreground">
                Digunakan sebagai awalan penomoran kode unik project.
              </p>
              {errors.code && (
                <p className="text-[11px] text-destructive font-medium">
                  {errors.code.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="brand-desc" className="text-xs font-medium">
                Deskripsi Singkat
              </Label>
              <Input
                id="brand-desc"
                type="text"
                placeholder="Kategori produk atau positioning brand"
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
                : "Buat Brand"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
