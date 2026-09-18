"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { ROLE_NAVIGATION } from "@/constants/navigation";
import type { UserRole } from "@/lib/supabase/provisioning";
import { NavIcon } from "@/components/layout/nav-icon";
import { UserMenu } from "@/components/layout/user-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

interface AppSidebarProps {
  user: {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
  };
}

const STORAGE_KEY = "locotrack_sidebar_collapsed";

const sidebarListeners = new Set<() => void>();

function subscribeSidebar(callback: () => void) {
  sidebarListeners.add(callback);
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      callback();
    }
  };
  window.addEventListener("storage", handleStorage);
  return () => {
    sidebarListeners.delete(callback);
    window.removeEventListener("storage", handleStorage);
  };
}

function getSidebarSnapshot(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function getSidebarServerSnapshot(): boolean {
  return false;
}

function setSidebarCollapsed(next: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // Ignore localStorage write errors
  }
  sidebarListeners.forEach((listener) => listener());
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const navItems = ROLE_NAVIGATION[user.role] || [];

  const isCollapsed = React.useSyncExternalStore(
    subscribeSidebar,
    getSidebarSnapshot,
    getSidebarServerSnapshot
  );

  const toggleCollapse = () => {
    setSidebarCollapsed(!isCollapsed);
  };

  const effectiveCollapsed = isCollapsed;

  return (
    <aside
      className={cn(
        "hidden md:flex md:flex-col md:shrink-0 border-r border-border bg-card select-none transition-[width] duration-200 ease-in-out sticky top-0 h-screen max-h-screen z-30",
        effectiveCollapsed ? "md:w-[72px]" : "md:w-64"
      )}
      aria-label="Sidebar Navigasi"
    >
      {/* Brand Header */}
      <div
        className={cn(
          "flex h-14 items-center border-b border-border px-3.5",
          effectiveCollapsed ? "justify-center" : "justify-between"
        )}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
          aria-label="Beranda LOCO TRACK"
        >
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold text-xs tracking-wider shrink-0">
            LT
          </div>
          {!effectiveCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold tracking-wider text-foreground uppercase truncate">
                LOCO TRACK
              </span>
              <span className="text-[10px] text-muted-foreground font-medium truncate">
                Agency Workflow
              </span>
            </div>
          )}
        </Link>

        {/* Desktop Collapse / Expand Toggle Button */}
        {!effectiveCollapsed ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={toggleCollapse}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Tutup sidebar"
                >
                  <PanelLeftClose className="size-4" />
                </button>
              }
            />
            <TooltipContent side="right" sideOffset={8}>
              Tutup sidebar
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      {/* Collapse Trigger when Collapsed (Top Bar Icon) */}
      {effectiveCollapsed && (
        <div className="flex justify-center py-1.5 border-b border-border/40">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={toggleCollapse}
                  className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Buka sidebar"
                >
                  <PanelLeftOpen className="size-4" />
                </button>
              }
            />
            <TooltipContent side="right" sideOffset={12}>
              Buka sidebar
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Navigation Links */}
      <nav
        className="flex-1 space-y-1 p-2.5 overflow-y-auto"
        aria-label="Menu Utama"
      >
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

          const linkElement = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center rounded-md text-xs font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                effectiveCollapsed
                  ? "size-10 justify-center p-0 mx-auto"
                  : "gap-3 px-3 py-2",
                isActive
                  ? "bg-accent text-accent-foreground font-semibold shadow-2xs"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
              aria-label={effectiveCollapsed ? item.title : undefined}
            >
              <NavIcon
                name={item.iconName}
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              {!effectiveCollapsed && (
                <span className="truncate">{item.title}</span>
              )}
            </Link>
          );

          if (effectiveCollapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger render={linkElement} />
                <TooltipContent side="right" sideOffset={12}>
                  {item.title}
                </TooltipContent>
              </Tooltip>
            );
          }

          return linkElement;
        })}
      </nav>

      {/* User Menu Footer */}
      <div
        className={cn(
          "mt-auto shrink-0 border-t border-border p-3 bg-card",
          effectiveCollapsed && "flex justify-center p-2"
        )}
      >
        {effectiveCollapsed ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <div className="flex justify-center">
                  <UserMenu
                    user={user}
                    compact={true}
                    side="right"
                    align="end"
                  />
                </div>
              }
            />
            <TooltipContent side="right" sideOffset={12}>
              <p className="font-semibold text-foreground">{user.full_name}</p>
              <p className="text-[11px] text-muted-foreground">{user.email}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <UserMenu user={user} />
        )}
      </div>
    </aside>
  );
}
