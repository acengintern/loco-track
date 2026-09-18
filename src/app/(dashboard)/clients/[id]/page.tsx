import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Tag, Mail, Phone, Calendar } from "lucide-react";
import { requireRole } from "@/lib/supabase/auth";
import { ROUTE_PERMISSIONS } from "@/constants/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getClientById } from "@/features/clients/queries";
import { Button } from "@/components/ui/button";

interface ClientDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  await requireRole(ROUTE_PERMISSIONS["/clients"]);
  const { id } = await params;

  const client = await getClientById(id);
  if (!client) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          nativeButton={false}
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground pl-0 mb-3"
          render={<Link href="/clients" />}
        >
          <ArrowLeft className="size-3.5" />
          <span>Kembali ke Direktori Client</span>
        </Button>

        <PageHeader
          title={client.name}
          description={client.description || "Profil entitas client perusahaan."}
        >
          <span
            className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${
              client.is_active
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-muted text-muted-foreground border border-border"
            }`}
          >
            {client.is_active ? "Client Aktif" : "Client Nonaktif"}
          </span>
        </PageHeader>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Brand List */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Daftar Brand ({client.brands.length})
              </h2>
            </div>

            {client.brands.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/80 p-8 text-center text-xs text-muted-foreground">
                <Tag className="mx-auto size-6 text-muted-foreground/60 mb-2" />
                <p className="font-medium text-foreground">Belum ada brand terdaftar</p>
                <p className="mt-0.5">
                  Client ini belum memiliki brand produk atau lini kampanye yang terhubung.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {client.brands.map((brand) => (
                  <div
                    key={brand.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <Link
                        href={`/brands/${brand.id}`}
                        className="font-semibold text-xs text-foreground hover:underline"
                      >
                        {brand.name}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[11px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.2 rounded">
                          {brand.code}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Ditambahkan{" "}
                          {new Date(brand.created_at).toLocaleDateString("id-ID", {
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${
                        brand.is_active
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {brand.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Client Metadata */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5 space-y-4 shadow-2xs">
            <h2 className="text-sm font-semibold text-foreground">
              Informasi Kontak
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 block mb-0.5">
                  Kontak Utama
                </span>
                <span className="font-medium text-foreground">
                  {client.contact_name || <span className="text-muted-foreground/60">-</span>}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 block mb-0.5">
                  Email
                </span>
                {client.contact_email ? (
                  <a
                    href={`mailto:${client.contact_email}`}
                    className="flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <Mail className="size-3.5" />
                    <span>{client.contact_email}</span>
                  </a>
                ) : (
                  <span className="text-muted-foreground/60">-</span>
                )}
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 block mb-0.5">
                  Nomor Telepon
                </span>
                {client.contact_phone ? (
                  <a
                    href={`tel:${client.contact_phone}`}
                    className="flex items-center gap-1.5 text-foreground hover:underline"
                  >
                    <Phone className="size-3.5 text-muted-foreground" />
                    <span>{client.contact_phone}</span>
                  </a>
                ) : (
                  <span className="text-muted-foreground/60">-</span>
                )}
              </div>

              <div className="border-t border-border/60 pt-3">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 block mb-0.5">
                  Tanggal Didaftarkan
                </span>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="size-3.5" />
                  <span>
                    {new Date(client.created_at).toLocaleDateString("id-ID", {
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
