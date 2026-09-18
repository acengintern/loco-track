"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, Check, CheckCheck, Loader2, ArrowRight } from "lucide-react";
import { cn } from "cn";
import type { NotificationFeedData, NotificationItem } from "../types";
import { markNotificationReadAction, markAllNotificationsReadAction } from "../actions";
import { formatNotificationTimestamp, getNotificationCategory } from "../utils";

interface NotificationBellProps {
  initialData: NotificationFeedData;
}

export function NotificationBell({ initialData }: NotificationBellProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [data, setData] = React.useState<NotificationFeedData>(initialData);
  const [prevInitialData, setPrevInitialData] = React.useState<NotificationFeedData>(initialData);
  const [isPending, setIsPending] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  if (initialData !== prevInitialData) {
    setPrevInitialData(initialData);
    setData(initialData);
  }

  // Dismiss popover on outside click or Escape key
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleMarkOneRead = async (item: NotificationItem) => {
    if (item.isRead) return;
    setData((prev) => ({
      unreadCount: Math.max(0, prev.unreadCount - 1),
      items: prev.items.map((it) => (it.id === item.id ? { ...it, isRead: true } : it)),
    }));
    await markNotificationReadAction(item.id);
  };

  const handleMarkAllRead = async () => {
    if (data.unreadCount === 0 || isPending) return;
    setIsPending(true);
    setData((prev) => ({
      unreadCount: 0,
      items: prev.items.map((it) => ({ ...it, isRead: true })),
    }));
    await markAllNotificationsReadAction();
    setIsPending(false);
  };

  // Preview max 6-8 items in popover
  const previewItems = data.items.slice(0, 8);

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Notifikasi: ${data.unreadCount} belum dibaca`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "group relative flex size-10 sm:size-9 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 items-center justify-center rounded-md text-muted-foreground transition-colors cursor-pointer select-none",
          "hover:text-foreground hover:bg-accent active:bg-accent/80",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
          isOpen && "bg-accent text-foreground"
        )}
      >
        <Bell className="size-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
        {data.unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 sm:top-0 sm:right-0 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-xs ring-2 ring-background animate-in zoom-in-75 duration-150"
          >
            {data.unreadCount > 9 ? "9+" : data.unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Panel Notifikasi"
          aria-modal="false"
          className={cn(
            "fixed inset-x-3 top-16 max-h-[85vh] sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 sm:max-h-[34rem]",
            "rounded-lg border border-border bg-card text-card-foreground shadow-xl z-50 overflow-hidden flex flex-col",
            "animate-in fade-in-50 zoom-in-95 duration-100"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/30 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">
                Notifikasi
              </span>
              {data.unreadCount > 0 && (
                <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-semibold border border-primary/20">
                  {data.unreadCount} belum dibaca
                </span>
              )}
            </div>

            {data.unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={isPending}
                className="inline-flex min-h-[32px] items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground active:scale-95 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring rounded px-2 py-1 transition-colors cursor-pointer"
              >
                {isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CheckCheck className="size-3.5 text-muted-foreground" />
                )}
                <span>Tandai semua dibaca</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto divide-y divide-border/60 flex-1 no-scrollbar">
            {previewItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Belum ada notifikasi.
              </div>
            ) : (
              previewItems.map((item) => {
                const category = getNotificationCategory(item);

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "group relative p-3.5 transition-colors hover:bg-muted/40",
                      !item.isRead ? "bg-primary/5" : ""
                    )}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <Link
                        href={item.linkUrl || "/notifications"}
                        onClick={() => {
                          handleMarkOneRead(item);
                          setIsOpen(false);
                        }}
                        className="flex-1 min-w-0 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring rounded"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          {!item.isRead && (
                            <span
                              aria-hidden="true"
                              className="size-1.5 rounded-full bg-primary shrink-0"
                            />
                          )}
                          <span
                            className={cn(
                              "text-[10px] px-1.5 py-0.2 rounded font-medium",
                              category.badgeClass
                            )}
                          >
                            {category.label}
                          </span>
                          <h4
                            className={cn(
                              "text-xs truncate",
                              !item.isRead
                                ? "font-semibold text-foreground"
                                : "font-medium text-muted-foreground"
                            )}
                          >
                            {item.title}
                          </h4>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {item.message}
                        </p>
                        <span className="mt-1 block text-[10px] text-muted-foreground/70">
                          {formatNotificationTimestamp(item.createdAt)}
                        </span>
                      </Link>

                      {!item.isRead && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkOneRead(item);
                          }}
                          title="Tandai sudah dibaca"
                          aria-label="Tandai sudah dibaca"
                          className="opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground focus-visible:opacity-100 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring cursor-pointer shrink-0"
                        >
                          <Check className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Permanen */}
          <div className="border-t border-border p-2.5 bg-muted/20 text-center shrink-0">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring rounded py-1 px-3 w-full"
            >
              <span>Lihat semua notifikasi</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
