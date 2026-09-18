"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { scriptFormSchema, type ScriptFormData } from "../schemas";
import {
  createScriptAction,
  updateScriptAction,
  exceptionalUpdateScriptAction,
} from "../actions";
import type { ScriptWithRelations } from "../types";
import { AlertCircle, FileText, Loader2 } from "lucide-react";
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
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { formatContentPlanLabel } from "@/constants/labels";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

interface ScriptFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  initialData?: ScriptWithRelations | null;
  availableContentPlans?: {
    id: string;
    title: string;
    channel: string;
  }[];
  isProductionLocked?: boolean;
  onSuccess?: () => void;
}

export function ScriptFormDialog({
  open,
  onOpenChange,
  projectId,
  initialData,
  availableContentPlans = [],
  isProductionLocked = false,
  onSuccess,
}: ScriptFormDialogProps) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [exceptionalReason, setExceptionalReason] = React.useState("");

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ScriptFormData>({
    resolver: zodResolver(scriptFormSchema),
    defaultValues: {
      title: initialData?.title || "",
      content_plan_id: initialData?.content_plan_id || null,
      hook: initialData?.hook || "",
      body: initialData?.body || "",
      visual_cues: initialData?.visual_cues || "",
      call_to_action: initialData?.call_to_action || "",
      status: (initialData?.status as "DRAFT" | "READY") || "DRAFT",
    },
  });

  const selectedContentPlanId = useWatch({ control, name: "content_plan_id" });
  const selectedStatus = useWatch({ control, name: "status" });

  const allContentPlans = React.useMemo(() => {
    const map = new Map<
      string,
      { id: string; title: string; channel?: string; planned_post_date?: string | null }
    >();
    availableContentPlans.forEach((cp) => map.set(cp.id, cp));
    if (initialData?.content_plan) {
      if (!map.has(initialData.content_plan.id)) {
        map.set(initialData.content_plan.id, {
          id: initialData.content_plan.id,
          title: initialData.content_plan.title,
          channel: initialData.content_plan.channel,
          planned_post_date: null,
        });
      }
    }
    return Array.from(map.values());
  }, [availableContentPlans, initialData]);

  const selectedContentPlanLabel = React.useMemo(() => {
    if (!selectedContentPlanId || selectedContentPlanId === "NONE") {
      return "Belum Dipilih / Tidak Ditautkan";
    }
    const found = allContentPlans.find((cp) => cp.id === selectedContentPlanId);
    return found ? formatContentPlanLabel(found) : "Data tidak tersedia";
  }, [selectedContentPlanId, allContentPlans]);

  const [prevOpen, setPrevOpen] = React.useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setServerError(null);
      setExceptionalReason("");
    }
  }

  React.useEffect(() => {
    reset({
      title: initialData?.title || "",
      content_plan_id: initialData?.content_plan_id || null,
      hook: initialData?.hook || "",
      body: initialData?.body || "",
      visual_cues: initialData?.visual_cues || "",
      call_to_action: initialData?.call_to_action || "",
      status: (initialData?.status as "DRAFT" | "READY") || "DRAFT",
    });
  }, [initialData, reset, open]);

  const handleClose = React.useCallback(() => {
    setServerError(null);
    onOpenChange(false);
  }, [onOpenChange]);

  const onSubmit = async (data: ScriptFormData) => {
    setServerError(null);

    let res;
    if (initialData) {
      if (isProductionLocked) {
        if (!exceptionalReason.trim()) {
          setServerError("Alasan revisi luar biasa wajib diisi ketika project sudah dalam tahap produksi.");
          return;
        }
        res = await exceptionalUpdateScriptAction(initialData.id, projectId, data, exceptionalReason);
      } else {
        res = await updateScriptAction(initialData.id, projectId, data);
      }
    } else {
      res = await createScriptAction(projectId, data);
    }

    if (!res.success) {
      const errorMsg = res.error || "Gagal menyimpan naskah. Coba lagi.";
      setServerError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    toast.success(initialData ? "Perubahan naskah berhasil disimpan." : "Naskah berhasil dibuat.");
    onOpenChange(false);
    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FileText className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-foreground">
                {initialData ? "Ubah Naskah Konten" : "Tambah Naskah Baru"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Struktur naskah video atau copy copywriting lengkap dengan visual cues.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
            {serverError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive font-medium"
              >
                <AlertCircle className="size-4 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            {isProductionLocked && initialData && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-amber-600 dark:text-amber-400">
                <p className="font-medium">Perhatian: Project dalam tahap produksi.</p>
                <p className="mt-1 text-muted-foreground">
                  Perubahan pada naskah ini dicatat sebagai revisi luar biasa dan membutuhkan alasan revisi resmi.
                </p>
                <div className="mt-2.5">
                  <Label htmlFor="exceptional-reason" className="block text-[11px] font-medium text-foreground mb-1">
                    Alasan Revisi Luar Biasa <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="exceptional-reason"
                    type="text"
                    value={exceptionalReason}
                    onChange={(e) => setExceptionalReason(e.target.value)}
                    placeholder="Contoh: Koreksi USP dan penyesuaian regulasi brand"
                    className="text-xs h-9"
                    required
                  />
                </div>
              </div>
            )}

            {/* Judul & Content Plan Link */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="script-title" className="text-xs font-medium">
                  Judul Naskah <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="script-title"
                  type="text"
                  placeholder="Misal: Hook Penasaran Solusi Wajah Kusam"
                  className="text-xs h-9"
                  disabled={isSubmitting}
                  {...register("title")}
                />
                {errors.title && (
                  <p className="text-[11px] text-destructive font-medium">{errors.title.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="script-content-plan" className="text-xs font-medium">
                  Tautkan Content Plan (Opsional)
                </Label>
                <Select
                  value={selectedContentPlanId || "NONE"}
                  onValueChange={(val) => {
                    setValue("content_plan_id", !val || val === "NONE" ? null : val, {
                      shouldDirty: true,
                    });
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="script-content-plan" className="text-xs h-9 w-full">
                    <SelectValue placeholder="Pilih content plan...">
                      {selectedContentPlanLabel}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Belum Dipilih / Tidak Ditautkan</SelectItem>
                    {allContentPlans.map((cp) => (
                      <SelectItem key={cp.id} value={cp.id}>
                        {formatContentPlanLabel(cp)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.content_plan_id && (
                  <p className="text-[11px] text-destructive font-medium">{errors.content_plan_id.message}</p>
                )}
              </div>
            </div>

            {/* Hook */}
            <div className="space-y-1.5">
              <Label htmlFor="script-hook" className="text-xs font-medium">
                Hook (Detik 0 sampai 3) <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="script-hook"
                rows={2}
                disabled={isSubmitting}
                {...register("hook")}
                placeholder="Pembuka yang langsung mencuri perhatian penonton..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y disabled:opacity-50"
              />
              {errors.hook && (
                <p className="text-[11px] text-destructive font-medium">{errors.hook.message}</p>
              )}
            </div>

            {/* Visual Cues */}
            <div className="space-y-1.5">
              <Label htmlFor="script-visual-cues" className="text-xs font-medium">
                Petunjuk Visual & Aset <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="script-visual-cues"
                rows={2}
                disabled={isSubmitting}
                {...register("visual_cues")}
                placeholder="Arah visual untuk desainer dan editor video (angle, teks di layar, transisi)..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y disabled:opacity-50"
              />
              {errors.visual_cues && (
                <p className="text-[11px] text-destructive font-medium">{errors.visual_cues.message}</p>
              )}
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <Label htmlFor="script-body" className="text-xs font-medium">
                Isi Naskah (Body) <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="script-body"
                rows={4}
                disabled={isSubmitting}
                {...register("body")}
                placeholder="Penyampaian pesan utama, solusi masalah, atau storytelling konten..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y disabled:opacity-50"
              />
              {errors.body && (
                <p className="text-[11px] text-destructive font-medium">{errors.body.message}</p>
              )}
            </div>

            {/* Call to Action */}
            <div className="space-y-1.5">
              <Label htmlFor="script-cta" className="text-xs font-medium">
                Call to Action (CTA) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="script-cta"
                type="text"
                disabled={isSubmitting}
                {...register("call_to_action")}
                placeholder="Ajakan bertindak, misal: Cek link di bio untuk diskon 30% hari ini!"
                className="text-xs h-9"
              />
              {errors.call_to_action && (
                <p className="text-[11px] text-destructive font-medium">{errors.call_to_action.message}</p>
              )}
            </div>

            {/* Status Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Status Kesiapan Naskah
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setValue("status", "DRAFT", { shouldDirty: true })}
                  className={`flex flex-col items-start p-3 rounded-md border text-left transition-colors cursor-pointer outline-none ${
                    selectedStatus === "DRAFT"
                      ? "border-amber-500/50 bg-amber-500/10 text-foreground ring-1 ring-amber-500/30"
                      : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className="text-xs font-semibold text-amber-500">DRAFT</span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">
                    Naskah masih dalam proses penulisan dan penyempurnaan.
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setValue("status", "READY", { shouldDirty: true })}
                  className={`flex flex-col items-start p-3 rounded-md border text-left transition-colors cursor-pointer outline-none ${
                    selectedStatus === "READY"
                      ? "border-emerald-500/50 bg-emerald-500/10 text-foreground ring-1 ring-emerald-500/30"
                      : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className="text-xs font-semibold text-emerald-500">READY</span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">
                    Naskah sudah selesai, siap digunakan tim produksi.
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Dialog Footer */}
          <DialogFooter className="px-6 py-3.5 border-t border-border bg-muted/20 flex items-center justify-end gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>{initialData ? "Simpan Perubahan" : "Buat Naskah"}</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
