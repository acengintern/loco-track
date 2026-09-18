import * as React from "react";
import { ClipboardCheck, AlertCircle, RotateCcw, CalendarClock } from "lucide-react";
import { MetricCard } from "@/features/dashboard/components/metric-card";
import type { ApprovalQueueStats } from "../types";

interface ApprovalStatsCardsProps {
  stats: ApprovalQueueStats;
}

export function ApprovalStatsCards({ stats }: ApprovalStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="Menunggu Review QC"
        value={stats.totalInReview}
        description="Total deliverable produksi dalam antrean"
        variant={stats.totalInReview > 0 ? "default" : "success"}
        icon={<ClipboardCheck className="size-4" />}
      />
      <MetricCard
        label="Prioritas Mendesak"
        value={stats.urgentCount}
        description="Tugas berprioritas High atau Urgent"
        variant={stats.urgentCount > 0 ? "warning" : "default"}
        icon={<AlertCircle className="size-4" />}
      />
      <MetricCard
        label="Putaran Revisi"
        value={stats.revisionRoundCount}
        description="Tugas yang memiliki riwayat evaluasi sebelumnya"
        variant={stats.revisionRoundCount > 0 ? "warning" : "default"}
        icon={<RotateCcw className="size-4" />}
      />
      <MetricCard
        label="Tenggat Kritis (<= 3 Hari)"
        value={stats.criticalDeadlineCount}
        description="Deadline mendekati atau melewati batas waktu"
        variant={stats.criticalDeadlineCount > 0 ? "destructive" : "default"}
        icon={<CalendarClock className="size-4" />}
      />
    </div>
  );
}
