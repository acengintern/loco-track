"use client";

import * as React from "react";
import {
  MoreHorizontal,
  Edit2,
  KeyRound,
  UserX,
  UserCheck,
  Shield,
  Clock,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS } from "@/constants/navigation";
import type { UserRole } from "@/lib/supabase/provisioning";
import type { UserListItem } from "../types";

interface UserListTableProps {
  users: UserListItem[];
  currentAdminId: string;
  onEdit: (user: UserListItem) => void;
  onResetPassword: (user: UserListItem) => void;
  onToggleStatus: (user: UserListItem) => void;
}

const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  ADMIN: "border-border bg-muted text-foreground font-semibold",
  CREATIVE_DIRECTOR: "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300",
  ACCOUNT_EXECUTIVE: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  SOCIAL_MEDIA_SPECIALIST: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  GRAPHIC_DESIGNER: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  VIDEO_EDITOR: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

export function UserListTable({
  users,
  currentAdminId,
  onEdit,
  onResetPassword,
  onToggleStatus,
}: UserListTableProps) {
  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground mb-3">
          <Shield className="size-5" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">
          Tidak ada personel yang sesuai kriteria pencarian.
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Coba sesuaikan kata kunci pencarian atau reset filter peran dan status.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Desktop & Tablet Table */}
      <div className="hidden md:block rounded-lg border border-border bg-card shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                <th className="py-3 px-4 font-medium">Personel</th>
                <th className="py-3 px-4 font-medium">Peran Akses</th>
                <th className="py-3 px-4 font-medium">Status Akun</th>
                <th className="py-3 px-4 font-medium">Terdaftar</th>
                <th className="py-3 px-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {users.map((user) => {
                const isSelf = user.id === currentAdminId;
                const initials = user.fullName
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                const formattedDate = new Date(user.createdAt).toLocaleDateString(
                  "id-ID",
                  {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }
                );

                return (
                  <tr
                    key={user.id}
                    className={cn(
                      "hover:bg-muted/40 transition-colors",
                      !user.isActive && "bg-muted/20 opacity-75"
                    )}
                  >
                    {/* Personel Name & Email */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-foreground truncate">
                              {user.fullName}
                            </span>
                            {user.username && (
                              <span className="font-mono text-[11px] text-primary/80">
                                @{user.username}
                              </span>
                            )}
                            {isSelf && (
                              <span className="rounded bg-primary/15 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                                Anda
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground truncate block">
                            {user.email}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3 px-4">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
                          ROLE_BADGE_STYLES[user.role] || "border-border bg-muted"
                        )}
                      >
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      {user.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          <span>Aktif</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
                          <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                          <span>Nonaktif</span>
                        </span>
                      )}
                    </td>

                    {/* Registration Date */}
                    <td className="py-3 px-4 text-muted-foreground tabular-nums">
                      {formattedDate}
                    </td>

                    {/* Actions Menu */}
                    <td className="py-3 px-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-foreground"
                              aria-label={`Opsi untuk ${user.fullName}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-48 text-xs">
                          <DropdownMenuItem
                            onClick={() => onEdit(user)}
                            className="gap-2 cursor-pointer"
                          >
                            <Edit2 className="size-3.5" />
                            <span>Edit Profil & Peran</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => onResetPassword(user)}
                            className="gap-2 cursor-pointer"
                          >
                            <KeyRound className="size-3.5" />
                            <span>Atur Ulang Sandi</span>
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          {!isSelf && (
                            <DropdownMenuItem
                              onClick={() => onToggleStatus(user)}
                              className={cn(
                                "gap-2 cursor-pointer",
                                user.isActive
                                  ? "text-destructive focus:text-destructive"
                                  : "text-emerald-600 focus:text-emerald-600 dark:text-emerald-400"
                              )}
                            >
                              {user.isActive ? (
                                <>
                                  <UserX className="size-3.5" />
                                  <span>Nonaktifkan Akun</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className="size-3.5" />
                                  <span>Aktifkan Akun</span>
                                </>
                              )}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card Reflow (<768px) */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {users.map((user) => {
          const isSelf = user.id === currentAdminId;
          const initials = user.fullName
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();

          const formattedDate = new Date(user.createdAt).toLocaleDateString(
            "id-ID",
            {
              day: "numeric",
              month: "short",
              year: "numeric",
            }
          );

          return (
            <div
              key={user.id}
              className={cn(
                "rounded-lg border border-border bg-card p-4 shadow-2xs space-y-3",
                !user.isActive && "bg-muted/20 opacity-80"
              )}
            >
              {/* Header: User identity & Status */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    {initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-semibold text-foreground">
                        {user.fullName}
                      </h4>
                      {isSelf && (
                        <span className="rounded bg-primary/15 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                          Anda
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Mail className="size-3 shrink-0" />
                      <span className="truncate">{user.email}</span>
                    </p>
                  </div>
                </div>

                {/* Status indicator */}
                {user.isActive ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    <span>Aktif</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                    <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                    <span>Nonaktif</span>
                  </span>
                )}
              </div>

              {/* Meta: Role and Registration Date */}
              <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2.5 text-[11px]">
                <span
                  className={cn(
                    "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium",
                    ROLE_BADGE_STYLES[user.role] || "border-border bg-muted"
                  )}
                >
                  {ROLE_LABELS[user.role] || user.role}
                </span>

                <span className="text-muted-foreground flex items-center gap-1 tabular-nums">
                  <Clock className="size-3" />
                  <span>{formattedDate}</span>
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(user)}
                  className="flex-1 h-8 text-xs gap-1"
                >
                  <Edit2 className="size-3" />
                  <span>Edit</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onResetPassword(user)}
                  className="flex-1 h-8 text-xs gap-1"
                >
                  <KeyRound className="size-3" />
                  <span>Sandi</span>
                </Button>

                {!isSelf && (
                  <Button
                    variant={user.isActive ? "destructive" : "secondary"}
                    size="sm"
                    onClick={() => onToggleStatus(user)}
                    className="h-8 text-xs px-2.5"
                    title={user.isActive ? "Nonaktifkan akun" : "Aktifkan akun"}
                  >
                    {user.isActive ? (
                      <UserX className="size-3.5" />
                    ) : (
                      <UserCheck className="size-3.5" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
