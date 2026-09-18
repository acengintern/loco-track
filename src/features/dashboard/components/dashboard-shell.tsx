import * as React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ROLE_DASHBOARD_DESCRIPTIONS } from "@/constants/navigation";
import type { UserRole } from "@/lib/supabase/provisioning";

interface DashboardShellProps {
  fullName: string;
  role: UserRole;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function DashboardShell({
  fullName,
  role,
  children,
  action,
}: DashboardShellProps) {
  const description =
    ROLE_DASHBOARD_DESCRIPTIONS[role] ??
    "Sistem manajemen alur kerja internal LOCO TRACK.";

  return (
    <div className="space-y-8 sm:space-y-10">
      <PageHeader title={`Halo, ${fullName}`} description={description}>
        {action && <div className="flex items-center gap-2">{action}</div>}
      </PageHeader>

      {children}
    </div>
  );
}
