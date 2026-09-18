"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  contentPlanFormSchema,
  PRESET_CHANNELS,
  type ContentPlanFormData,
} from "../schemas";
import {
  createContentPlanAction,
  updateContentPlanAction,
} from "../actions";
import type { ContentPlanDetail } from "../types";
import { AlertCircle, Layers, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "@/components/ui/toast";

interface ContentPlanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  initialData?: ContentPlanDetail | null;
  onSuccess?: () => void;
}

export function ContentPlanFormDialog({
  open,
  onOpenChange,
  projectId,
  initialData,
  onSuccess,
}: ContentPlanFormDialogProps) {
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContentPlanFormData>({
    resolver: zodResolver(contentPlanFormSchema),
    defaultValues: {
      title: initialData?.title || "",
      channel: initialData?.channel || "Instagram Feed",
      planned_post_date: initialData?.planned_post_date || new Date().toISOString().split("T")[0],
      pillar: initialData?.pillar || "",
      copy_draft: initialData?.copy_draft || "",
      status: (initialData?.status as "DRAFT" | "APPROVED") || "DRAFT",
    },
  });

  const selectedChannel = useWatch({ control, name: "channel" });
  const selectedStatus = useWatch({ control, name: "status" });
  const selectedPlannedDate = useWatch({ control, name: "planned_post_date" });

  const [prevOpen, setPrevOpen] = React.useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setServerError(null);
    }
  }

  React.useEffect(() => {
    reset({
      title: initialData?.title || "",
      channel: initialData?.channel || "Instagram Feed",
      planned_post_date: initialData?.planned_post_date || new Date().toISOString().split("T")[0],
      pillar: initialData?.pillar || "",
      copy_draft: initialData?.copy_draft || "",
      status: (initialData?.status as "DRAFT" | "APPROVED") || "DRAFT",
    });
  }, [initialData, reset, open]);

  const handleClose = React.useCallback(() => {
    setServerError(null);
    onOpenChange(false);
  }, [onOpenChange]);

  const onSubmit = async (data: ContentPlanFormData) => {
    setServerError(null);

    let res;
    if (initialData) {
      res = await updateContentPlanAction(initialData.id, projectId, data);
    } else {
      res = await createContentPlanAction(projectId, data);
    }

    if (!res.success) {
      const errorMsg = res.error || "Gagal menyimpan content plan. Coba lagi.";
      setServerError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    toast.success(initialData ? "Content plan berhasil diperbarui." : "Content plan berhasil ditambahkan.");
    onOpenChange(false);
    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Layers className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-foreground">
                {initialData ? "Edit Content Plan" : "Tambah Content Plan"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Rencanakan slot publikasi konten, channel, tanggal rilis, dan draft copywriting.
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
                className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-destructive border border-destructive/20 font-medium"
              >
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{serverError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cp-title" className="text-xs font-medium">
                Judul Konten <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cp-title"
                type="text"
                className="text-xs h-9"
                disabled={isSubmitting}
                placeholder="Misal: Tips Perawatan Kulit Saat Cuaca Panas"
                {...register("title")}
              />
              {errors.title && (
                <p className="text-[11px] text-destructive font-medium">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Channel / Platform <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {PRESET_CHANNELS.map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setValue("channel", ch, { shouldValidate: true, shouldDirty: true })}
                    className={`rounded-md px-2.5 py-1 text-xs border transition-colors cursor-pointer outline-none ${
                      selectedChannel === ch
                        ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                        : "border-border bg-muted/30 text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
              <Input
                type="text"
                disabled={isSubmitting}
                className="text-xs h-9"
                placeholder="Atau ketik nama channel kustom..."
                {...register("channel")}
              />
              {errors.channel && (
                <p className="text-[11px] text-destructive font-medium">{errors.channel.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cp-planned-date" className="text-xs font-medium">
                  Tanggal Rencana Posting <span className="text-destructive">*</span>
                </Label>
                <DatePicker
                  id="cp-planned-date"
                  value={selectedPlannedDate}
                  onChange={(val) => {
                    setValue("planned_post_date", val, { shouldDirty: true, shouldValidate: true });
                  }}
                  disabled={isSubmitting}
                />
                {errors.planned_post_date && (
                  <p className="text-[11px] text-destructive font-medium">
                    {errors.planned_post_date.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cp-pillar" className="text-xs font-medium">
                  Pillar / Tema
                </Label>
                <Input
                  id="cp-pillar"
                  type="text"
                  disabled={isSubmitting}
                  className="text-xs h-9"
                  placeholder="Misal: Edukasi, Promosi, dsb."
                  {...register("pillar")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-copy-draft" className="text-xs font-medium">
                Draft Caption & Copywriting
              </Label>
              <textarea
                id="cp-copy-draft"
                rows={4}
                disabled={isSubmitting}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 resize-y"
                placeholder="Tuliskan draft caption, hashtag, atau catatan copywriting..."
                {...register("copy_draft")}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Status Kesiapan Konten
              </Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setValue("status", "DRAFT", { shouldDirty: true })}
                  className={`flex-1 rounded-md px-3 py-2 text-xs font-medium border transition-colors cursor-pointer outline-none ${
                    selectedStatus === "DRAFT"
                      ? "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold ring-1 ring-amber-500/30"
                      : "border-border bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  DRAFT
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setValue("status", "APPROVED", { shouldDirty: true })}
                  className={`flex-1 rounded-md px-3 py-2 text-xs font-medium border transition-colors cursor-pointer outline-none ${
                    selectedStatus === "APPROVED"
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold ring-1 ring-emerald-500/30"
                      : "border-border bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  APPROVED (Siap Internal)
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Status APPROVED menandakan kesiapan editorial internal oleh tim perencana.
              </p>
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
                <span>{initialData ? "Simpan Perubahan" : "Simpan Konten"}</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
