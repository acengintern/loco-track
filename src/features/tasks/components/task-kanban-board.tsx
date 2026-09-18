"use client";

import * as React from "react";
import type { TaskWithRelations, TaskStatus } from "../types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TaskPriorityBadge,
  TaskTypeBadge,
  DeadlineBadge,
} from "./task-badges";
import { TaskStatusControl } from "./task-status-control";
import {
  ListTodo,
  Clock,
  AlertTriangle,
  Eye,
  CheckCircle2,
  FileText,
  Layers,
  MoreVertical,
  Edit2,
  UserCheck,
  Trash2,
  Upload,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "cn";

interface TaskKanbanBoardProps {
  tasks: TaskWithRelations[];
  projectId?: string;
  currentUserId: string;
  userRole?: string;
  canManage: boolean;
  showProjectColumn?: boolean;
  onOpenDeliverables: (task: TaskWithRelations) => void;
  onEditTask?: (task: TaskWithRelations) => void;
  onReassignTask?: (task: TaskWithRelations) => void;
  onArchiveTask?: (task: TaskWithRelations) => void;
  onOpenClientReview?: (task: TaskWithRelations) => void;
  onOpenPublish?: (task: TaskWithRelations) => void;
}

interface KanbanColumnConfig {
  id: string;
  title: string;
  subtitle: string;
  statuses: TaskStatus[];
  icon: React.ElementType;
  accentColor: string;
  badgeClass: string;
}

const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  {
    id: "todo",
    title: "Siap Dikerjakan",
    subtitle: "Menunggu pengerjaan dimulai",
    statuses: ["TODO"],
    icon: ListTodo,
    accentColor: "text-muted-foreground",
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
  {
    id: "in_progress",
    title: "Sedang Dikerjakan",
    subtitle: "Tahap produksi & render",
    statuses: ["IN_PROGRESS"],
    icon: Clock,
    accentColor: "text-sky-600 dark:text-sky-400",
    badgeClass: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
  },
  {
    id: "revision",
    title: "Perlu Revisi",
    subtitle: "Catatan revisi QC atau klien",
    statuses: ["REVISION_REQUESTED"],
    icon: AlertTriangle,
    accentColor: "text-amber-600 dark:text-amber-400",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
  {
    id: "in_review",
    title: "Menunggu Review",
    subtitle: "Antrean QC Creative Director / SMS",
    statuses: ["IN_REVIEW"],
    icon: Eye,
    accentColor: "text-purple-600 dark:text-purple-400",
    badgeClass: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
  },
  {
    id: "done",
    title: "Disetujui & Selesai",
    subtitle: "Lolos QC dan siap tayang",
    statuses: ["APPROVED", "COMPLETED"],
    icon: CheckCircle2,
    accentColor: "text-emerald-600 dark:text-emerald-400",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
];

export function TaskKanbanBoard({
  tasks,
  projectId,
  currentUserId,
  userRole,
  canManage,
  showProjectColumn = false,
  onOpenDeliverables,
  onEditTask,
  onReassignTask,
  onArchiveTask,
  onOpenClientReview,
  onOpenPublish,
}: TaskKanbanBoardProps) {
  // Group tasks by column
  const columnTasks = React.useMemo(() => {
    const map = new Map<string, TaskWithRelations[]>();
    KANBAN_COLUMNS.forEach((col) => {
      map.set(
        col.id,
        tasks.filter((task) => col.statuses.includes(task.status))
      );
    });
    return map;
  }, [tasks]);

  return (
    <div className="w-full overflow-x-auto no-scrollbar pb-4 pt-1">
      <div className="flex gap-4 min-w-[1450px] items-start">
        {KANBAN_COLUMNS.map((column) => {
          const colTasks = columnTasks.get(column.id) || [];
          const Icon = column.icon;

          return (
            <div
              key={column.id}
              className="w-[280px] shrink-0 rounded-lg border border-border/80 bg-muted/20 flex flex-col max-h-[calc(100vh-220px)]"
            >
              {/* Column Header */}
              <div className="p-3 border-b border-border/70 flex items-center justify-between bg-muted/40 rounded-t-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={cn("size-4 shrink-0", column.accentColor)} />
                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold text-foreground truncate">
                      {column.title}
                    </h3>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                    column.badgeClass
                  )}
                >
                  {colTasks.length}
                </Badge>
              </div>

              {/* Column Cards Container */}
              <div className="p-2 space-y-2.5 overflow-y-auto no-scrollbar flex-1 overscroll-contain">
                {colTasks.length === 0 ? (
                  <div className="text-center py-8 px-3 rounded-md border border-dashed border-border/60 bg-muted/10">
                    <p className="text-[11px] text-muted-foreground italic">
                      Tidak ada tugas di tahap ini
                    </p>
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <Card
                      key={task.id}
                      className="p-0 space-y-0 bg-card border border-border hover:border-foreground/30 transition-colors shadow-2xs group relative select-none"
                    >
                      {/* Card Top: Badges & Actions */}
                      <CardHeader className="p-3 pb-1 flex-row items-center justify-between gap-1.5 border-b-0 space-y-0">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <TaskTypeBadge taskType={task.task_type} />
                          <TaskPriorityBadge priority={task.priority} />
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {/* Project Code */}
                          {(showProjectColumn || task.project) && (
                            <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                              {task.project?.project_code || "PROJ"}
                            </span>
                          )}

                          {/* Quick Dropdown Menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                              aria-label="Menu opsi tugas"
                            >
                              <MoreVertical className="size-3" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 text-xs">
                              <DropdownMenuItem
                                onClick={() => onOpenDeliverables(task)}
                                className="gap-2 text-xs"
                              >
                                <Upload className="size-3.5 text-muted-foreground" />
                                <span>Buka Deliverable</span>
                              </DropdownMenuItem>
                              {canManage && onEditTask && (
                                <DropdownMenuItem
                                  onClick={() => onEditTask(task)}
                                  className="gap-2 text-xs"
                                >
                                  <Edit2 className="size-3.5 text-muted-foreground" />
                                  <span>Edit Tugas</span>
                                </DropdownMenuItem>
                              )}
                              {canManage && onReassignTask && (
                                <DropdownMenuItem
                                  onClick={() => onReassignTask(task)}
                                  className="gap-2 text-xs"
                                >
                                  <UserCheck className="size-3.5 text-muted-foreground" />
                                  <span>Ganti PIC</span>
                                </DropdownMenuItem>
                              )}
                              {canManage && onArchiveTask && (
                                <DropdownMenuItem
                                  onClick={() => onArchiveTask(task)}
                                  className="gap-2 text-xs text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="size-3.5 text-destructive" />
                                  <span>Arsipkan Tugas</span>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>

                      {/* Card Middle: Title & Associations */}
                      <CardContent className="px-3 py-1.5 space-y-1.5">
                        <CardTitle
                          onClick={() => onOpenDeliverables(task)}
                          className="text-xs font-semibold text-foreground leading-snug hover:text-primary transition-colors cursor-pointer line-clamp-2 font-sans"
                          title={task.title}
                        >
                          {task.title}
                        </CardTitle>

                        {/* Associated Content Plan / Script */}
                        {(task.content_plan || task.script) && (
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                            {task.content_plan && (
                              <span
                                className="inline-flex items-center gap-1 bg-muted/60 px-1.5 py-0.5 rounded border border-border/40 max-w-full truncate"
                                title={`Content Plan: ${task.content_plan.title}`}
                              >
                                <FileText className="size-2.5 text-muted-foreground shrink-0" />
                                <span className="truncate max-w-[130px]">
                                  {task.content_plan.title}
                                </span>
                              </span>
                            )}
                            {task.script && (
                              <span
                                className="inline-flex items-center gap-1 bg-muted/60 px-1.5 py-0.5 rounded border border-border/40 max-w-full truncate"
                                title={`Naskah: ${task.script.title}`}
                              >
                                <Layers className="size-2.5 text-muted-foreground shrink-0" />
                                <span className="truncate max-w-[130px]">
                                  {task.script.title}
                                </span>
                              </span>
                            )}
                          </div>
                        )}

                        {/* Notes if any */}
                        {task.notes && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed bg-muted/30 p-1.5 rounded border border-border/40">
                            {task.notes}
                          </p>
                        )}
                      </CardContent>

                      {/* Card Footer: Deadline, Assignee & Status Action */}
                      <CardFooter className="px-3 py-2 border-t border-border/50 flex items-center justify-between gap-2 bg-transparent rounded-b-xl">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <DeadlineBadge deadline={task.deadline} />
                          {task.current_assignee && (
                            <span
                              className="text-[10px] text-muted-foreground truncate max-w-[110px]"
                              title={`PIC: ${task.current_assignee.full_name}`}
                            >
                              PIC: {task.current_assignee.full_name}
                            </span>
                          )}
                        </div>

                        {/* Action Control Button */}
                        <div className="shrink-0">
                          <TaskStatusControl
                            task={task}
                            projectId={task.project_id || projectId || ""}
                            currentUserId={currentUserId}
                            userRole={userRole}
                            canManage={canManage}
                            onOpenDeliverables={() => onOpenDeliverables(task)}
                            onOpenClientReview={
                              onOpenClientReview ? () => onOpenClientReview(task) : undefined
                            }
                            onOpenPublish={
                              onOpenPublish ? () => onOpenPublish(task) : undefined
                            }
                          />
                        </div>
                      </CardFooter>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
