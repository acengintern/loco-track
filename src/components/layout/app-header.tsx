import * as React from "react";
import Link from "next/link";
import type { UserRole } from "@/lib/supabase/provisioning";
import { MobileNavigation } from "@/components/layout/mobile-navigation";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import type { NotificationFeedData } from "@/features/notifications/types";

interface AppHeaderProps {
  user: {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
  };
  notificationsFeed?: NotificationFeedData;
}

export function AppHeader({ user, notificationsFeed }: AppHeaderProps) {
  const fallbackFeed: NotificationFeedData = { unreadCount: 0, items: [] };

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-border bg-background/95 px-4 sm:px-6 md:px-8 backdrop-blur-md">
      <div className="flex items-center gap-3 sm:gap-3.5">
        {/* Mobile Navigation Trigger */}
        <MobileNavigation user={user} />

        {/* Mobile Brand Link (visible when sidebar is hidden) */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 md:hidden rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring select-none"
          aria-label="Beranda Loco Track"
        >
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-xs shadow-2xs shrink-0">
            LT
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold tracking-wider text-foreground uppercase leading-none">
              LOCO TRACK
            </span>
            <span className="text-[11px] font-medium text-muted-foreground leading-none mt-0.5">
              Agency Ops
            </span>
          </div>
        </Link>

        {/* Desktop Workspace Context (visible on md+) */}
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground select-none">
          <span className="font-semibold text-foreground">LOCO TRACK</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-muted-foreground">Workspace</span>
        </div>
      </div>

      {/* Right side utilities: Notification Bell and User Profile Menu */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        <NotificationBell initialData={notificationsFeed ?? fallbackFeed} />
        <UserMenu user={user} compact={true} side="bottom" align="end" />
      </div>
    </header>
  );
}

