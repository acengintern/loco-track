"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  updateProjectSchema,
  type UpdateProjectFormData,
  PROJECT_PRIORITIES,
} from "../schemas";
import { updateProjectAction } from "../actions";
import type { ProjectDetail } from "../types";
import { PROJECT_PRIORITY_LABELS } from "./project-badges";
import { formatBrandOptionLabel } from "@/constants/labels";
import { Loader2 } from "lucide-react";
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "@/components/ui/toast";

interface ProjectEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectDetail;
  brands: Array<{
    id: string;
    name: string;
    code: string;
    client_name: string;
  }>;
  smsUsers: Array<{
    id: string;
    full_name: string;
    email: string;
  }>;
  isAdmin: boolean;
  onSuccess?: () => void;
}

export function ProjectEditDialog({
  open,
  onOpenChange,
  project,
  brands,
  smsUsers,
  isAdmin,
  onSuccess,
}: ProjectEditDialogProps) {
  const [serverError, setServerError] = React.useState<string | null>(null);

  const canChangeBrand = project.status === "BRIEF_RECEIVED";
  const deadlineDateStr = project.deadline ? project.deadline.split("T")[0] : "";

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProjectFormData>({
    resolver: zodResolver(updateProjectSchema),
    defaultValues: {
      name: project.name,
      description: project.description || "",
      priority: project.priority,
      start_date: project.start_date || "",
      deadline: deadlineDateStr,
      brand_id: project.brand_id,
      sms_owner_id: project.sms_owner_id,
    },
  });

  const selectedPriority = useWatch({ control, name: "priority" });
  const selectedSmsOwnerId = useWatch({ control, name: "sms_owner_id" });
  const selectedBrandId = useWatch({ control, name: "brand_id" });
  const selectedStartDate = useWatch({ control, name: "start_date" });
  const selectedDeadline = useWatch({ control, name: "deadline" });

  const selectedPriorityLabel = selectedPriority
    ? PROJECT_PRIORITY_LABELS[selectedPriority] || selectedPriority
    : "Pilih prioritas...";

  const selectedSmsOwnerLabel = React.useMemo(() => {
    if (!selectedSmsOwnerId || selectedSmsOwnerId === "NONE") return "Pilih SMS owner...";
    const found = smsUsers.find((u) => u.id === selectedSmsOwnerId);
    return found ? `${found.full_name} (${found.email})` : "Data tidak tersedia";
  }, [selectedSmsOwnerId, smsUsers]);

  const selectedBrandLabel = React.useMemo(() => {
    if (!selectedBrandId || selectedBrandId === "NONE") return "Pilih brand...";
    const found = brands.find((b) => b.id === selectedBrandId);
    return found ? formatBrandOptionLabel(found) : "Data tidak tersedia";
  }, [selectedBrandId, brands]);

  React.useEffect(() => {
    reset({
      name: project.name,
      description: project.description || "",
      priority: project.priority,
      start_date: project.start_date || "",
      deadline: project.deadline ? project.deadline.split("T")[0] : "",
      brand_id: project.brand_id,
      sms_owner_id: project.sms_owner_id,
    });
  }, [project, reset, open]);

  const onSubmit = async (data: UpdateProjectFormData) => {
    setServerError(null);
    try {
      const res = await updateProjectAction(project.id, data);
      if (!res.success) {
        const errorMsg = res.error || "Gagal memperbarui data project. Coba lagi.";
        setServerError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      toast.success("Project berhasil diperbarui.");
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch {
      const errorMsg = "Terjadi kesalahan teknis saat memperbarui project.";
      setServerError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) setServerError(null);
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[calc(100dvh-3.5rem)] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl">
        <DialogHeader className="px-6 py-5 border-b border-border/80 bg-card shrink-0">
          <DialogTitle className="text-base font-semibold">
            Edit Metadata Project
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Perbarui parameter operasional project ({project.project_code}).
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
              <Label htmlFor="edit-name" className="text-xs font-medium">
                Nama Project <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                type="text"
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-priority-select" className="text-xs font-medium">
                  Prioritas <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedPriority || "MEDIUM"}
                  onValueChange={(val) => {
                    if (val) {
                      setValue("priority", val as UpdateProjectFormData["priority"], {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="edit-priority-select" className="text-xs h-9 w-full">
                    <SelectValue placeholder="Pilih prioritas...">
                      {selectedPriorityLabel}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PROJECT_PRIORITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isAdmin && (
                <div className="space-y-1.5">
                  <Label htmlFor="edit-sms-select" className="text-xs font-medium">
                    Penanggung Jawab SMS
                  </Label>
                  <Select
                    value={selectedSmsOwnerId || "NONE"}
                    onValueChange={(val) => {
                      setValue("sms_owner_id", !val || val === "NONE" ? "" : val, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="edit-sms-select" className="text-xs h-9 w-full">
                      <SelectValue placeholder="Pilih SMS owner...">
                        {selectedSmsOwnerLabel}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {smsUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-start-date" className="text-xs font-medium">
                  Tanggal Mulai <span className="text-destructive">*</span>
                </Label>
                <DatePicker
                  id="edit-start-date"
                  value={selectedStartDate}
                  onChange={(val) => {
                    setValue("start_date", val, { shouldDirty: true, shouldValidate: true });
                  }}
                  disabled={isSubmitting}
                />
                {errors.start_date && (
                  <p className="text-[11px] text-destructive font-medium">
                    {errors.start_date.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-deadline" className="text-xs font-medium">
                  Batas Akhir (Deadline) <span className="text-destructive">*</span>
                </Label>
                <DatePicker
                  id="edit-deadline"
                  value={selectedDeadline}
                  onChange={(val) => {
                    setValue("deadline", val, { shouldDirty: true, shouldValidate: true });
                  }}
                  disabled={isSubmitting}
                />
                {errors.deadline && (
                  <p className="text-[11px] text-destructive font-medium">
                    {errors.deadline.message}
                  </p>
                )}
              </div>
            </div>

            {canChangeBrand && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-brand-select" className="text-xs font-medium">
                  Brand Klien
                </Label>
                <Select
                  value={selectedBrandId || "NONE"}
                  onValueChange={(val) => {
                    setValue("brand_id", !val || val === "NONE" ? "" : val, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="edit-brand-select" className="text-xs h-9 w-full">
                    <SelectValue placeholder="Pilih brand...">
                      {selectedBrandLabel}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {formatBrandOptionLabel(b)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="edit-desc" className="text-xs font-medium">
                Deskripsi Project
              </Label>
              <textarea
                id="edit-desc"
                rows={3}
                disabled={isSubmitting}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-2xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Deskripsi atau catatan khusus..."
                {...register("description")}
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-4.5 sm:py-5 border-t border-border bg-muted/20 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 shrink-0 mt-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => handleOpenChange(false)}
              className="h-8 text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-8 text-xs gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan Perubahan</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
