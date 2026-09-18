"use client";

import * as React from "react";
import type { TaskWithRelations, TaskStatus, TaskType, PriorityLevel } from "../types";
import {
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
  PRIORITY_LABELS,
  formatContentPlanLabel,
  formatScriptLabel,
} from "@/constants/labels";
import {
  TaskStatusBadge,
  TaskTypeBadge,
  TaskPriorityBadge,
  DeadlineBadge,
} from "./task-badges";
import { TaskFormDialog } from "./task-form-dialog";
import { TaskReassignDialog } from "./task-reassign-dialog";
import { TaskStatusControl } from "./task-status-control";
import { TaskKanbanBoard } from "./task-kanban-board";
import { TaskDeliverablesDrawer } from "@/features/deliverables/components";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import {
  archiveTaskAction,
  bulkAssignTasksAction,
  bulkUpdateTasksPriorityAction,
  bulkArchiveTasksAction,
} from "../actions";
import {
  CheckSquare,
  CheckCircle2,
  Edit3,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Layers,
  FileText,
  Building2,
  AlertTriangle,
  SlidersHorizontal,
  Globe,
  X,
  Loader2,
  Kanban,
  Table as TableIcon,
} from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { TaskClientReviewDialog } from "./task-client-review-dialog";
import { TaskPublishDialog } from "./task-publish-dialog";

interface TaskListProps {
  tasks: TaskWithRelations[];
  projectId?: string;
  projectDeadline?: string;
  currentUserId: string;
  userRole?: string;
  canManage: boolean;
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
  showProjectColumn?: boolean;
}

export function TaskList({
  tasks,
  projectId,
  projectDeadline,
  currentUserId,
  userRole,
  canManage,
  availableAssignees = [],
  availableContentPlans = [],
  availableScripts = [],
  showProjectColumn = false,
}: TaskListProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [typeFilter, setTypeFilter] = React.useState<string>("ALL");

  // Selection & Bulk Actions State
  const [selectedTaskIds, setSelectedTaskIds] = React.useState<string[]>([]);
  const [isBulkAssignOpen, setIsBulkAssignOpen] = React.useState(false);
  const [isBulkPriorityOpen, setIsBulkPriorityOpen] = React.useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = React.useState(false);
  const [bulkAssigneeId, setBulkAssigneeId] = React.useState("");
  const [bulkPriority, setBulkPriority] = React.useState<PriorityLevel>("MEDIUM");
  const [isBulkSubmitting, setIsBulkSubmitting] = React.useState(false);

  // Single Task Dialog States
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<TaskWithRelations | null>(null);

  const [isReassignOpen, setIsReassignOpen] = React.useState(false);
  const [reassigningTask, setReassigningTask] = React.useState<TaskWithRelations | null>(null);

  const [deliverableTask, setDeliverableTask] = React.useState<TaskWithRelations | null>(null);

  // Single Task Archive Alert State
  const [taskToArchive, setTaskToArchive] = React.useState<TaskWithRelations | null>(null);
  const [isArchiving, setIsArchiving] = React.useState(false);
  const [archiveError, setArchiveError] = React.useState<string | null>(null);

  // Single Task Client Review & Publish States
  const [clientReviewTask, setClientReviewTask] = React.useState<TaskWithRelations | null>(null);
  const [publishTask, setPublishTask] = React.useState<TaskWithRelations | null>(null);

  // Creative role simplified filter
  const isCreativeRole =
    userRole === "GRAPHIC_DESIGNER" || userRole === "VIDEO_EDITOR";
  const [onlyMyTasks, setOnlyMyTasks] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<"kanban" | "table">(
    isCreativeRole ? "kanban" : "table"
  );

  const filteredTasks = React.useMemo(() => {
    return tasks.filter((task) => {
      const matchesMyTasks =
        !onlyMyTasks || task.current_assignee_id === currentUserId;

      const matchesSearch =
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.current_assignee?.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.notes || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" || task.status === statusFilter;
      const matchesType =
        typeFilter === "ALL" || task.task_type === typeFilter;

      return matchesMyTasks && matchesSearch && matchesStatus && matchesType;
    });
  }, [tasks, onlyMyTasks, currentUserId, searchTerm, statusFilter, typeFilter]);

  // Selection helpers
  const allVisibleSelected =
    filteredTasks.length > 0 &&
    filteredTasks.every((t) => selectedTaskIds.includes(t.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(filteredTasks.map((t) => t.id));
    }
  };

  const toggleSelectTask = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  // Eligible creative assignees for bulk assignment
  const eligibleAssignees = React.useMemo(() => {
    return availableAssignees.filter(
      (a) =>
        a.role === "GRAPHIC_DESIGNER" ||
        a.role === "VIDEO_EDITOR"
    );
  }, [availableAssignees]);

  // Bulk Action Handlers
  const handleConfirmBulkAssign = async () => {
    if (!bulkAssigneeId || selectedTaskIds.length === 0) return;
    setIsBulkSubmitting(true);
    const res = await bulkAssignTasksAction(selectedTaskIds, bulkAssigneeId, projectId);
    if (!res.success) {
      toast.error(res.error || "Gagal memproses penugasan massal.");
      setIsBulkSubmitting(false);
      return;
    }

    const assignedCount = res.data?.succeededCount ?? selectedTaskIds.length;
    const targetAssignee = availableAssignees.find((a) => a.id === bulkAssigneeId);
    const assigneeName = targetAssignee ? targetAssignee.full_name : "PIC";
    toast.success(`${assignedCount} tugas berhasil dialihkan ke ${assigneeName}.`);

    setIsBulkSubmitting(false);
    setIsBulkAssignOpen(false);
    setBulkAssigneeId("");
    setSelectedTaskIds([]);
  };

  const handleConfirmBulkPriority = async () => {
    if (!bulkPriority || selectedTaskIds.length === 0) return;
    setIsBulkSubmitting(true);
    const res = await bulkUpdateTasksPriorityAction(selectedTaskIds, bulkPriority, projectId);
    if (!res.success) {
      toast.error(res.error || "Gagal memperbarui prioritas massal.");
      setIsBulkSubmitting(false);
      return;
    }

    const updatedCount = res.data?.updatedCount ?? selectedTaskIds.length;
    toast.success(`Prioritas ${updatedCount} tugas berhasil diperbarui ke ${PRIORITY_LABELS[bulkPriority]}.`);

    setIsBulkSubmitting(false);
    setIsBulkPriorityOpen(false);
    setSelectedTaskIds([]);
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedTaskIds.length === 0) return;
    setIsBulkSubmitting(true);
    const res = await bulkArchiveTasksAction(selectedTaskIds, projectId);
    if (!res.success) {
      toast.error(res.error || "Gagal mengarsipkan tugas.");
      setIsBulkSubmitting(false);
      return;
    }

    const archivedCount = res.data?.succeededCount ?? selectedTaskIds.length;
    toast.success(`${archivedCount} tugas berhasil diarsipkan.`);

    setIsBulkSubmitting(false);
    setIsBulkDeleteOpen(false);
    setSelectedTaskIds([]);
  };

  // Single Task Action Handlers
  const handleCreate = () => {
    setEditingTask(null);
    setIsFormOpen(true);
  };

  const handleEdit = (task: TaskWithRelations) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const handleOpenReassign = (task: TaskWithRelations) => {
    setReassigningTask(task);
    setIsReassignOpen(true);
  };

  const handleArchive = (task: TaskWithRelations) => {
    setArchiveError(null);
    setTaskToArchive(task);
  };

  const confirmArchiveTask = async () => {
    if (!taskToArchive) return;
    setIsArchiving(true);
    setArchiveError(null);
    const res = await archiveTaskAction(taskToArchive.id, taskToArchive.project_id);
    if (!res.success) {
      const errorMsg = res.error || "Gagal menghapus tugas. Coba lagi.";
      setArchiveError(errorMsg);
      toast.error(errorMsg);
      setIsArchiving(false);
      return;
    }
    toast.success("Tugas berhasil dihapus.");
    setIsArchiving(false);
    setTaskToArchive(null);
  };

  const statusFilterLabel = React.useMemo(() => {
    if (statusFilter === "ALL") return "Semua Status";
    return TASK_STATUS_LABELS[statusFilter as TaskStatus] || statusFilter;
  }, [statusFilter]);

  const typeFilterLabel = React.useMemo(() => {
    if (typeFilter === "ALL") return "Semua Tipe";
    return TASK_TYPE_LABELS[typeFilter as TaskType] || typeFilter;
  }, [typeFilter]);

  return (
    <TooltipProvider delay={200}>
      <div className="space-y-4">
        {/* Filter and Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Creative Quick Filter: All vs My Tasks */}
            {isCreativeRole && (
              <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5 text-xs shrink-0 self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => {
                    setOnlyMyTasks(false);
                    setSelectedTaskIds([]);
                  }}
                  className={cn(
                    "rounded px-2.5 py-1 font-medium transition-colors cursor-pointer",
                    !onlyMyTasks
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOnlyMyTasks(true);
                    setSelectedTaskIds([]);
                  }}
                  className={cn(
                    "rounded px-2.5 py-1 font-medium transition-colors cursor-pointer",
                    onlyMyTasks
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Tugas Saya
                </button>
              </div>
            )}

            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSelectedTaskIds([]);
                }}
                placeholder="Cari judul tugas, PIC, atau catatan..."
                className="pl-8 text-xs h-8"
              />
            </div>

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                if (val) {
                  setStatusFilter(val);
                  setSelectedTaskIds([]);
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs min-w-36" aria-label="Filter status tugas">
                <SelectValue placeholder="Semua Status">
                  {statusFilterLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Status</SelectItem>
                <SelectItem value="TODO">Belum dikerjakan</SelectItem>
                <SelectItem value="IN_PROGRESS">Sedang dikerjakan</SelectItem>
                <SelectItem value="IN_REVIEW">Menunggu review</SelectItem>
                <SelectItem value="REVISION_REQUESTED">Perlu revisi</SelectItem>
                <SelectItem value="APPROVED">Disetujui</SelectItem>
                <SelectItem value="COMPLETED">Selesai</SelectItem>
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select
              value={typeFilter}
              onValueChange={(val) => {
                if (val) {
                  setTypeFilter(val);
                  setSelectedTaskIds([]);
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs min-w-32" aria-label="Filter tipe tugas">
                <SelectValue placeholder="Semua Tipe">
                  {typeFilterLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Tipe</SelectItem>
                <SelectItem value="GRAPHIC_DESIGN">Desain Grafis</SelectItem>
                <SelectItem value="VIDEO_EDITING">Video Editing</SelectItem>
                <SelectItem value="OTHER">Lainnya</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Switcher: Board (Kanban) vs Table */}
            <div className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("kanban")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                  viewMode === "kanban"
                    ? "bg-card text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="Tampilan Board Kanban"
              >
                <Kanban className="size-3.5" />
                <span>Board</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                  viewMode === "table"
                    ? "bg-card text-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="Tampilan Tabel"
              >
                <TableIcon className="size-3.5" />
                <span>Tabel</span>
              </button>
            </div>

            {canManage && projectId && (
              <button
                type="button"
                onClick={handleCreate}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Tambah Tugas</span>
              </button>
            )}
          </div>
        </div>

        {/* Empty State */}
        {filteredTasks.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center shadow-2xs">
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
              <CheckSquare className="size-5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              {searchTerm || statusFilter !== "ALL" || typeFilter !== "ALL"
                ? "Tugas tidak ditemukan."
                : "Belum ada tugas produksi."}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              {searchTerm || statusFilter !== "ALL" || typeFilter !== "ALL"
                ? "Coba sesuaikan kata kunci atau filter pencarian Anda."
                : canManage
                ? "Buat tugas produksi desain grafis atau video editing untuk tim kreatif."
                : "Belum ada tugas yang ditugaskan kepada Anda saat ini."}
            </p>

            {!searchTerm && statusFilter === "ALL" && typeFilter === "ALL" && canManage && projectId && (
              <div className="mt-5">
                <button
                  type="button"
                  onClick={handleCreate}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span>Buat Tugas Pertama</span>
                </button>
              </div>
            )}
          </div>
        ) : viewMode === "kanban" ? (
          <TaskKanbanBoard
            tasks={filteredTasks}
            projectId={projectId}
            currentUserId={currentUserId}
            userRole={userRole}
            canManage={canManage}
            showProjectColumn={showProjectColumn}
            onOpenDeliverables={(task) => setDeliverableTask(task)}
            onEditTask={(task) => handleEdit(task)}
            onReassignTask={(task) => {
              setReassigningTask(task);
              setIsReassignOpen(true);
            }}
            onArchiveTask={(task) => setTaskToArchive(task)}
            onOpenClientReview={(task) => setClientReviewTask(task)}
            onOpenPublish={(task) => setPublishTask(task)}
          />
        ) : (
          <>
            {/* Desktop Table Container with Horizontal Scroll & Min-Width */}
            <div className="hidden md:block rounded-lg border border-border bg-card shadow-2xs overflow-hidden">
              {/* Contextual Bulk Action Bar */}
              {selectedTaskIds.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-primary/20 bg-primary/5 px-4 py-2.5 text-xs text-foreground">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex size-2 rounded-full bg-primary animate-pulse" />
                    <span className="font-semibold text-foreground">
                      {selectedTaskIds.length} tugas dipilih
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {canManage ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsBulkAssignOpen(true)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors shadow-2xs cursor-pointer"
                        >
                          <UserCheck className="size-3.5 text-primary" />
                          <span>Tugaskan PIC</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsBulkPriorityOpen(true)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors shadow-2xs cursor-pointer"
                        >
                          <SlidersHorizontal className="size-3.5 text-amber-500" />
                          <span>Ubah Prioritas</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsBulkDeleteOpen(true)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors shadow-2xs cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
                          <span>Hapus ({selectedTaskIds.length})</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">
                        Aksi massal hanya diizinkan untuk Operator SMS / Administrator
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedTaskIds([])}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer ml-1"
                      aria-label="Batal pilih semua tugas"
                    >
                      <X className="size-3.5" />
                      <span>Batal</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Scrollable Table Viewport with Guaranteed Min-Width */}
              <div className="overflow-x-auto w-full no-scrollbar">
                <table
                  className={cn(
                    "w-full text-left text-xs border-collapse",
                    showProjectColumn ? "min-w-[1250px]" : "min-w-[1150px]"
                  )}
                >
                  <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    <tr>
                      {/* Checkbox Column (only for managers) */}
                      {canManage && (
                        <th className="w-12 min-w-[48px] max-w-[48px] px-3 py-3 text-center">
                          <Checkbox
                            checked={allVisibleSelected}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Pilih semua tugas pada halaman ini"
                          />
                        </th>
                      )}

                      {/* Column Headers with Explicit Hierarchy */}
                      <th className="w-[300px] min-w-[280px] max-w-[340px] px-4 py-3">Tugas & PIC</th>
                      {showProjectColumn && (
                        <th className="w-[180px] min-w-[160px] max-w-[200px] px-4 py-3">Proyek</th>
                      )}
                      <th className="w-[130px] min-w-[120px] px-4 py-3 whitespace-nowrap">Tipe</th>
                      <th className="w-[110px] min-w-[100px] px-4 py-3 whitespace-nowrap">Prioritas</th>
                      <th className="w-[140px] min-w-[130px] px-4 py-3 whitespace-nowrap">Status</th>
                      <th className="w-[170px] min-w-[160px] px-4 py-3 whitespace-nowrap">Tenggat Waktu</th>
                      <th className="w-[220px] min-w-[180px] max-w-[240px] px-4 py-3">Referensi</th>
                      <th className="w-[120px] min-w-[110px] px-4 py-3 text-right whitespace-nowrap">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTasks.map((task) => {
                      const isSelected = selectedTaskIds.includes(task.id);

                      return (
                        <tr
                          key={task.id}
                          className={cn(
                            "hover:bg-muted/20 transition-colors",
                            isSelected && "bg-primary/5 hover:bg-primary/10"
                          )}
                        >
                          {/* Row Checkbox (only for managers) */}
                          {canManage && (
                            <td className="w-12 min-w-[48px] max-w-[48px] px-3 py-3 text-center">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelectTask(task.id)}
                                aria-label={`Pilih tugas: ${task.title}`}
                              />
                            </td>
                          )}

                          {/* Task Title & PIC: Protected line-clamp-2 & Tooltip */}
                          <td className="w-[300px] min-w-[280px] max-w-[340px] px-4 py-3">
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <div className="font-semibold text-foreground text-xs line-clamp-2 leading-relaxed cursor-help">
                                    {task.title}
                                  </div>
                                }
                              />
                              <TooltipContent side="top">
                                <p className="font-semibold text-foreground">Judul Lengkap:</p>
                                <p>{task.title}</p>
                              </TooltipContent>
                            </Tooltip>

                            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
                              {task.current_assignee ? (
                                <span className="inline-flex items-center gap-1 truncate">
                                  <span className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  <span className="truncate">PIC: {task.current_assignee.full_name}</span>
                                </span>
                              ) : (
                                <span className="text-amber-600 dark:text-amber-400 italic">
                                  Belum ada PIC
                                </span>
                              )}
                            </div>

                            {task.status === "REVISION_REQUESTED" && (
                              <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                <AlertTriangle className="size-3 shrink-0" />
                                <span>Perlu revisi</span>
                              </div>
                            )}

                            {task.notes && (
                              <p className="mt-1 text-[11px] text-muted-foreground/80 line-clamp-1 truncate">
                                {task.notes}
                              </p>
                            )}
                          </td>

                          {/* Project Column (when rendered on My Tasks) */}
                          {showProjectColumn && (
                            <td className="w-[180px] min-w-[160px] max-w-[200px] px-4 py-3 truncate">
                              {task.project ? (
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <Link
                                        href={`/projects/${task.project.id}?tab=tasks`}
                                        className="inline-flex items-center gap-1 font-medium text-foreground hover:underline truncate"
                                      >
                                        <Building2 className="size-3 text-muted-foreground shrink-0" />
                                        <span className="font-mono text-[11px] truncate">
                                          {task.project.project_code}
                                        </span>
                                      </Link>
                                    }
                                  />
                                  <TooltipContent side="top">
                                    <p className="font-semibold text-foreground">{task.project.project_code}</p>
                                    <p>{task.project.name}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                          )}

                          {/* Task Type */}
                          <td className="w-[130px] min-w-[120px] px-4 py-3 whitespace-nowrap">
                            <TaskTypeBadge taskType={task.task_type as TaskType} />
                          </td>

                          {/* Priority */}
                          <td className="w-[110px] min-w-[100px] px-4 py-3 whitespace-nowrap">
                            <TaskPriorityBadge priority={task.priority} />
                          </td>

                          {/* Status */}
                          <td className="w-[140px] min-w-[130px] px-4 py-3 whitespace-nowrap">
                            <div className="flex flex-col gap-1 items-start">
                              <TaskStatusBadge status={task.status as TaskStatus} />
                              {task.status === "APPROVED" && task.latest_client_review?.verdict === "APPROVED" && (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 text-[10px] font-semibold">
                                  <CheckCircle2 className="size-2.5" />
                                  <span>ACC Klien</span>
                                </span>
                              )}
                              {task.status === "COMPLETED" && task.publication_url && (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 text-[10px] font-semibold">
                                  <Globe className="size-2.5" />
                                  <span>Tayang</span>
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Deadline */}
                          <td className="w-[170px] min-w-[160px] px-4 py-3 whitespace-nowrap">
                            <DeadlineBadge deadline={task.deadline} />
                          </td>

                          {/* References */}
                          <td className="w-[220px] min-w-[180px] max-w-[240px] px-4 py-3">
                            <div className="space-y-1 text-[11px] text-muted-foreground">
                              {task.content_plan && (
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <div className="flex items-center gap-1 truncate cursor-help">
                                        <Layers className="size-3 text-primary shrink-0" />
                                        <span className="truncate font-medium text-foreground">
                                          {formatContentPlanLabel(task.content_plan)}
                                        </span>
                                      </div>
                                    }
                                  />
                                  <TooltipContent side="top">
                                    <p className="font-semibold text-foreground">Rencana Konten:</p>
                                    <p>{formatContentPlanLabel(task.content_plan)}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {task.script && (
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <div className="flex items-center gap-1 truncate cursor-help">
                                        <FileText className="size-3 text-emerald-500 shrink-0" />
                                        <span className="truncate">
                                          {formatScriptLabel(task.script)}
                                        </span>
                                      </div>
                                    }
                                  />
                                  <TooltipContent side="top">
                                    <p className="font-semibold text-foreground">Naskah (Script):</p>
                                    <p>{formatScriptLabel(task.script)}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {!task.content_plan && !task.script && (
                                <span className="text-muted-foreground/60">-</span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="w-[120px] min-w-[110px] px-4 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {/* Status Transition Button */}
                              <TaskStatusControl
                                task={task}
                                projectId={task.project_id}
                                currentUserId={currentUserId}
                                userRole={userRole}
                                canManage={canManage}
                                isProjectTerminal={
                                  task.project?.status === "PUBLISHED" ||
                                  task.project?.status === "CANCELLED"
                                }
                                onOpenDeliverables={() => setDeliverableTask(task)}
                                onOpenAssign={() => handleOpenReassign(task)}
                                onOpenClientReview={() => setClientReviewTask(task)}
                                onOpenPublish={() => setPublishTask(task)}
                              />

                              {/* Deliverables Drawer Button */}
                              <Tooltip>
                                <TooltipTrigger
                                  render={
                                    <button
                                      type="button"
                                      onClick={() => setDeliverableTask(task)}
                                      aria-label={
                                        userRole === "SOCIAL_MEDIA_SPECIALIST"
                                          ? `Lihat file deliverable ${task.title}`
                                          : `Kelola file deliverable ${task.title}`
                                      }
                                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                                    >
                                      <Layers className="size-3.5" />
                                      <span className="sr-only">
                                        {userRole === "SOCIAL_MEDIA_SPECIALIST"
                                          ? "Lihat Deliverable"
                                          : "Kelola Deliverable"}
                                      </span>
                                    </button>
                                  }
                                />
                                <TooltipContent side="top">
                                  {userRole === "SOCIAL_MEDIA_SPECIALIST"
                                    ? "Lihat Deliverable"
                                    : "Kelola File Deliverable"}
                                </TooltipContent>
                              </Tooltip>

                              {/* Reassign Button (Admin / owning SMS) */}
                              {canManage &&
                                !(
                                  task.project?.status === "PUBLISHED" ||
                                  task.project?.status === "CANCELLED"
                                ) && (
                                  <Tooltip>
                                    <TooltipTrigger
                                      render={
                                        <button
                                          type="button"
                                          onClick={() => handleOpenReassign(task)}
                                          aria-label={
                                            task.current_assignee_id
                                              ? `Alihkan penugasan tugas ${task.title}`
                                              : `Tugaskan PIC untuk ${task.title}`
                                          }
                                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                                        >
                                          <UserCheck className="size-3.5" />
                                          <span className="sr-only">
                                            {task.current_assignee_id
                                              ? "Alihkan Penugasan"
                                              : "Tugaskan PIC"}
                                          </span>
                                        </button>
                                      }
                                    />
                                    <TooltipContent side="top">
                                      {task.current_assignee_id
                                        ? "Alihkan Penugasan PIC"
                                        : "Tugaskan PIC"}
                                    </TooltipContent>
                                  </Tooltip>
                                )}

                              {/* Edit Button (Admin / owning SMS) */}
                              {canManage &&
                                !(
                                  task.project?.status === "PUBLISHED" ||
                                  task.project?.status === "CANCELLED"
                                ) && (
                                  <Tooltip>
                                    <TooltipTrigger
                                      render={
                                        <button
                                          type="button"
                                          onClick={() => handleEdit(task)}
                                          aria-label={`Edit metadata tugas ${task.title}`}
                                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                                        >
                                          <Edit3 className="size-3.5" />
                                          <span className="sr-only">Edit Tugas</span>
                                        </button>
                                      }
                                    />
                                    <TooltipContent side="top">
                                      Edit Metadata Tugas
                                    </TooltipContent>
                                  </Tooltip>
                                )}

                              {/* Archive Button (Admin / owning SMS) */}
                              {canManage &&
                                !(
                                  task.project?.status === "PUBLISHED" ||
                                  task.project?.status === "CANCELLED"
                                ) && (
                                  <Tooltip>
                                    <TooltipTrigger
                                      render={
                                        <button
                                          type="button"
                                          onClick={() => handleArchive(task)}
                                          aria-label={`Arsipkan tugas ${task.title}`}
                                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                                        >
                                          <Trash2 className="size-3.5" />
                                          <span className="sr-only">Arsipkan</span>
                                        </button>
                                      }
                                    />
                                    <TooltipContent side="top">
                                      Arsipkan Tugas
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Reflow Cards View */}
            <div className="md:hidden space-y-3">
              {/* Mobile Bulk Selection Banner if items selected */}
              {selectedTaskIds.length > 0 && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
                  <span className="font-semibold text-foreground">
                    {selectedTaskIds.length} tugas dipilih
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedTaskIds([])}
                    className="text-xs text-muted-foreground hover:text-foreground font-medium"
                  >
                    Batal Pilih
                  </button>
                </div>
              )}

              {filteredTasks.map((task) => {
                const isSelected = selectedTaskIds.includes(task.id);

                return (
                  <div
                    key={task.id}
                    className={cn(
                      "rounded-lg border border-border bg-card p-4 space-y-3 shadow-2xs text-xs",
                      isSelected && "border-primary/40 bg-primary/5"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        {canManage && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectTask(task.id)}
                            aria-label={`Pilih tugas: ${task.title}`}
                            className="mt-0.5"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold text-foreground leading-snug break-words">
                            {task.title}
                          </h4>
                          {showProjectColumn && task.project && (
                            <Link
                              href={`/projects/${task.project.id}?tab=tasks`}
                              className="inline-flex items-center gap-1 font-medium text-primary hover:underline text-[11px] mt-0.5"
                            >
                              <Building2 className="size-3" />
                              <span>
                                {task.project.project_code} - {task.project.name}
                              </span>
                            </Link>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 items-end shrink-0">
                        <TaskStatusBadge status={task.status as TaskStatus} />
                        {task.status === "APPROVED" && task.latest_client_review?.verdict === "APPROVED" && (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 text-[10px] font-semibold">
                            <CheckCircle2 className="size-2.5" />
                            <span>ACC Klien</span>
                          </span>
                        )}
                        {task.status === "COMPLETED" && task.publication_url && (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 text-[10px] font-semibold">
                            <Globe className="size-2.5" />
                            <span>Tayang</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={cn("flex flex-wrap items-center gap-1.5", canManage && "pl-6")}>
                      <TaskTypeBadge taskType={task.task_type as TaskType} />
                      <TaskPriorityBadge priority={task.priority} />
                      {task.status === "REVISION_REQUESTED" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                          <AlertTriangle className="size-3 shrink-0" />
                          <span>Perlu revisi</span>
                        </span>
                      )}
                    </div>

                    {task.notes && (
                      <p className={cn("text-[11px] text-muted-foreground bg-muted/20 p-2 rounded border border-border/40", canManage && "ml-6")}>
                        {task.notes}
                      </p>
                    )}

                    <div className={cn("space-y-1 text-[11px] text-muted-foreground border-t border-border/60 pt-2", canManage && "pl-6")}>
                      <div className="flex items-center justify-between">
                        <span>PIC:</span>
                        <span className="font-medium text-foreground">
                          {task.current_assignee ? task.current_assignee.full_name : "Belum ada"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Deadline:</span>
                        <DeadlineBadge deadline={task.deadline} />
                      </div>
                    </div>

                    {/* Mobile Action Buttons */}
                    <div className={cn("flex items-center justify-between border-t border-border/60 pt-2", canManage && "pl-6")}>
                      <TaskStatusControl
                        task={task}
                        projectId={task.project_id}
                        currentUserId={currentUserId}
                        userRole={userRole}
                        canManage={canManage}
                        isProjectTerminal={
                          task.project?.status === "PUBLISHED" ||
                          task.project?.status === "CANCELLED"
                        }
                        onOpenDeliverables={() => setDeliverableTask(task)}
                        onOpenAssign={() => handleOpenReassign(task)}
                        onOpenClientReview={() => setClientReviewTask(task)}
                        onOpenPublish={() => setPublishTask(task)}
                      />

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDeliverableTask(task)}
                          className="inline-flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-medium cursor-pointer"
                        >
                          <Layers className="size-3" />
                          <span>
                            {userRole === "SOCIAL_MEDIA_SPECIALIST"
                              ? "Lihat Deliverable"
                              : "Files"}
                          </span>
                        </button>

                        {canManage &&
                          !(
                            task.project?.status === "PUBLISHED" ||
                            task.project?.status === "CANCELLED"
                          ) && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenReassign(task)}
                                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium cursor-pointer"
                              >
                                <UserCheck className="size-3" />
                                <span>{task.current_assignee_id ? "PIC" : "Tugaskan"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEdit(task)}
                                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-medium cursor-pointer"
                              >
                                <Edit3 className="size-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleArchive(task)}
                                className="inline-flex items-center gap-1 text-[11px] text-destructive hover:underline font-medium cursor-pointer"
                              >
                                <Trash2 className="size-3" />
                                <span>Hapus</span>
                              </button>
                            </>
                          )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Task Creation & Edit Dialog */}
        {projectId && (
          <TaskFormDialog
            open={isFormOpen}
            onOpenChange={setIsFormOpen}
            projectId={projectId}
            projectDeadline={projectDeadline || new Date().toISOString()}
            initialData={editingTask}
            availableAssignees={availableAssignees}
            availableContentPlans={availableContentPlans}
            availableScripts={availableScripts}
          />
        )}

        {/* Task Reassign Dialog (Individual) */}
        <TaskReassignDialog
          open={isReassignOpen}
          onOpenChange={setIsReassignOpen}
          task={reassigningTask}
          projectId={reassigningTask?.project_id || projectId || ""}
          availableAssignees={availableAssignees}
        />

        {/* Task Deliverables Drawer */}
        <TaskDeliverablesDrawer
          task={deliverableTask}
          isOpen={Boolean(deliverableTask)}
          onClose={() => setDeliverableTask(null)}
          currentUserId={currentUserId}
          userRole={userRole}
          canManage={canManage}
        />

        {/* Single Task Archive Alert Dialog */}
        <AlertDialog
          open={Boolean(taskToArchive)}
          onOpenChange={(open) => {
            if (!open) {
              setTaskToArchive(null);
              setArchiveError(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-semibold">
                Arsipkan Tugas Produksi?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground">
                Apakah Anda yakin ingin mengarsipkan tugas &quot;{taskToArchive?.title}&quot;? Tugas ini tidak akan lagi tampil di daftar pengerjaan aktif.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {archiveError && (
              <div
                role="alert"
                className="rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive font-medium"
              >
                {archiveError}
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isArchiving}>Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmArchiveTask}
                disabled={isArchiving}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isArchiving ? "Mengarsipkan..." : "Arsipkan Tugas"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Assign Dialog */}
        <Dialog open={isBulkAssignOpen} onOpenChange={setIsBulkAssignOpen}>
          <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
            <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
              <DialogTitle className="text-base font-semibold text-foreground">
                Tugaskan {selectedTaskIds.length} Tugas Terpilih
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Pilih personel tim kreatif yang akan ditugaskan sebagai penanggung jawab untuk tugas-tugas yang dipilih.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Pilih PIC Kreatif <span className="text-destructive">*</span>
                </label>
                <Select
                  value={bulkAssigneeId}
                  onValueChange={(val) => setBulkAssigneeId(val || "")}
                  disabled={isBulkSubmitting}
                >
                  <SelectTrigger className="w-full text-xs h-9">
                    <SelectValue placeholder="Pilih PIC pengganti/penerima..." />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleAssignees.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name} · {user.role === "GRAPHIC_DESIGNER" ? "Graphic Designer" : user.role === "VIDEO_EDITOR" ? "Video Editor" : user.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Hanya personel kreatif aktif yang memenuhi syarat yang ditampilkan.
                </p>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBulkSubmitting}
                onClick={() => setIsBulkAssignOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isBulkSubmitting || !bulkAssigneeId}
                onClick={handleConfirmBulkAssign}
              >
                {isBulkSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    <span>Menugaskan...</span>
                  </>
                ) : (
                  <span>Konfirmasi Penugasan</span>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Priority Dialog */}
        <Dialog open={isBulkPriorityOpen} onOpenChange={setIsBulkPriorityOpen}>
          <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
            <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
              <DialogTitle className="text-base font-semibold text-foreground">
                Ubah Prioritas {selectedTaskIds.length} Tugas
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Pilih prioritas baru yang akan diterapkan pada seluruh tugas yang dipilih.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Tingkat Prioritas <span className="text-destructive">*</span>
                </label>
                <Select
                  value={bulkPriority}
                  onValueChange={(val) => setBulkPriority(val as PriorityLevel)}
                  disabled={isBulkSubmitting}
                >
                  <SelectTrigger className="w-full text-xs h-9">
                    <SelectValue placeholder="Pilih prioritas..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Rendah (Low)</SelectItem>
                    <SelectItem value="MEDIUM">Sedang (Medium)</SelectItem>
                    <SelectItem value="HIGH">Tinggi (High)</SelectItem>
                    <SelectItem value="URGENT">Mendesak (Urgent)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBulkSubmitting}
                onClick={() => setIsBulkPriorityOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isBulkSubmitting || !bulkPriority}
                onClick={handleConfirmBulkPriority}
              >
                {isBulkSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Terapkan Prioritas</span>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Delete Alert Dialog */}
        <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base font-semibold">
                Arsipkan {selectedTaskIds.length} Tugas?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
                Tugas yang dipilih akan diarsipkan dari proyek. Riwayat pengerjaan tetap tersimpan untuk audit historis, namun tugas tidak akan tampil lagi di daftar tugas aktif.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isBulkSubmitting}>Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmBulkDelete}
                disabled={isBulkSubmitting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isBulkSubmitting ? "Mengarsipkan..." : `Ya, Arsipkan ${selectedTaskIds.length} Tugas`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Task Client Review Dialog */}
        <TaskClientReviewDialog
          open={!!clientReviewTask}
          onOpenChange={(open) => !open && setClientReviewTask(null)}
          task={clientReviewTask}
          projectId={projectId || clientReviewTask?.project_id}
          onSuccess={() => setClientReviewTask(null)}
        />

        {/* Task Publish Dialog */}
        <TaskPublishDialog
          open={!!publishTask}
          onOpenChange={(open) => !open && setPublishTask(null)}
          task={publishTask}
          projectId={projectId || publishTask?.project_id}
          onSuccess={() => setPublishTask(null)}
        />
      </div>
    </TooltipProvider>
  );
}
