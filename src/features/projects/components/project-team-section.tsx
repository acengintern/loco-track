"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2, ShieldCheck, Users, AlertCircle, Loader2 } from "lucide-react";
import type { ProjectMemberDetail } from "../types";
import { ROLE_LABELS } from "@/constants/navigation";
import { formatUserWithRole } from "@/constants/labels";
import { addProjectMemberAction, removeProjectMemberAction } from "../actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface ProjectTeamSectionProps {
  projectId: string;
  smsOwnerId: string;
  members: ProjectMemberDetail[];
  availableUsers: Array<{
    id: string;
    full_name: string;
    email: string;
    role: keyof typeof ROLE_LABELS;
  }>;
  canManageTeam: boolean;
}

export function ProjectTeamSection({
  projectId,
  smsOwnerId,
  members,
  availableUsers,
  canManageTeam,
}: ProjectTeamSectionProps) {
  const router = useRouter();
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [selectedUserId, setSelectedUserId] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = React.useState<{ id: string; name: string } | null>(null);
  const [removeError, setRemoveError] = React.useState<string | null>(null);

  // Exclude users who are already members of this project
  const eligibleUsers = React.useMemo(() => {
    const existingMemberIds = new Set(members.map((m) => m.user_id));
    return availableUsers.filter((u) => !existingMemberIds.has(u.id));
  }, [availableUsers, members]);

  const [prevAddOpen, setPrevAddOpen] = React.useState(isAddOpen);
  if (prevAddOpen !== isAddOpen) {
    setPrevAddOpen(isAddOpen);
    if (isAddOpen) {
      setSelectedUserId("");
      setErrorMessage(null);
    }
  }

  const selectedUser = React.useMemo(() => {
    if (!selectedUserId || selectedUserId === "NONE") return null;
    return eligibleUsers.find((u) => u.id === selectedUserId) || null;
  }, [selectedUserId, eligibleUsers]);

  const selectedUserLabel = React.useMemo(() => {
    if (!selectedUser) return "Pilih anggota tim...";
    return formatUserWithRole(selectedUser);
  }, [selectedUser]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || selectedUserId === "NONE" || !selectedUser) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await addProjectMemberAction({
        project_id: projectId,
        user_id: selectedUserId,
      });

      if (!res.success) {
        const errorMsg = res.error || "Gagal menambahkan anggota tim. Coba lagi.";
        setErrorMessage(errorMsg);
        toast.error(errorMsg);
        setIsSubmitting(false);
        return;
      }

      toast.success(`Anggota tim ${selectedUser.full_name} berhasil ditambahkan.`);
      setIsAddOpen(false);
      router.refresh();
    } catch {
      const errorMsg = "Terjadi kesalahan teknis saat menambahkan anggota.";
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!memberToRemove) return;
    if (memberToRemove.id === smsOwnerId) {
      const errorMsg = "Penanggung jawab project (SMS) tidak dapat dihapus dari roster.";
      setRemoveError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    setIsSubmitting(true);
    setRemoveError(null);

    try {
      const res = await removeProjectMemberAction(projectId, memberToRemove.id);
      if (!res.success) {
        const errorMsg = res.error || "Gagal menghapus anggota tim. Coba lagi.";
        setRemoveError(errorMsg);
        toast.error(errorMsg);
        setIsSubmitting(false);
        return;
      }
      toast.success("Anggota tim berhasil dihapus.");
      setMemberToRemove(null);
      router.refresh();
    } catch {
      const errorMsg = "Terjadi kesalahan teknis saat menghapus anggota tim.";
      setRemoveError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6 sm:p-7 space-y-5 shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Users className="size-5 text-muted-foreground" />
          <h2 className="text-base sm:text-lg font-semibold text-foreground">
            Anggota Tim Proyek ({members.length})
          </h2>
        </div>

        {canManageTeam && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-sm h-10 px-4 gap-2"
            onClick={() => {
              setErrorMessage(null);
              setIsAddOpen(true);
            }}
            disabled={availableUsers.length === 0}
          >
            <UserPlus className="size-4" />
            <span>Tambah Anggota</span>
          </Button>
        )}
      </div>

      {removeError && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive font-medium"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{removeError}</span>
        </div>
      )}

      {members.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Belum ada anggota tim terdaftar selain sistem pemilik.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => {
            const isOwner = member.user_id === smsOwnerId;

            return (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-3.5 sm:p-4 text-sm shadow-2xs"
              >
                <div className="space-y-1 min-w-0 pr-2">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground text-sm sm:text-[15px] truncate">
                    <span className="truncate">{member.user.full_name}</span>
                    {isOwner && (
                      <span
                        title="Penanggung Jawab Utama (SMS Owner)"
                        className="inline-flex items-center text-primary"
                      >
                        <ShieldCheck className="size-4" />
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate font-medium">
                    {ROLE_LABELS[member.user.role] || member.user.role}
                  </div>
                </div>

                {canManageTeam && !isOwner && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Hapus ${member.user.full_name} dari roster`}
                          onClick={() => {
                            setRemoveError(null);
                            setMemberToRemove({
                              id: member.user_id,
                              name: member.user.full_name,
                            });
                          }}
                          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      }
                    />
                    <TooltipContent side="top">
                      Hapus dari tim project
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Member Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[calc(100dvh-3.5rem)] flex flex-col p-0 gap-0 overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xl">
          <DialogHeader className="px-6 py-5 border-b border-border/70 bg-card shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                <UserPlus className="size-4.5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm font-semibold text-foreground">
                  Tambah Anggota Tim
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Tugaskan staf kreatif atau kolaborator ke dalam project ini untuk memberikan hak akses kerja.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleAddMember} className="flex flex-col">
            <div className="px-6 py-5 space-y-4 text-xs">
              {errorMessage && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive font-medium"
                >
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {eligibleUsers.length === 0 ? (
                <div
                  role="status"
                  className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400 font-medium"
                >
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>Seluruh anggota tim yang tersedia sudah terdaftar pada project ini.</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="select-member-user" className="text-xs font-medium text-foreground">
                    Pilih Anggota Tim <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={selectedUserId || "NONE"}
                    onValueChange={(val) => {
                      setSelectedUserId(!val || val === "NONE" ? "" : val);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="select-member-user" className="text-xs h-9 w-full">
                      <SelectValue placeholder="Pilih anggota tim...">
                        {selectedUserLabel}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Pilih anggota tim...</SelectItem>
                      {eligibleUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {formatUserWithRole(u)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Anggota tim yang ditambahkan akan dapat mengakses tugas dan deliverable project.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="px-6 py-4.5 sm:py-5 border-t border-border/70 bg-muted/20 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 shrink-0 mt-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSubmitting}
                onClick={() => setIsAddOpen(false)}
                className="w-full sm:w-auto h-9 text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !selectedUserId || selectedUserId === "NONE" || eligibleUsers.length === 0}
                className="w-full sm:w-auto h-9 text-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    <span>Menambahkan...</span>
                  </>
                ) : (
                  "Tambah ke Project"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Alert Dialog for Removing Member */}
      <AlertDialog
        open={Boolean(memberToRemove)}
        onOpenChange={(open) => {
          if (!open) setMemberToRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">
              Hapus Anggota Tim?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Apakah Anda yakin ingin menghapus {memberToRemove?.name} dari keanggotaan project ini? Staf tidak akan lagi memiliki hak akses langsung ke tugas-tugas dalam project ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? "Menghapus..." : "Hapus Anggota"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
