"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut, Settings, ChevronsUpDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/constants/navigation";
import type { UserRole } from "@/lib/supabase/provisioning";
import { cn } from "cn";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface UserMenuProps {
  user: {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
  };
  compact?: boolean;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "LT";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserMenu({
  user,
  compact = false,
  side = "top",
  align = "start",
}: UserMenuProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = React.useState(false);

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
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group flex items-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring data-[open]:bg-accent select-none cursor-pointer",
          compact
            ? "size-10 sm:size-9 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 justify-center p-0"
            : "w-full gap-2.5 p-1.5 text-left text-sm"
        )}
        aria-label="Menu pengguna"
      >
        <Avatar size="sm" className="border border-border shrink-0">
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        {!compact && (
          <>
            <div className="flex flex-col min-w-0 flex-1 leading-tight text-left">
              <span className="truncate text-xs font-semibold text-foreground">
                {user.full_name}
              </span>
              <span className="truncate text-[10px] text-muted-foreground mt-0.5">
                {user.email}
              </span>
            </div>
            <ChevronsUpDown className="size-4 text-muted-foreground/70 shrink-0 group-hover:text-foreground transition-colors ml-auto" />
          </>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side={side}
        align={align}
        sideOffset={8}
        className="w-56 p-1.5 shadow-lg border border-border bg-popover"
      >
        <div className="px-2 py-1.5 border-b border-border/50 mb-1">
          <p className="truncate text-xs font-semibold text-foreground leading-none">
            {user.full_name}
          </p>
          <p className="truncate text-[11px] text-muted-foreground mt-1 leading-none">
            {user.email}
          </p>
          <div className="mt-2">
            <span className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {roleLabel}
            </span>
          </div>
        </div>

        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => router.push("/settings")}
            className="gap-2.5 px-2 py-1.5"
          >
            <Settings className="size-4 text-muted-foreground" />
            <span>Pengaturan Akun</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem
          variant="destructive"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="gap-2.5 px-2 py-1.5"
        >
          <LogOut className="size-4" />
          <span>{isSigningOut ? "Keluar..." : "Keluar"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
