import * as React from "react";
import { requireActiveProfile } from "@/lib/supabase/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getPaginatedNotifications } from "@/features/notifications/queries";
import { NotificationCenterView } from "@/features/notifications/components/notification-center-view";

interface NotificationsPageProps {
  searchParams: Promise<{
    read?: "all" | "unread";
    category?: string;
    page?: string;
  }>;
}

export default async function NotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  await requireActiveProfile();
  const params = await searchParams;

  const pageNum = params.page ? parseInt(params.page, 10) : 1;
  const validPage = isNaN(pageNum) ? 1 : pageNum;
  const readStatus = params.read === "unread" ? "unread" : "all";
  const category = params.category || "ALL";

  const paginatedData = await getPaginatedNotifications({
    page: validPage,
    pageSize: 20,
    readStatus,
    category,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifikasi"
        description="Pantau penugasan, revisi, QC, dan perubahan workflow yang perlu Anda ketahui."
      />

      <NotificationCenterView
        data={paginatedData}
        currentReadStatus={readStatus}
        currentCategory={category}
      />
    </div>
  );
}
