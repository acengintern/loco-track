"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users,
  CheckSquare,
  Clock,
  AlertTriangle,
  ExternalLink,
  Briefcase,
} from "lucide-react";
import { MetricCard } from "@/features/dashboard/components/metric-card";
import type { TeamWorkloadData, CreativeWorkloadMember, CreativeTaskSummary } from "../types";
import { TeamWorkloadSnapshot } from "./team-workload-snapshot";
import { TeamDeadlineStrip } from "./team-deadline-strip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface WorkloadTableProps {
  data: TeamWorkloadData;
}

function formatStatusLabel(status: string): string {
  switch (status) {
    case "TODO":
      return "Belum Dikerjakan";
    case "IN_PROGRESS":
      return "Proses";
    case "REVISION_REQUESTED":
      return "Revisi";
    case "IN_REVIEW":
      return "QC";
    default:
      return status;
  }
}

function formatHumanDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function WorkloadTable({ data }: WorkloadTableProps) {
  const [selectedMember, setSelectedMember] = React.useState<CreativeWorkloadMember | null>(null);

  // Keyboard accessibility for modal dismissal
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && selectedMember) {
        setSelectedMember(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedMember]);

  return (
    <div className="space-y-8">
      {/* 1. Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Personel Kreatif Aktif"
          value={data.totalActiveCreatives}
          description="Desainer grafis dan video editor yang aktif dalam tim"
          variant="default"
          icon={<Users className="size-4" />}
        />
        <MetricCard
          label="Total Tugas Berjalan"
          value={data.totalActiveTasks}
          description="Total akumulasi tugas yang sedang dikerjakan tim kreatif"
          variant="default"
          icon={<CheckSquare className="size-4" />}
        />
        <MetricCard
          label="Mendekati Deadline"
          value={data.totalDueSoonTasks}
          description="Tugas dengan batas waktu dalam 7 hari ke depan"
          variant={data.totalDueSoonTasks > 0 ? "warning" : "default"}
          icon={<Clock className="size-4" />}
        />
        <MetricCard
          label="Melewati Deadline"
          value={data.totalOverdueTasks}
          description="Tugas aktif yang telah melewati batas waktu yang ditentukan"
          variant={data.totalOverdueTasks > 0 ? "destructive" : "default"}
          icon={<AlertTriangle className="size-4" />}
        />
      </div>

      {/* 2. Snapshot Beban Tim (Visual A, B, C) */}
      <TeamWorkloadSnapshot
        data={data}
        onSelectMember={(member) => setSelectedMember(member)}
      />

      {/* 3. Strip Deadline Terdekat */}
      <TeamDeadlineStrip tasks={data.nearestDeadlines} />

      {/* 4. Main Workload Table Card */}
      <section
        aria-labelledby="team-workload-heading"
        className="rounded-lg border border-border bg-card shadow-2xs"
      >
        <div className="border-b border-border p-6">
          <h2
            id="team-workload-heading"
            className="text-base font-semibold text-foreground"
          >
            Matriks Distribusi Beban Kerja
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Data penugasan faktual per individu tanpa skor kapasitas spekulatif
          </p>
        </div>

        <div className="overflow-x-auto">
          {data.members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="size-8 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium text-foreground">
                Tidak ada personel kreatif yang aktif.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Pastikan akun desainer atau editor telah diaktifkan oleh Administrator.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-sm min-w-[950px]">
              <thead>
                <tr className="border-b border-border/80 bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3.5 pl-6 pr-4 w-[220px] min-w-[180px]">Personel</th>
                  <th className="py-3.5 px-4 w-[160px] min-w-[140px] whitespace-nowrap">Peran</th>
                  <th className="py-3.5 px-4 text-center w-[90px] min-w-[80px] whitespace-nowrap">Total Tugas</th>
                  <th className="py-3.5 px-4 text-center w-[120px] min-w-[100px] whitespace-nowrap">Belum Dikerjakan</th>
                  <th className="py-3.5 px-4 text-center w-[80px] min-w-[70px] whitespace-nowrap">Proses</th>
                  <th className="py-3.5 px-4 text-center w-[80px] min-w-[70px] whitespace-nowrap">Revisi</th>
                  <th className="py-3.5 px-4 text-center w-[80px] min-w-[70px] whitespace-nowrap">QC</th>
                  <th className="py-3.5 px-4 text-center w-[90px] min-w-[80px] whitespace-nowrap">Mendekati</th>
                  <th className="py-3.5 px-4 text-center w-[90px] min-w-[80px] whitespace-nowrap">Terlewat</th>
                  <th className="py-3.5 pl-4 pr-6 text-right w-[100px] min-w-[90px] whitespace-nowrap">Rincian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data.members.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3.5 pl-6 pr-4">
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-foreground truncate">
                          {member.fullName}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {member.email}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-medium text-foreground">
                        {member.role === "GRAPHIC_DESIGNER"
                          ? "Graphic Designer"
                          : "Video Editor"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold tabular-nums text-foreground">
                      {member.totalActiveTasks}
                    </td>
                    <td className="py-3.5 px-4 text-center tabular-nums text-muted-foreground">
                      {member.todoCount}
                    </td>
                    <td className="py-3.5 px-4 text-center tabular-nums text-foreground">
                      {member.inProgressCount}
                    </td>
                    <td className="py-3.5 px-4 text-center tabular-nums">
                      {member.revisionCount > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                          {member.revisionCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center tabular-nums text-muted-foreground">
                      {member.inReviewCount}
                    </td>
                    <td className="py-3.5 px-4 text-center tabular-nums">
                      {member.dueSoonCount > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                          {member.dueSoonCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center tabular-nums">
                      {member.overdueCount > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                          {member.overdueCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="py-3.5 pl-4 pr-6 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedMember(member)}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Detail ({member.totalActiveTasks})
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* 5. Drilldown Modal */}
      <Dialog
        open={Boolean(selectedMember)}
        onOpenChange={(open) => {
          if (!open) setSelectedMember(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          {/* Modal Header */}
          <DialogHeader className="px-6 py-4 border-b border-border bg-card shrink-0">
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Daftar Tugas: {selectedMember?.fullName}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {selectedMember?.role === "GRAPHIC_DESIGNER"
                  ? "Graphic Designer"
                  : "Video Editor"}{" "}
                &bull; {selectedMember?.totalActiveTasks} tugas aktif
              </DialogDescription>
            </div>
          </DialogHeader>

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {!selectedMember || selectedMember.tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Briefcase className="size-8 text-muted-foreground/60 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">
                  Tidak ada tugas aktif yang sedang ditugaskan.
                </p>
              </div>
            ) : (
              selectedMember.tasks.map((task: CreativeTaskSummary) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-md border border-border/70 bg-background/50 p-3.5 text-xs transition-colors hover:bg-muted/20"
                >
                  <div className="min-w-0 pr-3">
                    <p className="font-semibold text-foreground truncate">
                      {task.title}
                    </p>
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      {task.projectName} &bull; Status: {formatStatusLabel(task.status)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="block font-mono text-xs tabular-nums text-foreground">
                        {formatHumanDate(task.deadline)}
                      </span>
                      {task.isOverdue && (
                        <span className="inline-flex items-center rounded-full bg-destructive/10 px-1.5 py-0.2 text-[10px] font-semibold text-destructive">
                          Terlewat
                        </span>
                      )}
                      {!task.isOverdue && task.isDueSoon && (
                        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-1.5 py-0.2 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                          Mendekati
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/projects/${task.projectId}?tab=tasks`}
                      className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground hover:bg-muted/80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Buka <ExternalLink className="size-3" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Modal Footer */}
          <DialogFooter className="px-6 py-3.5 border-t border-border bg-muted/20 flex items-center justify-end shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedMember(null)}
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
