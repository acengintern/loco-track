import * as React from "react";
import { requireRole } from "@/lib/supabase/auth";
import { ROUTE_PERMISSIONS } from "@/constants/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getPaginatedUsers } from "@/features/users/queries";
import { UserManagementView } from "@/features/users/components/user-management-view";
import type { UserRole } from "@/lib/supabase/provisioning";

interface UsersPageProps {
  searchParams: Promise<{
    q?: string;
    role?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const profile = await requireRole(ROUTE_PERMISSIONS["/users"]);
  const { q, role, status, page } = await searchParams;

  const currentPage = parseInt(page || "1", 10) || 1;
  const filterRole = role ? (role as UserRole | "ALL") : "ALL";
  const filterStatus = (status as "ALL" | "ACTIVE" | "INACTIVE") || "ALL";

  const paginatedData = await getPaginatedUsers({
    search: q,
    role: filterRole,
    status: filterStatus,
    page: currentPage,
    pageSize: 15,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manajemen Pengguna"
        description="Kelola akun personel agency, peran akses operasional, dan status keaktifan."
      />

      <UserManagementView
        data={paginatedData}
        currentAdminId={profile.id}
        currentSearch={q}
        currentRole={role}
        currentStatus={status}
      />
    </div>
  );
}
