import * as React from "react";
import Link from "next/link";
import { Plus, UserPlus } from "lucide-react";
import { requireActiveProfile } from "@/lib/supabase/auth";
import { DashboardShell } from "@/features/dashboard/components/dashboard-shell";
import { AdminDashboard } from "@/features/dashboard/components/admin-dashboard";
import { CreativeDirectorDashboard } from "@/features/dashboard/components/cd-dashboard";
import { AccountExecutiveDashboard } from "@/features/dashboard/components/ae-dashboard";
import { SmsDashboard } from "@/features/dashboard/components/sms-dashboard";
import { CreativeDashboard } from "@/features/dashboard/components/creative-dashboard";
import {
  getAdminDashboardData,
  getCreativeDirectorDashboardData,
  getAccountExecutiveDashboardData,
  getSmsDashboardData,
  getCreativeDashboardData,
} from "@/features/dashboard/queries";

export default async function DashboardPage() {
  const profile = await requireActiveProfile();

  let content: React.ReactNode = null;

  switch (profile.role) {
    case "ADMIN": {
      const data = await getAdminDashboardData();
      content = <AdminDashboard data={data} />;
      break;
    }
    case "CREATIVE_DIRECTOR": {
      const data = await getCreativeDirectorDashboardData();
      content = <CreativeDirectorDashboard data={data} />;
      break;
    }
    case "ACCOUNT_EXECUTIVE": {
      const data = await getAccountExecutiveDashboardData();
      content = <AccountExecutiveDashboard data={data} />;
      break;
    }
    case "SOCIAL_MEDIA_SPECIALIST": {
      const data = await getSmsDashboardData(profile.id);
      content = <SmsDashboard data={data} />;
      break;
    }
    case "GRAPHIC_DESIGNER":
    case "VIDEO_EDITOR": {
      const data = await getCreativeDashboardData(profile.id);
      content = <CreativeDashboard data={data} />;
      break;
    }
    default: {
      content = (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Peran pengguna tidak dikenali untuk tampilan dashboard operasional.
        </div>
      );
      break;
    }
  }

  let headerAction: React.ReactNode = undefined;

  if (profile.role === "ADMIN") {
    headerAction = (
      <Link
        href="/users?create=true"
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs"
      >
        <UserPlus className="size-3.5" />
        <span>Tambah Pengguna</span>
      </Link>
    );
  } else if (profile.role === "SOCIAL_MEDIA_SPECIALIST") {
    headerAction = (
      <Link
        href="/projects?create=true"
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs"
      >
        <Plus className="size-3.5" />
        <span>Buat Project</span>
      </Link>
    );
  }

  return (
    <DashboardShell
      fullName={profile.fullName}
      role={profile.role}
      action={headerAction}
    >
      {content}
    </DashboardShell>
  );
}
