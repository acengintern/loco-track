"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Loader2, AlertCircle, FolderPlus } from "lucide-react";
import {
  createProjectSchema,
  type CreateProjectFormData,
  PROJECT_PRIORITIES,
} from "../schemas";
import { createProjectAction } from "../actions";
import { PROJECT_PRIORITY_LABELS } from "./project-badges";
import { formatBrandOptionLabel } from "@/constants/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "@/components/ui/toast";

interface ProjectCreateDialogProps {
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
  currentUserId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
  initialOpen?: boolean;
}

export function ProjectCreateDialog({
  brands,
  smsUsers,
  isAdmin,
  currentUserId,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
  initialOpen = false,
}: ProjectCreateDialogProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [internalOpen, setInternalOpen] = React.useState(initialOpen || searchParams.get("create") === "true");
  const [serverError, setServerError] = React.useState<string | null>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (newOpen: boolean) => {
    if (isControlled) {
      controlledOnOpenChange?.(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
    if (!newOpen) {
      setServerError(null);
    }
  };

  // Default dates: today and +14 days
  const todayStr = React.useMemo(() => new Date().toISOString().split("T")[0], []);
  const defaultDeadlineStr = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0];
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectFormData>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      brand_id: brands.length > 0 ? brands[0].id : "",
      name: "",
      description: "",
      priority: "MEDIUM",
      start_date: todayStr,
      deadline: defaultDeadlineStr,
      sms_owner_id: isAdmin ? (smsUsers.length > 0 ? smsUsers[0].id : currentUserId) : currentUserId,
    },
  });

  const selectedBrandId = useWatch({ control, name: "brand_id" });
  const selectedPriority = useWatch({ control, name: "priority" });
  const selectedSmsOwnerId = useWatch({ control, name: "sms_owner_id" });
  const selectedStartDate = useWatch({ control, name: "start_date" });
  const selectedDeadline = useWatch({ control, name: "deadline" });

  const selectedBrandLabel = React.useMemo(() => {
    if (!selectedBrandId || selectedBrandId === "NONE") return "Pilih brand klien...";
    const found = brands.find((b) => b.id === selectedBrandId);
    return found ? formatBrandOptionLabel(found) : "Data tidak tersedia";
  }, [selectedBrandId, brands]);

  const selectedPriorityLabel = selectedPriority
    ? PROJECT_PRIORITY_LABELS[selectedPriority] || selectedPriority
    : "Pilih prioritas...";

  const selectedSmsOwnerLabel = React.useMemo(() => {
    if (!selectedSmsOwnerId || selectedSmsOwnerId === "NONE") return "Pilih SMS owner...";
    const found = smsUsers.find((u) => u.id === selectedSmsOwnerId);
    return found ? `${found.full_name} (${found.email})` : "Data tidak tersedia";
  }, [selectedSmsOwnerId, smsUsers]);

  const onSubmit = async (data: CreateProjectFormData) => {
    setServerError(null);
    try {
      const res = await createProjectAction(data);
      if (!res.success || !res.data) {
        const errorMsg = res.error || "Gagal membuat project baru. Silakan coba lagi.";
        setServerError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      toast.success("Project baru berhasil dibuat.");
      reset();
      setOpen(false);
      router.push(`/projects/${res.data.id}`);
      router.refresh();
    } catch {
      const errorMsg = "Terjadi kesalahan sistem saat memproses pembuatan project.";
      setServerError(errorMsg);
      toast.error(errorMsg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button size="sm" className="gap-1.5 h-8 text-xs shrink-0">
              <Plus className="size-3.5" />
              <span>Buat Project</span>
            </Button>
          )
        }
      />

      <DialogContent className="sm:max-w-2xl max-h-[calc(100dvh-3.5rem)] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-6 py-5 border-b border-border/80 bg-card shrink-0">
          <div className="flex items-center gap-3 pr-6">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <FolderPlus className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground tracking-tight">
                Buat Project Baru
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Inisiasi project baru dengan kode penomoran otomatis berbasis brand klien.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {serverError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive font-medium"
              >
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{serverError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Brand Selection */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="dialog-brand-select" className="text-xs font-medium">
                  Brand Klien <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedBrandId || "NONE"}
                  onValueChange={(val) => {
                    setValue("brand_id", !val || val === "NONE" ? "" : val, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }}
                  disabled={isSubmitting || brands.length === 0}
                >
                  <SelectTrigger id="dialog-brand-select" className="text-xs h-9 w-full">
                    <SelectValue placeholder="Pilih brand klien...">
                      {selectedBrandLabel}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {brands.length === 0 ? (
                      <SelectItem value="NONE">Belum ada brand terdaftar...</SelectItem>
                    ) : (
                      brands.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {formatBrandOptionLabel(b)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Nomor kode unik project akan di-generate otomatis berdasarkan kode brand.
                </p>
                {errors.brand_id && (
                  <p className="text-[11px] text-destructive font-medium">
                    {errors.brand_id.message}
                  </p>
                )}
              </div>

              {/* Project Name */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="dialog-project-name" className="text-xs font-medium">
                  Nama Project <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="dialog-project-name"
                  type="text"
                  placeholder="Contoh: Kampanye Ramadan 2026 (Video Reels Series)"
                  disabled={isSubmitting}
                  className="text-xs h-9"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-[11px] text-destructive font-medium">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <Label htmlFor="dialog-priority-select" className="text-xs font-medium">
                  Prioritas <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedPriority || "MEDIUM"}
                  onValueChange={(val) => {
                    if (val) {
                      setValue("priority", val as CreateProjectFormData["priority"], {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="dialog-priority-select" className="text-xs h-9 w-full">
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
                {errors.priority && (
                  <p className="text-[11px] text-destructive font-medium">
                    {errors.priority.message}
                  </p>
                )}
              </div>

              {/* SMS Owner Selection */}
              {isAdmin ? (
                <div className="space-y-1.5">
                  <Label htmlFor="dialog-sms-owner-select" className="text-xs font-medium">
                    Penanggung Jawab (SMS Owner) <span className="text-destructive">*</span>
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
                    <SelectTrigger id="dialog-sms-owner-select" className="text-xs h-9 w-full">
                      <SelectValue placeholder="Pilih SMS owner...">
                        {selectedSmsOwnerLabel}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {smsUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name} ({u.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.sms_owner_id && (
                    <p className="text-[11px] text-destructive font-medium">
                      {errors.sms_owner_id.message}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Penanggung Jawab (SMS Owner)
                  </Label>
                  <div className="flex h-9 w-full items-center rounded-md border border-border/80 bg-muted/40 px-3 text-xs text-foreground font-medium">
                    Anda (Social Media Specialist)
                  </div>
                </div>
              )}

              {/* Start Date */}
              <div className="space-y-1.5">
                <Label htmlFor="dialog-start-date" className="text-xs font-medium">
                  Tanggal Mulai <span className="text-destructive">*</span>
                </Label>
                <DatePicker
                  id="dialog-start-date"
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

              {/* Deadline */}
              <div className="space-y-1.5">
                <Label htmlFor="dialog-deadline" className="text-xs font-medium">
                  Batas Akhir (Deadline) <span className="text-destructive">*</span>
                </Label>
                <DatePicker
                  id="dialog-deadline"
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

              {/* Description */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="dialog-description" className="text-xs font-medium">
                  Deskripsi & Catatan Project
                </Label>
                <textarea
                  id="dialog-description"
                  rows={3}
                  placeholder="Catatan ruang lingkup project, target audiens, atau arahan awal..."
                  disabled={isSubmitting}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-2xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  {...register("description")}
                />
                {errors.description && (
                  <p className="text-[11px] text-destructive font-medium">
                    {errors.description.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Dialog Footer - Generous padding with ample bottom space */}
          <DialogFooter className="px-6 py-4.5 sm:py-5 border-t border-border bg-muted/20 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 shrink-0 mt-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => setOpen(false)}
              className="h-8 text-xs"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || brands.length === 0}
              className="h-8 text-xs gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Buat Project</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
