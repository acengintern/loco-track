import { createClient } from "@/lib/supabase/server";
import type {
  NotificationFeedData,
  NotificationItem,
  NotificationFilterParams,
  PaginatedNotificationsData,
} from "./types";

/**
 * Fetches recent notifications for the header bell popover preview (max 8 items).
 */
export async function getUserNotificationFeed(limit = 8): Promise<NotificationFeedData> {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return { unreadCount: 0, items: [] };
  }

  // Count unread notifications
  const { count: unreadCount, error: countErr } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);

  if (countErr) {
    console.error("Failed to query unread notifications count:", countErr.message);
  }

  // Fetch recent preview notifications
  const { data: rows, error: rowsErr } = await supabase
    .from("notifications")
    .select(
      "id, user_id, title, message, link_url, is_read, source_event_type, source_event_id, created_at"
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (rowsErr) {
    console.error("Failed to query notifications feed:", rowsErr.message);
    return { unreadCount: unreadCount ?? 0, items: [] };
  }

  const items: NotificationItem[] = (rows || []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    title: r.title,
    message: r.message,
    linkUrl: r.link_url,
    isRead: r.is_read,
    sourceEventType: r.source_event_type,
    sourceEventId: r.source_event_id,
    createdAt: r.created_at,
  }));

  return {
    unreadCount: unreadCount ?? 0,
    items,
  };
}

/**
 * Fetches paginated notifications for the dedicated Notification Center (/notifications).
 */
export async function getPaginatedNotifications(
  params: NotificationFilterParams
): Promise<PaginatedNotificationsData> {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return {
      items: [],
      totalCount: 0,
      unreadCount: 0,
      currentPage: 1,
      totalPages: 0,
      pageSize: 20,
    };
  }

  const page = Math.max(1, params.page || 1);
  const pageSize = Math.max(1, Math.min(params.pageSize || 20, 50));
  const offset = (page - 1) * pageSize;

  // 1. Overall Unread Count (for tab badge & header)
  const { count: rawUnreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);

  const unreadCount = rawUnreadCount ?? 0;

  // 2. Count Query & Data Query
  let countQuery = supabase
    .from("notifications")
    .select("id", { count: "exact", head: true });

  let dataQuery = supabase
    .from("notifications")
    .select(
      "id, user_id, title, message, link_url, is_read, source_event_type, source_event_id, created_at"
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + pageSize - 1);

  // Filter by read status
  if (params.readStatus === "unread") {
    countQuery = countQuery.eq("is_read", false);
    dataQuery = dataQuery.eq("is_read", false);
  }

  // Filter by category
  if (params.category && params.category !== "ALL") {
    switch (params.category) {
      case "TASK_ASSIGNMENT":
        countQuery = countQuery.eq("source_event_type", "TASK_ASSIGNMENT");
        dataQuery = dataQuery.eq("source_event_type", "TASK_ASSIGNMENT");
        break;

      case "REVISION_INTERNAL":
        countQuery = countQuery
          .eq("source_event_type", "REVISION_REQUEST")
          .not("title", "ilike", "%client%");
        dataQuery = dataQuery
          .eq("source_event_type", "REVISION_REQUEST")
          .not("title", "ilike", "%client%");
        break;

      case "REVISION_CLIENT":
        countQuery = countQuery
          .eq("source_event_type", "REVISION_REQUEST")
          .ilike("title", "%client%");
        dataQuery = dataQuery
          .eq("source_event_type", "REVISION_REQUEST")
          .ilike("title", "%client%");
        break;

      case "QC":
        countQuery = countQuery.in("source_event_type", [
          "QC_REVIEW",
          "TASK_IN_REVIEW",
        ]);
        dataQuery = dataQuery.in("source_event_type", [
          "QC_REVIEW",
          "TASK_IN_REVIEW",
        ]);
        break;

      case "PROJECT":
        countQuery = countQuery.eq(
          "source_event_type",
          "PROJECT_STATUS_CHANGE"
        );
        dataQuery = dataQuery.eq(
          "source_event_type",
          "PROJECT_STATUS_CHANGE"
        );
        break;

      default:
        break;
    }
  }

  const [{ count, error: countErr }, { data: rows, error: rowsErr }] =
    await Promise.all([countQuery, dataQuery]);

  if (countErr || rowsErr) {
    console.error(
      "Failed to query paginated notifications:",
      countErr?.message || rowsErr?.message
    );
  }

  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const items: NotificationItem[] = (rows || []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    title: r.title,
    message: r.message,
    linkUrl: r.link_url,
    isRead: r.is_read,
    sourceEventType: r.source_event_type,
    sourceEventId: r.source_event_id,
    createdAt: r.created_at,
  }));

  return {
    items,
    totalCount,
    unreadCount,
    currentPage: page,
    totalPages,
    pageSize,
  };
}
