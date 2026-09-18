import * as React from "react";
import { requireRole } from "@/lib/supabase/auth";
import { ROUTE_PERMISSIONS } from "@/constants/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getApprovalsQueue } from "@/features/approvals/queries";
import { ApprovalQueueTable } from "@/features/approvals/components/approval-queue-table";
import { createClient } from "@/lib/supabase/server";

export default async function ApprovalsPage() {
  await requireRole(ROUTE_PERMISSIONS["/approvals"]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userRole = user?.user_metadata?.role || "CREATIVE_DIRECTOR";
  const queueItems = await getApprovalsQueue();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Persetujuan & QC"
        description="Antrean peninjauan kualitas internal deliverable tugas produksi sebelum diteruskan ke klien."
      />

      <ApprovalQueueTable items={queueItems} userRole={userRole} />
    </div>
  );
}
