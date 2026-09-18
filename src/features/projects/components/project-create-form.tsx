"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "@/components/ui/toast";

interface ProjectCreateFormProps {
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
}

export function ProjectCreateForm({
  brands,
  smsUsers,
  isAdmin,
  currentUserId,
}: ProjectCreateFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);

  // Default dates: today and +14 days
  const todayStr = new Date().toISOString().split("T")[0];
  const defaultDeadlineDate = new Date();
  defaultDeadlineDate.setDate(defaultDeadlineDate.getDate() + 14);
  const defaultDeadlineStr = defaultDeadlineDate.toISOString().split("T")[0];

  const {
    register,
    handleSubmit,
    setValue,
    control,
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
        const errorMsg = res.error || "Gagal membuat project baru. Coba lagi.";
        setServerError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      toast.success("Project berhasil dibuat.");
      router.push(`/projects/${res.data.id}`);
      router.refresh();
    } catch {
      const errorMsg = "Terjadi kesalahan sistem saat memproses pembuatan project.";
      setServerError(errorMsg);
      toast.error(errorMsg);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-2xs">
      {serverError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive font-medium mb-6"
        >
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Brand Selection */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="brand-select" className="text-xs font-medium">
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
              <SelectTrigger id="brand-select" className="text-xs h-9 w-full">
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
            <p className="text-[10px] text-muted-foreground">
              Nomor kode unik project akan di-generate otomatis berdasarkan kode brand yang dipilih.
            </p>
            {errors.brand_id && (
              <p className="text-[11px] text-destructive font-medium">
                {errors.brand_id.message}
              </p>
            )}
          </div>

          {/* Project Name */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="project-name" className="text-xs font-medium">
              Nama Project <span className="text-destructive">*</span>
            </Label>
            <Input
              id="project-name"
              type="text"
              placeholder="Contoh: Kampanye Ramadan 2026 (Video Reels Series)"
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

          {/* Priority */}
          <div className="space-y-1.5">
            <Label htmlFor="priority-select" className="text-xs font-medium">
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
              <SelectTrigger id="priority-select" className="text-xs h-9 w-full">
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

          {/* SMS Owner Selection (Admin only) */}
          {isAdmin ? (
            <div className="space-y-1.5">
              <Label htmlFor="sms-owner-select" className="text-xs font-medium">
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
                <SelectTrigger id="sms-owner-select" className="text-xs h-9 w-full">
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
            <Label htmlFor="start-date-picker" className="text-xs font-medium">
              Tanggal Mulai <span className="text-destructive">*</span>
            </Label>
            <DatePicker
              id="start-date-picker"
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
            <Label htmlFor="deadline-picker" className="text-xs font-medium">
              Tanggal Batas Akhir (Deadline) <span className="text-destructive">*</span>
            </Label>
            <DatePicker
              id="deadline-picker"
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
            <Label htmlFor="description" className="text-xs font-medium">
              Deskripsi & Catatan Project
            </Label>
            <textarea
              id="description"
              rows={3}
              placeholder="Catatan ruang lingkup project, target audiens, atau arahan awal..."
              disabled={isSubmitting}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-2xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              {...register("description")}
            />
            {errors.description && (
              <p className="text-[11px] text-destructive font-medium">
                {errors.description.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border/60 pt-4">
          <Button
            nativeButton={false}
            type="button"
            variant="outline"
            size="sm"
            disabled={isSubmitting}
            render={<Link href="/projects" />}
          >
            Batal
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || brands.length === 0}
          >
            {isSubmitting ? "Menyimpan Project..." : "Buat Project"}
          </Button>
        </div>
      </form>
    </div>
  );
}
