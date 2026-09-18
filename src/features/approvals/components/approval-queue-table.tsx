"use client";

import * as React from "react";
import type { ApprovalQueueItem } from "../types";
import type { TaskType } from "@/features/tasks/types";
import { TASK_TYPE_LABELS } from "@/constants/labels";
import { TaskTypeBadge, TaskPriorityBadge } from "@/features/tasks/components/task-badges";
import { ApprovalStatsCards } from "./approval-stats-cards";
import { getApprovalQueueStats } from "../utils";
import { QcReviewDialog } from "./qc-review-dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Search,
  ClipboardCheck,
  FileText,
  User,
  Calendar,
  Building2,
  Clock,
  ExternalLink,
  RotateCcw,
  ArrowUpDown,
  X,
} from "lucide-react";

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (diffInSeconds < 60) return "baru saja";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} menit lalu`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} jam lalu`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays} hari lalu`;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

const PRIORITY_ORDER: Record<string, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

interface ApprovalQueueTableProps {
  items: ApprovalQueueItem[];
  userRole: string;
}

export function ApprovalQueueTable({ items, userRole }: ApprovalQueueTableProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("ALL");
  const [roundFilter, setRoundFilter] = React.useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = React.useState<string>("ALL");
  const [sortBy, setSortBy] = React.useState<string>("OLDEST");
  const [selectedItem, setSelectedItem] = React.useState<ApprovalQueueItem | null>(null);

  const stats = React.useMemo(() => getApprovalQueueStats(items), [items]);

  const hasActiveFilters =
    searchTerm.trim() !== "" ||
    typeFilter !== "ALL" ||
    roundFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    sortBy !== "OLDEST";

  const handleResetFilters = () => {
    setSearchTerm("");
    setTypeFilter("ALL");
    setRoundFilter("ALL");
    setPriorityFilter("ALL");
    setSortBy("OLDEST");
  };

  const filteredItems = React.useMemo(() => {
    const result = items.filter((item) => {
      const matchesSearch =
        item.task_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.project_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.assignee?.full_name || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = typeFilter === "ALL" || item.task_type === typeFilter;

      const matchesRound =
        roundFilter === "ALL" ||
        (roundFilter === "NEW" ? !item.has_prior_revisions : item.has_prior_revisions);

      const matchesPriority =
        priorityFilter === "ALL" ||
        (priorityFilter === "URGENT"
          ? item.priority === "HIGH" || item.priority === "URGENT"
          : item.priority === "LOW" || item.priority === "MEDIUM");

      return matchesSearch && matchesType && matchesRound && matchesPriority;
    });

    result.sort((a, b) => {
      if (sortBy === "OLDEST") {
        return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
      }
      if (sortBy === "DEADLINE") {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      if (sortBy === "PRIORITY") {
        const pA = PRIORITY_ORDER[a.priority] || 0;
        const pB = PRIORITY_ORDER[b.priority] || 0;
        return pB - pA;
      }
      return 0;
    });

    return result;
  }, [items, searchTerm, typeFilter, roundFilter, priorityFilter, sortBy]);

  const typeFilterLabel =
    typeFilter === "ALL"
      ? "Semua Tipe Disiplin"
      : TASK_TYPE_LABELS[typeFilter as TaskType] || typeFilter;

  const roundFilterLabel =
    roundFilter === "ALL"
      ? "Semua Putaran"
      : roundFilter === "NEW"
      ? "Putaran Baru (v1)"
      : "Putaran Revisi (Ulang)";

  const priorityFilterLabel =
    priorityFilter === "ALL"
      ? "Semua Prioritas"
      : priorityFilter === "URGENT"
      ? "Mendesak (High / Urgent)"
      : "Normal (Low / Medium)";

  const sortLabel =
    sortBy === "OLDEST"
      ? "Paling Lama Menunggu (FIFO)"
      : sortBy === "DEADLINE"
      ? "Deadline Terdekat"
      : "Prioritas Tertinggi";

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 4 Metric Cards */}
      <ApprovalStatsCards stats={stats} />

      {/* Filter & Triase Control Bar */}
      <div className="space-y-3.5 rounded-lg border border-border bg-card p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari judul tugas, kode proyek, atau PIC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-md border border-input bg-background pl-9.5 pr-3.5 h-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Tipe Disiplin (Strictly QC tasks only) */}
            <Select
              value={typeFilter}
              onValueChange={(val) => val && setTypeFilter(val)}
            >
              <SelectTrigger id="qc-type-filter" className="h-10 text-sm min-w-40" aria-label="Filter Tipe Disiplin">
                <SelectValue placeholder="Semua Tipe Disiplin">
                  {typeFilterLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Tipe Disiplin</SelectItem>
                <SelectItem value="GRAPHIC_DESIGN">Desain Grafis</SelectItem>
                <SelectItem value="VIDEO_EDITING">Video Editing</SelectItem>
              </SelectContent>
            </Select>

            {/* Putaran Revisi Filter */}
            <Select
              value={roundFilter}
              onValueChange={(val) => val && setRoundFilter(val)}
            >
              <SelectTrigger id="qc-round-filter" className="h-10 text-sm min-w-40" aria-label="Filter Putaran Revisi">
                <SelectValue placeholder="Semua Putaran">
                  {roundFilterLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Putaran</SelectItem>
                <SelectItem value="NEW">Putaran Baru (v1)</SelectItem>
                <SelectItem value="REVISION">Putaran Revisi (Ulang)</SelectItem>
              </SelectContent>
            </Select>

            {/* Prioritas Filter */}
            <Select
              value={priorityFilter}
              onValueChange={(val) => val && setPriorityFilter(val)}
            >
              <SelectTrigger id="qc-priority-filter" className="h-10 text-sm min-w-36" aria-label="Filter Prioritas">
                <SelectValue placeholder="Semua Prioritas">
                  {priorityFilterLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Prioritas</SelectItem>
                <SelectItem value="URGENT">Mendesak</SelectItem>
                <SelectItem value="NORMAL">Normal</SelectItem>
              </SelectContent>
            </Select>

            {/* Urutan Sort Dropdown */}
            <Select
              value={sortBy}
              onValueChange={(val) => val && setSortBy(val)}
            >
              <SelectTrigger id="qc-sort-filter" className="h-10 text-sm min-w-48" aria-label="Urutkan Berdasarkan">
                <ArrowUpDown className="size-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Urutkan">
                  {sortLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OLDEST">Paling Lama Menunggu (FIFO)</SelectItem>
                <SelectItem value="DEADLINE">Deadline Terdekat</SelectItem>
                <SelectItem value="PRIORITY">Prioritas Tertinggi</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-10 px-3 text-sm text-muted-foreground hover:text-foreground"
              >
                <X className="size-4 mr-1.5" />
                <span>Reset</span>
              </Button>
            )}
          </div>
        </div>

        {/* Counter Summary */}
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2.5">
          <span>
            Menampilkan <strong className="font-semibold text-foreground">{filteredItems.length}</strong> dari {items.length} tugas dalam antrean
          </span>
          <span className="font-mono text-xs">
            {typeFilter !== "ALL" && `Disiplin: ${typeFilterLabel} | `}
            {roundFilter !== "ALL" && `Putaran: ${roundFilterLabel} | `}
            Urutan: {sortLabel}
          </span>
        </div>
      </div>

      {/* Main Table (Desktop / Tablet) */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 p-12 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground mb-3">
            <ClipboardCheck className="size-5" />
          </div>
          <h3 className="text-sm font-medium text-foreground">
            Antrean QC Bersih
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {items.length === 0
              ? "Tidak ada tugas produksi yang sedang menunggu peninjauan Creative Director saat ini."
              : "Tidak ada tugas yang cocok dengan kriteria pencarian atau filter aktif."}
          </p>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="mt-3 text-sm"
            >
              Reset Filter
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="hidden md:block rounded-lg border border-border bg-card overflow-hidden shadow-2xs">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-sm border-collapse min-w-[1080px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold text-sm">
                    <th className="px-4 py-3.5 w-[260px] min-w-[220px]">Tugas</th>
                    <th className="px-4 py-3.5 w-[180px] min-w-[150px]">Proyek</th>
                    <th className="px-4 py-3.5 w-[130px] min-w-[120px] whitespace-nowrap">Tipe</th>
                    <th className="px-4 py-3.5 w-[160px] min-w-[140px] whitespace-nowrap">PIC</th>
                    <th className="px-4 py-3.5 w-[130px] min-w-[110px] whitespace-nowrap">Versi & Ronde</th>
                    <th className="px-4 py-3.5 w-[140px] min-w-[130px] whitespace-nowrap">Waktu Kirim</th>
                    <th className="px-4 py-3.5 w-[140px] min-w-[130px] whitespace-nowrap">Deadline</th>
                    <th className="px-4 py-3.5 w-[120px] min-w-[110px] text-right whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredItems.map((item) => (
                    <tr key={item.task_id} className="hover:bg-muted/20 transition-colors">
                      {/* Task Title & Priority */}
                      <td className="px-4 py-3.5 sm:py-4 max-w-[240px]">
                        <div className="font-semibold text-foreground text-sm truncate" title={item.task_title}>
                          {item.task_title}
                        </div>
                        <div className="mt-1">
                          <TaskPriorityBadge priority={item.priority} />
                        </div>
                      </td>

                      {/* Project */}
                      <td className="px-4 py-3.5 sm:py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-semibold text-primary text-xs">
                            {item.project_code}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[140px] mt-0.5" title={item.project_name}>
                          {item.project_name}
                        </div>
                      </td>

                      {/* Discipline Type */}
                      <td className="px-4 py-3.5 sm:py-4 whitespace-nowrap">
                        <TaskTypeBadge taskType={item.task_type} />
                      </td>

                      {/* PIC */}
                      <td className="px-4 py-3.5 sm:py-4 whitespace-nowrap text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <User className="size-3.5 text-muted-foreground" />
                          <span className="font-medium text-foreground text-sm">
                            {item.assignee ? item.assignee.full_name : "Belum ada"}
                          </span>
                        </div>
                      </td>

                      {/* Candidate Version & Authoritative Round */}
                      <td className="px-4 py-3.5 sm:py-4 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          {item.latest_file ? (
                            <div className="inline-flex items-center gap-1.5 rounded bg-muted/60 px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
                              <FileText className="size-3.5 text-primary" />
                              <span>v{item.latest_file.version}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}

                          {item.has_prior_revisions ? (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-xs font-medium border border-amber-500/20">
                              <RotateCcw className="size-3" />
                              <span>Ronde {item.qc_round}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Ronde 1 (Baru)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Submission Time */}
                      <td className="px-4 py-3.5 sm:py-4 whitespace-nowrap text-muted-foreground text-xs sm:text-sm">
                        <div className="flex items-center gap-1.5">
                          <Clock className="size-3.5" />
                          <time dateTime={item.submitted_at}>
                            {formatRelativeTime(item.submitted_at)}
                          </time>
                        </div>
                      </td>

                      {/* Deadline */}
                      <td className="px-4 py-3.5 sm:py-4 whitespace-nowrap text-muted-foreground text-xs sm:text-sm">
                        {item.deadline ? (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="size-3.5" />
                            <span>{new Date(item.deadline).toLocaleDateString("id-ID")}</span>
                          </div>
                        ) : (
                          <span>-</span>
                        )}
                      </td>

                      {/* Review Button */}
                      <td className="px-4 py-3.5 sm:py-4 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedItem(item)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <ExternalLink className="size-3.5" />
                          <span>Tinjau</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Reflow Cards (<768px) */}
          <div className="md:hidden space-y-3">
            {filteredItems.map((item) => (
              <div
                key={item.task_id}
                className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-2xs text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-foreground leading-snug">{item.task_title}</h4>
                    <div className="inline-flex items-center gap-1 font-medium text-primary text-[11px] mt-0.5">
                      <Building2 className="size-3" />
                      <span>{item.project_code} / {item.project_name}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {item.latest_file && (
                      <span className="inline-flex items-center gap-1 rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">
                        v{item.latest_file.version}
                      </span>
                    )}
                    {item.has_prior_revisions && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 px-1 py-0.5 text-[9px] font-medium border border-amber-500/20">
                        <RotateCcw className="size-2.5" />
                        <span>Ronde {item.qc_round}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <TaskTypeBadge taskType={item.task_type} />
                  <TaskPriorityBadge priority={item.priority} />
                </div>

                <div className="space-y-1 text-[11px] text-muted-foreground border-t border-border/60 pt-2">
                  <div className="flex items-center justify-between">
                    <span>PIC:</span>
                    <span className="font-medium text-foreground">
                      {item.assignee ? item.assignee.full_name : "Belum ada"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Dikirim:</span>
                    <span>
                      {formatRelativeTime(item.submitted_at)}
                    </span>
                  </div>
                  {item.deadline && (
                    <div className="flex items-center justify-between">
                      <span>Deadline:</span>
                      <span>{new Date(item.deadline).toLocaleDateString("id-ID")}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-border/60 pt-2 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors w-full justify-center"
                  >
                    <ExternalLink className="size-3.5" />
                    <span>Tinjau Deliverable</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Review Dialog */}
      <QcReviewDialog
        item={selectedItem}
        isOpen={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
        userRole={userRole}
      />
    </div>
  );
}
