import * as React from "react";
import { requireRole } from "@/lib/supabase/auth";
import { ROUTE_PERMISSIONS } from "@/constants/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectSubnav } from "@/components/layout/project-subnav";
import { getClients } from "@/features/clients/queries";
import { ClientList } from "@/features/clients/components/client-list";

interface ClientsPageProps {
  searchParams: Promise<{
    q?: string;
  }>;
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const profile = await requireRole(ROUTE_PERMISSIONS["/clients"]);
  const { q } = await searchParams;

  const clients = await getClients({ search: q });

  return (
    <div className="space-y-6">
      <ProjectSubnav current="clients" role={profile.role} />

      <PageHeader
        title="Direktori Client"
        description="Kelola daftar entitas perusahaan client dan kontak penanggung jawab agency."
      />

      <ClientList clients={clients} userRole={profile.role} searchQuery={q} />
    </div>
  );
}
