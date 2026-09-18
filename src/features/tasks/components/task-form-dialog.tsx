"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  taskFormSchema,
  type TaskFormInput,
  type TaskCreateInput,
  type TaskUpdateInput,
} from "../schemas";
import { createProductionTaskAction, updateTaskMetadataAction } from "../actions";
import type { TaskWithRelations, PriorityLevel } from "../types";
import {
  TASK_TYPE_LABELS,
  PRIORITY_LABELS,
  formatContentPlanLabel,
  formatScriptLabel,
  formatUserWithRole,
} from "@/constants/labels";
import { AlertCircle, CheckSquare, Loader2, Calendar, ShieldAlert, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { toast } from "@/components/ui/toast";

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectDeadline: string;
  initialData?: TaskWithRelations | null;
  availableAssignees?: Array<{
    id: string;
    full_name: string;
    email: string;
    role: string;
  }>;
  availableContentPlans?: Array<{
    id: string;
    title: string;
    channel: string;
  }>;
  availableScripts?: Array<{
    id: string;
    title: string;
    status: string;
  }>;
  onSuccess?: () => void;
}

export function TaskFormDialog({
  open,
  onOpenChange,
  projectId,
  projectDeadline,
  initialData,
  availableAssignees = [],
  availableContentPlans = [],
  availableScripts = [],
  onSuccess,
}: TaskFormDialogProps) {
  const [serverError, setServerError] = React.useState<string | null>(null);
  const isEditing = !!initialData;
  const isTypeLocked = isEditing && initialData?.status !== "TODO";

  const defaultTaskType: "GRAPHIC_DESIGN" | "VIDEO_EDITING" | "OTHER" =
    initialData?.task_type === "VIDEO_EDITING" || initialData?.task_type === "OTHER"
      ? initialData.task_type
      : "GRAPHIC_DESIGN";

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormInput>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: initialData?.title || "",
      task_type: defaultTaskType,
      priority: (initialData?.priority as PriorityLevel) || "MEDIUM",
      deadline: initialData?.deadline
        ? new Date(initialData.deadline).toISOString().slice(0, 16)
        : new Date(projectDeadline).toISOString().slice(0, 16),
      notes: initialData?.notes || "",
      content_plan_id: initialData?.content_plan_id || null,
      script_id: initialData?.script_id || null,
      assignee_id: initialData?.current_assignee_id || null,
    },
  });

  const selectedType = useWatch({ control, name: "task_type" }) || defaultTaskType;
  const selectedPriority = useWatch({ control, name: "priority" }) || "MEDIUM";
  const selectedDeadline = useWatch({ control, name: "deadline" });
  const selectedAssignee = useWatch({ control, name: "assignee_id" });
  const selectedContentPlan = useWatch({ control, name: "content_plan_id" });
  const selectedScript = useWatch({ control, name: "script_id" });

  const allAssignees = React.useMemo(() => {
    const map = new Map<string, { id: string; full_name: string; email?: string; role: string }>();
    availableAssignees.forEach((u) => map.set(u.id, u));
    if (initialData?.current_assignee) {
      if (!map.has(initialData.current_assignee.id)) {
        map.set(initialData.current_assignee.id, {
          id: initialData.current_assignee.id,
          full_name: initialData.current_assignee.full_name,
          email: initialData.current_assignee.email || "",
          role: initialData.current_assignee.role,
        });
      }
    }
    return Array.from(map.values());
  }, [availableAssignees, initialData]);

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

  const allScripts = React.useMemo(() => {
    const map = new Map<
      string,
      { id: string; title: string; status?: string; hook?: string | null }
    >();
    availableScripts.forEach((sc) => map.set(sc.id, sc));
    if (initialData?.script) {
      if (!map.has(initialData.script.id)) {
        map.set(initialData.script.id, {
          id: initialData.script.id,
          title: initialData.script.title,
          status: initialData.script.status,
        });
      }
    }
    return Array.from(map.values());
  }, [availableScripts, initialData]);

  const selectedTypeLabel = TASK_TYPE_LABELS[selectedType] || selectedType;

  const selectedAssigneeLabel = React.useMemo(() => {
    if (!selectedAssignee || selectedAssignee === "NONE") {
      return "Belum Ditugaskan";
    }
    const found = allAssignees.find((a) => a.id === selectedAssignee);
    return found ? formatUserWithRole(found) : "Data tidak tersedia";
  }, [selectedAssignee, allAssignees]);

  const selectedContentPlanLabel = React.useMemo(() => {
    if (!selectedContentPlan || selectedContentPlan === "NONE") {
      return "Belum Dipilih / Tidak Ditautkan";
    }
    const found = allContentPlans.find((cp) => cp.id === selectedContentPlan);
    return found ? formatContentPlanLabel(found) : "Data tidak tersedia";
  }, [selectedContentPlan, allContentPlans]);

  const selectedScriptLabel = React.useMemo(() => {
    if (!selectedScript || selectedScript === "NONE") {
      return "Belum Dipilih / Tidak Ditautkan";
    }
    const found = allScripts.find((sc) => sc.id === selectedScript);
    return found ? formatScriptLabel(found) : "Data tidak tersedia";
  }, [selectedScript, allScripts]);

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
      task_type: defaultTaskType,
      priority: (initialData?.priority as PriorityLevel) || "MEDIUM",
      deadline: initialData?.deadline
        ? new Date(initialData.deadline).toISOString().slice(0, 16)
        : new Date(projectDeadline).toISOString().slice(0, 16),
      notes: initialData?.notes || "",
      content_plan_id: initialData?.content_plan_id || null,
      script_id: initialData?.script_id || null,
      assignee_id: initialData?.current_assignee_id || null,
    });
  }, [initialData, projectDeadline, reset, open, defaultTaskType]);

  const handleClose = React.useCallback(() => {
    setServerError(null);
    onOpenChange(false);
  }, [onOpenChange]);

  const onSubmit = async (data: TaskFormInput) => {
    setServerError(null);

    // Validate deadline <= projectDeadline
    const taskDate = new Date(data.deadline);
    const projDate = new Date(projectDeadline);
    if (taskDate > projDate) {
      setServerError(
        `Batas waktu tugas tidak boleh melampaui batas akhir proyek (${projDate.toLocaleDateString("id-ID")}).`
      );
      return;
    }

    let res;
    if (isEditing && initialData) {
      const updateData: TaskUpdateInput = {
        title: data.title,
        priority: data.priority,
        deadline: new Date(data.deadline).toISOString(),
        notes: data.notes || "",
        content_plan_id: data.content_plan_id || null,
        script_id: data.script_id || null,
        task_type: isTypeLocked ? undefined : data.task_type,
      };
      res = await updateTaskMetadataAction(initialData.id, projectId, updateData);
    } else {
      const createData: TaskCreateInput = {
        ...data,
        deadline: new Date(data.deadline).toISOString(),
        content_plan_id: data.content_plan_id || null,
        script_id: data.script_id || null,
        assignee_id: data.assignee_id || null,
      };
      res = await createProductionTaskAction(projectId, createData);
    }

    if (!res.success) {
      const errorMsg = res.error || "Gagal menyimpan tugas produksi. Coba lagi.";
      setServerError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    toast.success(isEditing ? "Perubahan tugas berhasil disimpan." : "Tugas berhasil dibuat.");
    onOpenChange(false);
    if (onSuccess) {
      onSuccess();
    }
  };

  const formattedProjectDeadline = new Date(projectDeadline).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden rounded-xl shadow-2xl">
        {/* Dialog Header */}
        <DialogHeader className="px-6 sm:px-8 py-5 sm:py-6 border-b border-border/80 bg-card shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-8">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                <CheckSquare className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-semibold text-foreground tracking-tight">
                  {isEditing ? "Edit Metadata Tugas Produksi" : "Buat Tugas Produksi Baru"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Isi spesifikasi teknis pengerjaan konten, batas waktu, dan penugasan PIC.
                </DialogDescription>
              </div>
            </div>

            <Badge variant="outline" className="text-xs gap-1.5 py-1.5 px-3 font-normal self-start sm:self-auto shrink-0 bg-muted/40 border-border/80">
              <Calendar className="size-3.5 text-muted-foreground" />
              <span>Deadline Proyek: <strong className="font-semibold text-foreground">{formattedProjectDeadline}</strong></span>
            </Badge>
          </div>
        </DialogHeader>

        {/* Dialog Body with 2-Column Responsive Layout */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 sm:py-8 space-y-7">
            {serverError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg bg-destructive/10 p-3.5 text-xs text-destructive border border-destructive/20 font-medium"
              >
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{serverError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10 xl:gap-12 items-start">
              {/* Left Column: Task Overview & Specifications */}
              <div className="space-y-5 sm:space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="task-title" className="text-xs font-medium text-foreground">
                    Judul Tugas Produksi <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="task-title"
                    type="text"
                    className="h-10 text-xs px-3.5"
                    placeholder="Misal: Desain Feed Karusel 5 Slide Edukasi Skincare"
                    disabled={isSubmitting}
                    {...register("title")}
                  />
                  {errors.title && (
                    <p className="text-[11px] text-destructive font-medium">{errors.title.message}</p>
                  )}
                </div>

                {/* Task Type */}
                <div className="space-y-2">
                  <Label htmlFor="task-type-select" className="text-xs font-medium text-foreground">
                    Tipe Tugas Produksi <span className="text-destructive">*</span>
                  </Label>
                  {isTypeLocked ? (
                    <div className="rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground font-medium">
                      {TASK_TYPE_LABELS[selectedType] || selectedType}
                      <span className="block text-[11px] text-muted-foreground/70 mt-0.5">
                        (Tipe terkunci karena pengerjaan tugas telah dimulai)
                      </span>
                    </div>
                  ) : (
                    <Select
                      value={selectedType}
                      onValueChange={(val) => {
                        if (val) {
                          setValue(
                            "task_type",
                            val as "GRAPHIC_DESIGN" | "VIDEO_EDITING" | "OTHER",
                            { shouldValidate: true, shouldDirty: true }
                          );
                        }
                      }}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger id="task-type-select" className="text-xs h-10 px-3.5 w-full">
                        <SelectValue placeholder="Pilih tipe tugas...">
                          {selectedTypeLabel}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GRAPHIC_DESIGN">
                          Desain Grafis (QC Wajib)
                        </SelectItem>
                        <SelectItem value="VIDEO_EDITING">
                          Video Editing (QC Wajib)
                        </SelectItem>
                        <SelectItem value="OTHER">
                          Lainnya (QC Opsional)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <div className="pt-0.5">
                    {selectedType === "GRAPHIC_DESIGN" || selectedType === "VIDEO_EDITING" ? (
                      <div className="flex items-center gap-2 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-400 border border-amber-500/20">
                        <ShieldAlert className="size-3.5 text-amber-500 shrink-0" />
                        <span>Wajib lolos Internal Quality Control (QC) sebelum review klien.</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-[11px] text-muted-foreground border border-border/60">
                        <Sparkles className="size-3.5 text-muted-foreground shrink-0" />
                        <span>Tipe operasional umum, QC bersifat opsional.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Priority Selection */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-foreground">
                    Prioritas Pengerjaan <span className="text-destructive">*</span>
                  </Label>
                  <div className="grid grid-cols-4 gap-2.5">
                    {(["LOW", "MEDIUM", "HIGH", "URGENT"] as PriorityLevel[]).map((p) => {
                      const isSelected = selectedPriority === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => setValue("priority", p, { shouldDirty: true, shouldValidate: true })}
                          className={`rounded-lg px-2.5 py-2.5 text-xs font-medium border text-center transition-all outline-none cursor-pointer ${
                            isSelected
                              ? p === "URGENT"
                                ? "border-rose-500 bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold ring-1 ring-rose-500 shadow-2xs"
                                : p === "HIGH"
                                ? "border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold ring-1 ring-amber-500 shadow-2xs"
                                : "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary shadow-2xs"
                              : "border-input bg-background text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                          }`}
                        >
                          {PRIORITY_LABELS[p]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Notes / Technical Specs */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="task-notes" className="text-xs font-medium text-foreground">
                      Instruksi & Catatan Tambahan
                    </Label>
                    <span className="text-[11px] text-muted-foreground">Opsional</span>
                  </div>
                  <textarea
                    id="task-notes"
                    rows={5}
                    disabled={isSubmitting}
                    className="w-full min-h-[140px] rounded-lg border border-input bg-background px-3.5 py-3 text-xs text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 leading-relaxed transition-colors resize-y"
                    placeholder="Tuliskan spesifikasi teknis pengerjaan, rasio kanvas, referensi palet, atau instruksi revisi..."
                    {...register("notes")}
                  />
                </div>
              </div>

              {/* Right Column: Assignment, Schedule, and Linked Assets */}
              <div className="space-y-5 sm:space-y-6">
                {/* Assignee Selection (Creation or when unassigned) */}
                {!isEditing ? (
                  <div className="space-y-2">
                    <Label htmlFor="task-assignee-select" className="text-xs font-medium text-foreground">
                      Penanggung Jawab PIC Kreatif
                    </Label>
                    <Select
                      value={selectedAssignee || "NONE"}
                      onValueChange={(val) => {
                        setValue("assignee_id", val === "NONE" ? null : val, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger id="task-assignee-select" className="text-xs h-10 px-3.5 w-full">
                        <SelectValue placeholder="Pilih anggota tim PIC...">
                          {selectedAssigneeLabel}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">Belum Ditugaskan</SelectItem>
                        {allAssignees.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {formatUserWithRole(user)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Menugaskan PIC otomatis mendaftarkan anggota ke roster tim proyek ini.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-foreground">Penanggung Jawab PIC Saat Ini</Label>
                    <div className="flex h-10 items-center rounded-lg border border-border/80 bg-muted/30 px-3.5 text-xs text-foreground">
                      {formatUserWithRole(initialData?.current_assignee)}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Untuk mengalihkan tugas yang sudah berjalan, gunakan tombol alihkan penugasan pada daftar tugas.
                    </p>
                  </div>
                )}

                {/* Deadline Picker */}
                <div className="space-y-2">
                  <Label htmlFor="task-deadline-picker" className="text-xs font-medium text-foreground">
                    Batas Waktu Tugas (Deadline) <span className="text-destructive">*</span>
                  </Label>
                  <DateTimePicker
                    id="task-deadline-picker"
                    value={selectedDeadline}
                    onChange={(val) => {
                      setValue("deadline", val, { shouldDirty: true, shouldValidate: true });
                    }}
                    max={new Date(projectDeadline).toISOString().slice(0, 16)}
                    disabled={isSubmitting}
                    className="h-10 text-xs px-3.5"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Batas waktu tidak boleh melebihi deadline proyek ({formattedProjectDeadline}).
                  </p>
                  {errors.deadline && (
                    <p className="text-[11px] text-destructive font-medium">{errors.deadline.message}</p>
                  )}
                </div>

                {/* Linked Content Plan */}
                <div className="space-y-2">
                  <Label htmlFor="task-content-plan-select" className="text-xs font-medium text-foreground">
                    Tautkan Rencana Konten (Content Plan)
                  </Label>
                  <Select
                    value={selectedContentPlan || "NONE"}
                    onValueChange={(val) => {
                      setValue("content_plan_id", val === "NONE" ? null : val, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="task-content-plan-select" className="text-xs h-10 px-3.5 w-full">
                      <SelectValue placeholder="Pilih rencana konten...">
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
                  <p className="text-[11px] text-muted-foreground">
                    Menghubungkan tugas dengan kalender editorial konten brand.
                  </p>
                </div>

                {/* Linked Script */}
                <div className="space-y-2">
                  <Label htmlFor="task-script-select" className="text-xs font-medium text-foreground">
                    Tautkan Naskah (Script)
                  </Label>
                  <Select
                    value={selectedScript || "NONE"}
                    onValueChange={(val) => {
                      setValue("script_id", val === "NONE" ? null : val, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="task-script-select" className="text-xs h-10 px-3.5 w-full">
                      <SelectValue placeholder="Pilih naskah konten...">
                        {selectedScriptLabel}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Belum Dipilih / Tidak Ditautkan</SelectItem>
                      {allScripts.map((sc) => (
                        <SelectItem key={sc.id} value={sc.id}>
                          {formatScriptLabel(sc)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Pilih naskah berstatus READY agar desainer atau editor dapat langsung memulai eksekusi.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Dialog Footer */}
          <DialogFooter className="m-0 px-6 sm:px-8 py-4.5 sm:py-5 border-t border-border/80 bg-muted/20 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
            {/* Left Operational Context Indicator */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500/80 shrink-0" />
              <span>Spesifikasi tugas tersinkronisasi otomatis ke linimasa proyek.</span>
            </div>

            {/* Right Action Buttons */}
            <div className="flex items-center justify-end gap-3.5 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
                className="h-10 px-5 text-xs font-medium border-border/80 hover:bg-accent transition-colors w-full sm:w-auto"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-10 px-6 text-xs font-medium shadow-2xs transition-all w-full sm:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>{isEditing ? "Simpan Perubahan" : "Buat Tugas Produksi"}</span>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
