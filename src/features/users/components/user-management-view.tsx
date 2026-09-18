"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PaginatedUsers, UserListItem } from "../types";
import { UserStatsCards } from "./user-stats-cards";
import { UserFilters } from "./user-filters";
import { UserListTable } from "./user-list-table";
import { UserCreateDialog } from "./user-create-dialog";
import { UserEditDialog } from "./user-edit-dialog";
import { UserStatusDialog } from "./user-status-dialog";
import { UserPasswordDialog } from "./user-password-dialog";

interface UserManagementViewProps {
  data: PaginatedUsers;
  currentAdminId: string;
  currentSearch?: string;
  currentRole?: string;
  currentStatus?: string;
}

export function UserManagementView({
  data,
  currentAdminId,
  currentSearch,
  currentRole,
  currentStatus,
}: UserManagementViewProps) {
  const router = useRouter();

  const [selectedUserForEdit, setSelectedUserForEdit] =
    React.useState<UserListItem | null>(null);
  const [isEditOpen, setIsEditOpen] = React.useState(false);

  const [selectedUserForStatus, setSelectedUserForStatus] =
    React.useState<UserListItem | null>(null);
  const [isStatusOpen, setIsStatusOpen] = React.useState(false);

  const [selectedUserForPassword, setSelectedUserForPassword] =
    React.useState<UserListItem | null>(null);
  const [isPasswordOpen, setIsPasswordOpen] = React.useState(false);

  const handleEdit = (user: UserListItem) => {
    setSelectedUserForEdit(user);
    setIsEditOpen(true);
  };

  const handleToggleStatus = (user: UserListItem) => {
    setSelectedUserForStatus(user);
    setIsStatusOpen(true);
  };

  const handleResetPassword = (user: UserListItem) => {
    setSelectedUserForPassword(user);
    setIsPasswordOpen(true);
  };

  const handleActionSuccess = () => {
    router.refresh();
  };

  const handleGoToPage = (newPage: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(newPage));
    router.push(`/users?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* 1. Global Metrics */}
      <UserStatsCards stats={data.stats} />

      {/* 2. Filter & Search Toolbar + Create Action */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1">
          <UserFilters
            key={currentSearch || "empty"}
            currentSearch={currentSearch}
            currentRole={currentRole}
            currentStatus={currentStatus}
          />
        </div>

        <div className="shrink-0 flex items-center justify-end">
          <UserCreateDialog
            onSuccess={handleActionSuccess}
            trigger={
              <Button size="sm" className="h-8 text-xs gap-1.5 shadow-2xs">
                <UserPlus className="size-3.5" />
                <span>Tambah Pengguna</span>
              </Button>
            }
          />
        </div>
      </div>

      {/* 3. Operational User Data Table */}
      <UserListTable
        users={data.items}
        currentAdminId={currentAdminId}
        onEdit={handleEdit}
        onResetPassword={handleResetPassword}
        onToggleStatus={handleToggleStatus}
      />

      {/* 4. Pagination */}
      {data.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <p className="text-xs text-muted-foreground">
            Halaman {data.page} dari {data.totalPages} ({data.totalCount} total personel)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGoToPage(data.page - 1)}
              disabled={data.page <= 1}
              className="gap-1 text-xs h-8"
            >
              <ChevronLeft className="size-3.5" />
              <span>Sebelumnya</span>
            </Button>
            <div className="text-xs font-medium px-2">
              {data.page} / {data.totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGoToPage(data.page + 1)}
              disabled={data.page >= data.totalPages}
              className="gap-1 text-xs h-8"
            >
              <span>Berikutnya</span>
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Interactive Modal Dialogs */}
      <UserEditDialog
        user={selectedUserForEdit}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onSuccess={handleActionSuccess}
      />

      <UserStatusDialog
        user={selectedUserForStatus}
        open={isStatusOpen}
        onOpenChange={setIsStatusOpen}
        onSuccess={handleActionSuccess}
      />

      <UserPasswordDialog
        user={selectedUserForPassword}
        open={isPasswordOpen}
        onOpenChange={setIsPasswordOpen}
        onSuccess={handleActionSuccess}
      />
    </div>
  );
}
