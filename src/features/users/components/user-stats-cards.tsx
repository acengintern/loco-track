import * as React from "react";
import { Users, UserCheck, UserX, ShieldCheck } from "lucide-react";
import { MetricCard } from "@/features/dashboard/components/metric-card";
import type { UserListStats } from "../types";

interface UserStatsCardsProps {
  stats: UserListStats;
}

export function UserStatsCards({ stats }: UserStatsCardsProps) {
  const creativeCount =
    (stats.roleCounts.GRAPHIC_DESIGNER || 0) +
    (stats.roleCounts.VIDEO_EDITOR || 0);
  const operationalCount =
    (stats.roleCounts.SOCIAL_MEDIA_SPECIALIST || 0) +
    (stats.roleCounts.ACCOUNT_EXECUTIVE || 0) +
    (stats.roleCounts.CREATIVE_DIRECTOR || 0);
  const adminCount = stats.roleCounts.ADMIN || 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="Total Personel"
        value={stats.totalCount}
        description="Total seluruh akun terdaftar dalam sistem agency"
        variant="default"
        icon={<Users className="size-4" />}
      />
      <MetricCard
        label="Personel Aktif"
        value={stats.activeCount}
        description="Akun dengan akses aktif ke alur kerja operasional"
        variant="success"
        icon={<UserCheck className="size-4" />}
      />
      <MetricCard
        label="Personel Nonaktif"
        value={stats.inactiveCount}
        description="Akun yang dibekukan atau mantan personel"
        variant={stats.inactiveCount > 0 ? "warning" : "default"}
        icon={<UserX className="size-4" />}
      />
      <MetricCard
        label="Komposisi Peran"
        value={`${creativeCount} Kreatif / ${operationalCount} Ops`}
        description={`${adminCount} Admin, ${operationalCount} Manajemen, ${creativeCount} Kreator`}
        variant="default"
        icon={<ShieldCheck className="size-4" />}
      />
    </div>
  );
}
