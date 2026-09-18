"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { startProductionAction } from "../actions";
import type { TaskWithRelations } from "../types";
import { AlertCircle, ArrowRight, CheckCircle2, Film, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

interface ProductionReadinessPanelProps {
  projectId: string;
  projectStatus: string;
  projectDeadline: string;
  tasks: TaskWithRelations[];
  canManage: boolean;
  onSuccess?: () => void;
}

export function ProductionReadinessPanel({
  projectId,
  projectStatus,
  projectDeadline,
  tasks,
  canManage,
  onSuccess,
}: ProductionReadinessPanelProps) {
  const router = useRouter();
  const [isStarting, setIsStarting] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);

  if (projectStatus !== "SCRIPT_READY" || !canManage) {
    return null;
  }

  const productionTasks = tasks.filter(
    (t) => t.task_type === "GRAPHIC_DESIGN" || t.task_type === "VIDEO_EDITING"
  );
  const assignedProdTasks = productionTasks.filter((t) => !!t.current_assignee_id);
  const unassignedProdTasks = productionTasks.filter((t) => !t.current_assignee_id);

  // Validate deadlines
  const projDeadlineMs = new Date(projectDeadline).getTime();
  const hasInvalidDeadlines = tasks.some(
    (t) => new Date(t.deadline).getTime() > projDeadlineMs
  );

  const hasMinimumProdTask = productionTasks.length > 0;
  const allProdTasksAssigned =
    hasMinimumProdTask && unassignedProdTasks.length === 0;
  const canStartProduction =
    hasMinimumProdTask && allProdTasksAssigned && !hasInvalidDeadlines;

  const handleStartProduction = async () => {
    setActionError(null);
    setIsStarting(true);

    const res = await startProductionAction(projectId);

    if (!res.success) {
      const msg = res.error || "Gagal memulai tahap produksi.";
      setActionError(msg);
      toast.error(msg);
      setIsStarting(false);
      return;
    }

    toast.success("Tahap produksi berhasil dimulai.");
    setIsStarting(false);
    setIsConfirmOpen(false);
    router.refresh();
    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Film className="size-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Kesiapan Memulai Produksi
          </h3>
        </div>
        <span className="text-[11px] text-muted-foreground">
          Batas Akhir Proyek:{" "}
          <strong className="text-foreground">
            {new Date(projectDeadline).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </strong>
        </span>
      </div>

      {actionError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive border border-destructive/20 font-medium"
        >
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Checklist items */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Requirement 1: Minimal 1 task */}
        <div
          className={`p-3 rounded-md border text-xs flex items-start gap-2.5 transition-colors ${
            hasMinimumProdTask
              ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
              : "border-border bg-muted/20 text-muted-foreground"
          }`}
        >
          <CheckCircle2
            className={`size-4 shrink-0 mt-0.5 ${
              hasMinimumProdTask ? "text-emerald-500" : "text-muted-foreground"
            }`}
          />
          <div>
            <div className="font-semibold">Tugas Produksi Terdaftar</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {hasMinimumProdTask
                ? `${productionTasks.length} tugas dibuat (Desain/Video)`
                : "Belum ada tugas desain atau video"}
            </div>
          </div>
        </div>

        {/* Requirement 2: Assigned PIC */}
        <div
          className={`p-3 rounded-md border text-xs flex items-start gap-2.5 transition-colors ${
            allProdTasksAssigned
              ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
              : "border-border bg-muted/20 text-muted-foreground"
          }`}
        >
          <CheckCircle2
            className={`size-4 shrink-0 mt-0.5 ${
              allProdTasksAssigned ? "text-emerald-500" : "text-muted-foreground"
            }`}
          />
          <div>
            <div className="font-semibold">Penugasan PIC Lengkap</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {allProdTasksAssigned
                ? `Semua tugas (${assignedProdTasks.length}) memiliki PIC`
                : `${unassignedProdTasks.length} tugas belum ditugaskan ke anggota`}
            </div>
          </div>
        </div>

        {/* Requirement 3: Deadline valid */}
        <div
          className={`p-3 rounded-md border text-xs flex items-start gap-2.5 transition-colors ${
            !hasInvalidDeadlines
              ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          }`}
        >
          <CheckCircle2
            className={`size-4 shrink-0 mt-0.5 ${
              !hasInvalidDeadlines ? "text-emerald-500" : "text-destructive"
            }`}
          />
          <div>
            <div className="font-semibold">Batas Waktu Valid</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {!hasInvalidDeadlines
                ? "Semua deadline tugas berada dalam rentang proyek"
                : "Ada deadline tugas yang melampaui deadline proyek"}
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border">
        <div className="text-xs text-muted-foreground">
          {!canStartProduction ? (
            <div className="space-y-0.5 text-amber-600 dark:text-amber-400 font-medium">
              <span>Syarat masuk tahap produksi belum terpenuhi:</span>
              <ul className="list-disc list-inside text-[11px] text-muted-foreground font-normal">
                {!hasMinimumProdTask && (
                  <li>Buat minimal 1 tugas produksi (Desain Grafis atau Video Editing)</li>
                )}
                {unassignedProdTasks.length > 0 && (
                  <li>Semua tugas produksi harus memiliki PIC sebelum produksi dimulai</li>
                )}
                {hasInvalidDeadlines && (
                  <li>Batas waktu tugas tidak boleh melampaui batas akhir proyek</li>
                )}
              </ul>
            </div>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              Seluruh syarat terpenuhi. Proyek siap memasuki tahap pengerjaan produksi.
            </span>
          )}
        </div>

        <Button
          type="button"
          onClick={() => setIsConfirmOpen(true)}
          disabled={!canStartProduction || isStarting}
          size="sm"
          className="shrink-0 gap-1.5"
        >
          {isStarting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="size-3.5" />
          )}
          <span>Mulai Tahap Produksi</span>
          <ArrowRight className="size-3.5" />
        </Button>
      </div>

      {/* Confirmation Alert Dialog */}
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">
              Mulai Tahap Produksi?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Setelah produksi dimulai, dokumen perencanaan (Brief, Content Plan, Script) akan terkunci dan hanya dapat diubah melalui revisi khusus. Lanjutkan memulai tahap produksi?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isStarting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStartProduction}
              disabled={isStarting}
            >
              {isStarting ? "Memulai..." : "Ya, Mulai Produksi"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
