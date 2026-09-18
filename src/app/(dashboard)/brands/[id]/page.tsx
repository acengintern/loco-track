import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, FolderKanban, Calendar, ExternalLink } from "lucide-react";
import { requireRole } from "@/lib/supabase/auth";
import { ROUTE_PERMISSIONS } from "@/constants/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getBrandById } from "@/features/brands/queries";
import { buttonVariants } from "@/components/ui/button";

interface BrandDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function BrandDetailPage({ params }: BrandDetailPageProps) {
  await requireRole(ROUTE_PERMISSIONS["/brands"]);
  const { id } = await params;

  const brand = await getBrandById(id);
  if (!brand) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/brands"
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className: "gap-2 text-sm text-muted-foreground hover:text-foreground pl-0 mb-3",
          })}
        >
          <ArrowLeft className="size-4" />
          <span>Kembali ke Direktori Brand</span>
        </Link>

        <PageHeader
          title={brand.name}
          description={brand.description || "Informasi profil brand dan lini produk."}
        >
          <span className="font-mono text-xs font-semibold bg-muted px-2.5 py-1 rounded border border-border">
            Kode: {brand.code}
          </span>
        </PageHeader>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:gap-7 lg:grid-cols-3">
        {/* Left 2 Cols: Projects for this brand */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border border-border bg-card p-6 sm:p-7 space-y-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-semibold text-foreground">
                Riwayat Project ({brand.projects.length})
              </h2>
            </div>

            {brand.projects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/80 p-10 text-center text-sm text-muted-foreground">
                <FolderKanban className="mx-auto size-8 text-muted-foreground/60 mb-2.5" />
                <p className="font-semibold text-foreground text-base">Belum ada project untuk brand ini</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Project baru yang menggunakan brand ini akan otomatis terhubung ke histori ini.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {brand.projects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between py-3.5 sm:py-4 first:pt-0 last:pb-0"
                  >
                    <div>
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-semibold text-sm sm:text-base text-foreground hover:underline flex items-center gap-1.5"
                      >
                        <span>{project.name}</span>
                        <ExternalLink className="size-3.5 text-muted-foreground" />
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xs text-foreground font-semibold bg-muted px-2 py-0.5 rounded border border-border">
                          {project.project_code}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Deadline:{" "}
                          {new Date(project.deadline).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    <span className="inline-flex items-center rounded-md px-2.5 py-0.5 font-mono text-xs font-semibold bg-muted text-foreground border border-border">
                      {project.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Brand Metadata */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-6 sm:p-7 space-y-5 shadow-2xs">
            <h2 className="text-base sm:text-lg font-semibold text-foreground">
              Entitas Perusahaan
            </h2>

            <div className="space-y-3.5 text-sm">
              <div>
                <span className="text-[11px] uppercase font-semibold text-muted-foreground/70 block mb-1">
                  Klien Pemilik
                </span>
                <Link
                  href={`/clients/${brand.client.id}`}
                  className="font-medium text-foreground hover:underline flex items-center gap-2 text-sm sm:text-base"
                >
                  <Building2 className="size-4 text-muted-foreground" />
                  <span>{brand.client.name}</span>
                </Link>
              </div>

              <div>
                <span className="text-[11px] uppercase font-semibold text-muted-foreground/70 block mb-1">
                  Kode Awalan
                </span>
                <span className="font-mono font-semibold text-foreground text-sm">
                  {brand.code}
                </span>
              </div>

              <div className="border-t border-border/60 pt-3.5">
                <span className="text-[11px] uppercase font-semibold text-muted-foreground/70 block mb-1">
                  Tanggal Didaftarkan
                </span>
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Calendar className="size-4" />
                  <span>
                    {new Date(brand.created_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
