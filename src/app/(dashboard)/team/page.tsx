import * as React from "react";
import { requireRole } from "@/lib/supabase/auth";
import { ROUTE_PERMISSIONS } from "@/constants/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getTeamWorkloadData } from "@/features/team/queries";
import { WorkloadTable } from "@/features/team/components/workload-table";

export default async function TeamPage() {
  await requireRole(ROUTE_PERMISSIONS["/team"]);
  const data = await getTeamWorkloadData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Beban Kerja Tim"
        description="Distribusi penugasan dan ketersediaan kapasitas tim produksi desainer dan editor."
      />

      <WorkloadTable data={data} />
    </div>
  );
}
