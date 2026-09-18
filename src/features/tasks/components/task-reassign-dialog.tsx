"use client";

import * as React from "react";
import { reassignTaskAction } from "../actions";
import type { TaskWithRelations } from "../types";
import { AlertCircle, ArrowRight, Loader2, UserCheck } from "lucide-react";
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
import { formatUserWithRole } from "@/constants/labels";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

interface TaskReassignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskWithRelations | null;
  projectId: string;
  availableAssignees?: Array<{
    id: string;
    full_name: string;
    email: string;
    role: string;
  }>;
  onSuccess?: () => void;
}

export function TaskReassignDialog({
  open,
  onOpenChange,
  task,
  projectId,
  availableAssignees = [],
  onSuccess,
}: TaskReassignDialogProps) {
  const [selectedAssigneeId, setSelectedAssigneeId] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  // When dialog opens, always require explicit selection (never auto-select current or any PIC)
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setSelectedAssigneeId("");
      setServerError(null);
    } else {
      setSelectedAssigneeId("");
      setServerError(null);
    }
  }

  const handleClose = React.useCallback(() => {
    if (isSubmitting) return;
    setServerError(null);
    setSelectedAssigneeId("");
    onOpenChange(false);
  }, [isSubmitting, onOpenChange]);

  const isAlreadyAssigned = Boolean(task?.current_assignee_id);

  // Exclude current PIC from candidates to prevent re-selecting the same person
  const eligibleCandidates = React.useMemo(() => {
    if (!task) return [];
    if (task.current_assignee_id) {
      return availableAssignees.filter((u) => u.id !== task.current_assignee_id);
    }
    return availableAssignees;
  }, [availableAssignees, task]);

  const selectedCandidate = React.useMemo(() => {
    if (!selectedAssigneeId || selectedAssigneeId === "NONE") return null;
    return eligibleCandidates.find((u) => u.id === selectedAssigneeId) || null;
  }, [selectedAssigneeId, eligibleCandidates]);

  const selectedAssigneeLabel = React.useMemo(() => {
    if (!selectedCandidate) {
      return isAlreadyAssigned ? "Pilih PIC pengganti..." : "Pilih anggota tim...";
    }
    return formatUserWithRole(selectedCandidate);
  }, [selectedCandidate, isAlreadyAssigned]);

  const isCandidateValid = Boolean(
    selectedAssigneeId &&
    selectedAssigneeId !== "NONE" &&
    selectedAssigneeId !== task?.current_assignee_id &&
    eligibleCandidates.some((c) => c.id === selectedAssigneeId)
  );

  if (!task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCandidateValid || !selectedCandidate) {
      setServerError("Pilih anggota tim PIC pengganti yang valid.");
      return;
    }

    setIsSubmitting(true);
    setServerError(null);

    const res = await reassignTaskAction(
      task.id,
      projectId,
      selectedAssigneeId,
      task.current_assignee_id
    );

    if (!res.success) {
      const errorMsg = res.error || "Gagal mengalihkan PIC. Coba lagi.";
      setServerError(errorMsg);
      toast.error(errorMsg);
      setIsSubmitting(false);
      return;
    }

    const targetName = selectedCandidate.full_name;
    const successToast = isAlreadyAssigned
      ? `PIC berhasil dialihkan ke ${targetName}.`
      : `PIC berhasil ditugaskan ke ${targetName}.`;

    toast.success(successToast);
    setIsSubmitting(false);
    onOpenChange(false);
    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-xl md:max-w-2xl max-h-[calc(100dvh-3.5rem)] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl">
        {/* Header with generous spacing and calm breathing room */}
        <DialogHeader className="px-6 py-6 sm:px-8 sm:py-7 border-b border-border/60 bg-card shrink-0">
          <div className="flex items-start sm:items-center gap-4 sm:gap-4.5">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0 shadow-2xs">
              <UserCheck className="size-5.5" />
            </div>
            <div className="min-w-0 pr-6">
              <DialogTitle className="text-base sm:text-lg font-semibold text-foreground tracking-tight">
                {isAlreadyAssigned ? "Alihkan Penugasan PIC" : "Tugaskan PIC"}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
                {isAlreadyAssigned
                  ? "Pindahkan penanggung jawab tugas produksi ke anggota tim kreatif lain."
                  : "Tentukan anggota tim kreatif yang bertanggung jawab mengerjakan tugas ini."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-7 sm:px-8 sm:py-8 space-y-6 sm:space-y-7">
            {serverError && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl bg-destructive/10 p-4 text-destructive border border-destructive/20 text-xs sm:text-sm font-medium"
              >
                <AlertCircle className="size-4.5 shrink-0 mt-0.5" />
                <span>{serverError}</span>
              </div>
            )}

            {/* Spacious Summary Card: 2-Column Grid on Desktop, Stack on Mobile */}
            <div className="rounded-xl border border-border/70 bg-muted/30 p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="space-y-1.5 min-w-0">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                    Tugas
                  </span>
                  <p className="text-sm font-semibold text-foreground truncate" title={task.title}>
                    {task.title}
                  </p>
                </div>
                <div className="space-y-1.5 min-w-0">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                    PIC Saat Ini
                  </span>
                  <p className="text-sm font-medium text-foreground truncate" title={formatUserWithRole(task.current_assignee)}>
                    {formatUserWithRole(task.current_assignee)}
                  </p>
                </div>
              </div>

              {/* Compact Reassignment Preview after replacement selected */}
              {selectedCandidate && isAlreadyAssigned && (
                <div className="pt-3.5 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Alur Pengalihan:
                  </span>
                  <div className="inline-flex items-center gap-2 rounded-lg bg-background/80 px-3 py-1.5 border border-border/60 font-medium self-start sm:self-auto">
                    <span
                      className="text-muted-foreground truncate max-w-[130px] sm:max-w-[170px]"
                      title={task.current_assignee?.full_name || "Belum ada"}
                    >
                      {task.current_assignee?.full_name || "Belum ada"}
                    </span>
                    <ArrowRight className="size-3.5 text-muted-foreground shrink-0" />
                    <span
                      className="text-primary font-semibold truncate max-w-[130px] sm:max-w-[170px]"
                      title={selectedCandidate.full_name}
                    >
                      {selectedCandidate.full_name}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Target Assignee Field or Empty State Notice */}
            {eligibleCandidates.length === 0 ? (
              <div
                role="status"
                className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs sm:text-sm text-amber-700 dark:text-amber-400 font-medium"
              >
                <AlertCircle className="size-4.5 shrink-0 mt-0.5" />
                <span>Tidak ada anggota tim lain yang tersedia untuk dialihkan.</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                <Label htmlFor="reassign-user-select" className="text-xs sm:text-sm font-medium text-foreground block">
                  {isAlreadyAssigned ? "Pilih PIC Pengganti" : "Pilih Anggota Tim PIC"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedAssigneeId || "NONE"}
                  onValueChange={(val) => {
                    setSelectedAssigneeId(!val || val === "NONE" ? "" : val);
                    if (serverError) setServerError(null);
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="reassign-user-select" className="text-xs sm:text-sm h-11 px-3.5 w-full rounded-lg border-border/80 bg-background shadow-2xs hover:bg-accent/40 transition-colors">
                    <SelectValue placeholder={isAlreadyAssigned ? "Pilih PIC pengganti..." : "Pilih anggota tim..."}>
                      {selectedAssigneeLabel}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">
                      {isAlreadyAssigned ? "Pilih PIC pengganti..." : "Pilih anggota tim..."}
                    </SelectItem>
                    {eligibleCandidates.map((user) => (
                      <SelectItem key={user.id} value={user.id} className="py-2.5 text-xs sm:text-sm">
                        {formatUserWithRole(user)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground/80 pt-0.5 leading-relaxed">
                  Riwayat perpindahan PIC akan tercatat otomatis pada aktivitas proyek.
                </p>
              </div>
            )}
          </div>

          {/* Generous Dialog Footer with proper padding and button gaps */}
          <DialogFooter className="px-6 py-5 sm:px-8 sm:py-6 border-t border-border/70 bg-muted/20 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 shrink-0 mt-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto h-10 px-5 text-xs sm:text-sm font-medium"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !isCandidateValid}
              className="w-full sm:w-auto h-10 px-5 text-xs sm:text-sm font-medium shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  <span>{isAlreadyAssigned ? "Mengalihkan..." : "Menugaskan..."}</span>
                </>
              ) : (
                <span>{isAlreadyAssigned ? "Konfirmasi Alihkan" : "Tugaskan PIC"}</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
