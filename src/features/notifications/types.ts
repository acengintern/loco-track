export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  linkUrl: string;
  isRead: boolean;
  sourceEventType: string | null;
  sourceEventId: string | null;
  createdAt: string;
}

export interface NotificationFeedData {
  unreadCount: number;
  items: NotificationItem[];
}

export type NotificationCategoryKey =
  | "ALL"
  | "TASK_ASSIGNMENT"
  | "REVISION_INTERNAL"
  | "REVISION_CLIENT"
  | "QC"
  | "PROJECT"
  | "OTHER";

export interface NotificationFilterParams {
  page?: number;
  pageSize?: number;
  readStatus?: "all" | "unread";
  category?: string;
}

export interface PaginatedNotificationsData {
  items: NotificationItem[];
  totalCount: number;
  unreadCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
}
