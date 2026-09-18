"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, LogOut, Settings } from "lucide-react";
import { cn } from "cn";
import { createClient } from "@/lib/supabase/client";
import { ROLE_NAVIGATION, ROLE_LABELS } from "@/constants/navigation";
import type { UserRole } from "@/lib/supabase/provisioning";
import { NavIcon } from "@/components/layout/nav-icon";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface MobileNavigationProps {
  user: {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
  };
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "LT";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function MobileNavigation({ user }: MobileNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  const navItems = ROLE_NAVIGATION[user.role] || [];
  const initials = getInitials(user.full_name);
  const roleLabel = ROLE_LABELS[user.role] ?? user.role;

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login?switch=true");
      router.refresh();
    } catch {
      setIsSigningOut(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent active:bg-accent/80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring md:hidden cursor-pointer transition-colors select-none"
        aria-label="Buka menu navigasi"
      >
        <Menu className="size-5" />
      </SheetTrigger>

      <SheetContent side="left" className="flex w-72 flex-col p-0 bg-card">
        {/* Brand Header */}
        <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold text-xs tracking-wider">
            LT
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold tracking-wider text-foreground uppercase">
              LOCO TRACK
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">
              Agency Workflow
            </span>
          </div>
        </div>

        {/* User / Role Banner */}
        <div className="border-b border-border bg-muted/40 p-4">
          <div className="flex items-center gap-3">
            <Avatar size="default" className="border border-border">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="truncate text-xs font-semibold text-foreground">
                {user.full_name}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                {roleLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Items (44px min height touch target) */}
        <nav
          className="flex-1 space-y-1 p-3 overflow-y-auto"
          aria-label="Navigasi Ponsel"
        >
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive
                    ? "bg-accent text-accent-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <NavIcon
                  name={item.iconName}
                  className={cn(
                    "size-5 shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="border-t border-border p-3 space-y-1">
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Settings className="size-5 shrink-0 text-muted-foreground" />
            <span>Pengaturan Akun</span>
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="flex min-h-[44px] w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <LogOut className="size-5 shrink-0" />
            <span>{isSigningOut ? "Keluar..." : "Keluar"}</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
