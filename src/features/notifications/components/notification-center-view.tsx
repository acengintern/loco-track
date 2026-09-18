"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { cn } from "cn";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { PaginatedNotificationsData, NotificationItem } from "../types";
import {
  formatNotificationTimestamp,
  getNotificationCategory,
  NOTIFICATION_CATEGORIES,
} from "../utils";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "../actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NotificationCenterViewProps {
  data: PaginatedNotificationsData;
  currentReadStatus: "all" | "unread";
  currentCategory: string;
}

export function NotificationCenterView({
  data,
  currentReadStatus,
  currentCategory,
}: NotificationCenterViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Optimistic local state — page/filter changes cause RSC re-render with fresh props
  const [items, setItems] = React.useState<NotificationItem[]>(data.items);
  const [isMarkingAll, setIsMarkingAll] = React.useState(false);

  // Derive count from local items so optimistic mark-read reflects immediately
  const unreadCount = React.useMemo(
    () => items.filter((it) => !it.isRead).length,
    [items]
  );

  const updateQueryParams = (newParams: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([k, v]) => {
      if (v) {
        params.set(k, v);
      } else {
        params.delete(k);
      }
    });
    router.push(`/notifications?${params.toString()}`);
  };

  const handleTabChange = (status: "all" | "unread") => {
    updateQueryParams({
      read: status === "all" ? undefined : status,
      page: undefined, // Reset page
    });
  };

  const handleCategoryChange = (category: string | null) => {
    const value = category ?? "ALL";
    updateQueryParams({
      category: value === "ALL" ? undefined : value,
      page: undefined,
    });
  };

  const handleGoToPage = (newPage: number) => {
    updateQueryParams({
      page: String(newPage),
    });
  };

  const handleMarkOneRead = async (item: NotificationItem) => {
    if (item.isRead) return;
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, isRead: true } : it))
    );
    await markNotificationReadAction(item.id);
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || isMarkingAll) return;
    setIsMarkingAll(true);
    setItems((prev) => prev.map((it) => ({ ...it, isRead: true })));
    await markAllNotificationsReadAction();
    setIsMarkingAll(false);
  };

  return (
    <div className="space-y-4">
      {/* Filter Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3.5">
        {/* Read Status Tabs */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleTabChange("all")}
            className={cn(
              "px-3.5 py-2 text-sm font-medium rounded-md transition-colors",
              currentReadStatus === "all"
                ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <span>Semua</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("unread")}
            className={cn(
              "px-3.5 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2",
              currentReadStatus === "unread"
                ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <span>Belum Dibaca</span>
            {unreadCount > 0 && (
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-bold",
                  currentReadStatus === "unread"
                    ? "bg-primary-foreground text-primary"
                    : "bg-primary text-primary-foreground"
                )}
              >
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Category Filter & Mark All Read */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Select
            value={currentCategory || "ALL"}
            onValueChange={handleCategoryChange}
          >
            <SelectTrigger className="h-10 text-sm min-w-44" aria-label="Filter kategori notifikasi">
              <SelectValue placeholder="Semua Kategori" />
            </SelectTrigger>
            <SelectContent>
              {NOTIFICATION_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={isMarkingAll}
              className="h-10 text-sm px-3.5 gap-2"
            >
              {isMarkingAll ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCheck className="size-4" />
              )}
              <span>Tandai semua dibaca</span>
            </Button>
          )}
        </div>
      </div>

      {/* Notification List */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground mb-4">
            <Bell className="size-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            {currentReadStatus === "unread"
              ? "Tidak ada notifikasi yang belum dibaca."
              : "Belum ada notifikasi untuk ditampilkan."}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground leading-relaxed">
            {currentReadStatus === "unread"
              ? "Semua notifikasi Anda sudah ditandai dibaca."
              : "Pemberitahuan penugasan tugas, revisi internal, feedback klien, dan status workflow akan muncul di sini."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card shadow-2xs divide-y divide-border/60 overflow-hidden">
          {items.map((item) => {
            const category = getNotificationCategory(item);
            const hasValidLink = Boolean(
              item.linkUrl && item.linkUrl !== "#" && item.linkUrl.startsWith("/")
            );

            return (
              <div
                key={item.id}
                className={cn(
                  "p-4 sm:p-5 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5",
                  !item.isRead ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/40"
                )}
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {/* Unread Accent Dot */}
                  <div className="pt-1.5 shrink-0">
                    <span
                      className={cn(
                        "block size-2.5 rounded-full transition-colors",
                        !item.isRead ? "bg-primary" : "bg-transparent"
                      )}
                      aria-hidden="true"
                    />
                  </div>

                  {/* Body Content */}
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "text-xs px-2.5 py-0.5 rounded-md font-medium",
                          category.badgeClass
                        )}
                      >
                        {category.label}
                      </span>
                      <h4
                        className={cn(
                          "text-sm sm:text-base",
                          !item.isRead
                            ? "font-semibold text-foreground"
                            : "font-medium text-foreground/85"
                        )}
                      >
                        {item.title}
                      </h4>
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.message}
                    </p>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground/80 pt-0.5">
                      <span>{formatNotificationTimestamp(item.createdAt)}</span>
                      {!hasValidLink && (
                        <>
                          <span>•</span>
                          <span className="italic text-muted-foreground/70">
                            Konten terkait sudah tidak tersedia.
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center justify-end gap-2.5 shrink-0 sm:pl-4">
                  {hasValidLink && (
                    <Button
                      nativeButton={false}
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs sm:text-sm px-3 gap-1.5"
                      render={
                        <Link
                          href={item.linkUrl}
                          onClick={() => handleMarkOneRead(item)}
                        />
                      }
                    >
                      <span>Buka</span>
                      <ExternalLink className="size-3.5" />
                    </Button>
                  )}

                  {!item.isRead && (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleMarkOneRead(item)}
                            aria-label="Tandai notifikasi ini sudah dibaca"
                            className="text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <Check className="size-4" />
                          </Button>
                        }
                      />
                      <TooltipContent side="top">
                        Tandai sudah dibaca
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Server-Side Pagination */}
      {data.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
          <p className="text-sm text-muted-foreground">
            Halaman {data.currentPage} dari {data.totalPages} ({data.totalCount} total notifikasi)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGoToPage(data.currentPage - 1)}
              disabled={data.currentPage <= 1}
              className="gap-1.5 text-sm h-9 px-3"
            >
              <ChevronLeft className="size-4" />
              <span>Sebelumnya</span>
            </Button>
            <div className="text-sm font-medium px-2.5">
              {data.currentPage} / {data.totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGoToPage(data.currentPage + 1)}
              disabled={data.currentPage >= data.totalPages}
              className="gap-1.5 text-sm h-9 px-3"
            >
              <span>Berikutnya</span>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
