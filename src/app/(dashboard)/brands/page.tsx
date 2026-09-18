import * as React from "react";
import { requireRole } from "@/lib/supabase/auth";
import { ROUTE_PERMISSIONS } from "@/constants/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectSubnav } from "@/components/layout/project-subnav";
import { getBrands, getActiveClientsForBrandSelection } from "@/features/brands/queries";
import { BrandList } from "@/features/brands/components/brand-list";

interface BrandsPageProps {
  searchParams: Promise<{
    q?: string;
  }>;
}

export default async function BrandsPage({ searchParams }: BrandsPageProps) {
  const profile = await requireRole(ROUTE_PERMISSIONS["/brands"]);
  const { q } = await searchParams;

  const [brands, clients] = await Promise.all([
    getBrands({ search: q }),
    getActiveClientsForBrandSelection(),
  ]);

  return (
    <div className="space-y-6">
      <ProjectSubnav current="brands" role={profile.role} />

      <PageHeader
        title="Direktori Brand"
        description="Kelola merek atau produk klien beserta kode unik identifikasi project."
      />

      <BrandList
        brands={brands}
        clients={clients}
        userRole={profile.role}
        searchQuery={q}
      />
    </div>
  );
}
