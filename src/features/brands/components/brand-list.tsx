"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, Tag, ExternalLink, Edit2, Archive, Building2 } from "lucide-react";
import type { BrandWithRelations } from "../types";
import type { UserRole } from "@/lib/supabase/provisioning";
import { BrandFormDialog } from "./brand-form-dialog";
import { BrandArchiveDialog } from "./brand-archive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

interface BrandListProps {
  brands: BrandWithRelations[];
  clients: Array<{ id: string; name: string }>;
  userRole: UserRole;
  searchQuery?: string;
}

export function BrandList({ brands, clients, userRole, searchQuery = "" }: BrandListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState(searchQuery);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingBrand, setEditingBrand] = React.useState<BrandWithRelations | null>(null);
  const [archivingBrand, setArchivingBrand] = React.useState<BrandWithRelations | null>(null);

  const canCreateOrEdit = userRole === "ADMIN" || userRole === "SOCIAL_MEDIA_SPECIALIST";
  const canArchive = userRole === "ADMIN";

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (search.trim()) {
      params.set("q", search.trim());
    } else {
      params.delete("q");
    }
    router.push(`/brands?${params.toString()}`);
  };

  const handleOpenCreate = () => {
    setEditingBrand(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (brand: BrandWithRelations) => {
    setEditingBrand(brand);
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Search and Action Bar */}
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Cari nama atau kode brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9.5 text-sm h-10"
          />
        </form>

        {canCreateOrEdit && (
          <Button onClick={handleOpenCreate} size="sm" className="gap-2 shrink-0 h-10 px-4 text-sm">
            <Plus className="size-4" />
            <span>Tambah Brand</span>
          </Button>
        )}
      </div>

      {/* Empty State */}
      {brands.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 p-12 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground mb-3">
            <Tag className="size-5" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            {searchQuery ? "Brand tidak ditemukan" : "Belum ada brand"}
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
            {searchQuery
              ? `Tidak ada brand yang cocok dengan kata kunci "${searchQuery}".`
              : "Daftar merek atau lini produk klien agency akan muncul di sini."}
          </p>
          {canCreateOrEdit && !searchQuery && (
            <div className="mt-4">
              <Button onClick={handleOpenCreate} size="sm" variant="outline" className="gap-2 h-10 px-4 text-sm">
                <Plus className="size-4" />
                <span>Buat Brand Pertama</span>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-hidden rounded-lg border border-border bg-card shadow-2xs">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-sm border-collapse min-w-[950px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                    <th className="py-3.5 px-4 font-semibold text-sm w-[240px] min-w-[200px]">Brand & Kode</th>
                    <th className="py-3.5 px-4 font-semibold text-sm w-[220px] min-w-[180px]">Klien Pemilik</th>
                    <th className="py-3.5 px-4 font-semibold text-sm min-w-[200px]">Deskripsi</th>
                    <th className="py-3.5 px-4 font-semibold text-sm text-center w-[120px] min-w-[100px] whitespace-nowrap">Project Aktif</th>
                    <th className="py-3.5 px-4 font-semibold text-sm w-[140px] min-w-[120px] whitespace-nowrap">Dibuat</th>
                    <th className="py-3.5 px-4 font-semibold text-sm text-right w-[100px] min-w-[90px] whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-border/60">
                {brands.map((brand) => (
                  <tr key={brand.id} className="hover:bg-accent/30 transition-colors text-sm">
                    <td className="py-3.5 sm:py-4 px-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/brands/${brand.id}`}
                          className="font-semibold text-foreground text-sm sm:text-[15px] hover:underline flex items-center gap-1.5"
                        >
                          <span>{brand.name}</span>
                          <ExternalLink className="size-3.5 text-muted-foreground" />
                        </Link>
                        <span className="inline-flex items-center rounded bg-muted/80 px-2 py-0.5 font-mono text-xs font-semibold text-foreground border border-border">
                          {brand.code}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 sm:py-4 px-4">
                      <Link
                        href={`/clients/${brand.client_id}`}
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 hover:underline font-medium text-sm"
                      >
                        <Building2 className="size-3.5 text-muted-foreground/70" />
                        <span>{brand.client_name}</span>
                      </Link>
                    </td>
                    <td className="py-3.5 sm:py-4 px-4 text-muted-foreground max-w-xs">
                      <span className="line-clamp-1">{brand.description || "-"}</span>
                    </td>
                    <td className="py-3.5 sm:py-4 px-4 text-center">
                      <span className="inline-flex items-center justify-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
                        {brand.projects_count ?? 0}
                      </span>
                    </td>
                    <td className="py-3.5 sm:py-4 px-4 text-muted-foreground text-xs">
                      {new Date(brand.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3.5 sm:py-4 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        {canCreateOrEdit && (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleOpenEdit(brand)}
                                  aria-label={`Edit ${brand.name}`}
                                >
                                  <Edit2 className="size-4 text-muted-foreground hover:text-foreground" />
                                </Button>
                              }
                            />
                            <TooltipContent side="top">
                              Edit brand
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {canArchive && (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => setArchivingBrand(brand)}
                                  aria-label={`Arsipkan ${brand.name}`}
                                  className="text-destructive/70 hover:text-destructive"
                                >
                                  <Archive className="size-4" />
                                </Button>
                              }
                            />
                            <TooltipContent side="top">
                              Arsipkan brand
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* Mobile Reflow Stack (<768px) */}
          <div className="space-y-3.5 md:hidden">
            {brands.map((brand) => (
              <div
                key={brand.id}
                className="rounded-lg border border-border bg-card p-4 sm:p-5 space-y-3.5 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/brands/${brand.id}`}
                        className="font-semibold text-sm sm:text-base text-foreground hover:underline flex items-center gap-1.5"
                      >
                        <span>{brand.name}</span>
                        <ExternalLink className="size-3.5 text-muted-foreground" />
                      </Link>
                      <span className="inline-flex items-center rounded bg-muted/80 px-2 py-0.5 font-mono text-xs font-semibold text-foreground border border-border">
                        {brand.code}
                      </span>
                    </div>
                    {brand.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {brand.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-t border-border/60 pt-3 text-muted-foreground">
                  <div>
                    <span className="text-[11px] uppercase font-semibold text-muted-foreground/70 block">
                      Client
                    </span>
                    <Link
                      href={`/clients/${brand.client_id}`}
                      className="hover:underline text-foreground font-medium truncate block mt-0.5"
                    >
                      {brand.client_name}
                    </Link>
                  </div>
                  <div>
                    <span className="text-[11px] uppercase font-semibold text-muted-foreground/70 block">
                      Project Aktif
                    </span>
                    <span className="text-foreground font-medium block mt-0.5">{brand.projects_count ?? 0} Project</span>
                  </div>
                </div>

                {(canCreateOrEdit || canArchive) && (
                  <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
                    {canCreateOrEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(brand)}
                        className="gap-1.5 text-xs h-9 px-3"
                      >
                        <Edit2 className="size-3.5" />
                        <span>Edit</span>
                      </Button>
                    )}
                    {canArchive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setArchivingBrand(brand)}
                        className="gap-1.5 text-xs h-9 px-3 text-destructive border-destructive/20 hover:bg-destructive/10"
                      >
                        <Archive className="size-3.5" />
                        <span>Arsipkan</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Dialogs */}
      <BrandFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        brandToEdit={editingBrand}
        clients={clients}
        onSuccess={() => {
          router.refresh();
        }}
      />

      <BrandArchiveDialog
        open={Boolean(archivingBrand)}
        onOpenChange={(open) => {
          if (!open) setArchivingBrand(null);
        }}
        brand={archivingBrand}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
