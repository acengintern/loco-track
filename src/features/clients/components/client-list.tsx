"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, Building2, ExternalLink, Edit2, Archive, Phone, Mail } from "lucide-react";
import type { ClientWithStats } from "../types";
import type { UserRole } from "@/lib/supabase/provisioning";
import { ClientFormDialog } from "./client-form-dialog";
import { ClientArchiveDialog } from "./client-archive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

interface ClientListProps {
  clients: ClientWithStats[];
  userRole: UserRole;
  searchQuery?: string;
}

export function ClientList({ clients, userRole, searchQuery = "" }: ClientListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState(searchQuery);
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingClient, setEditingClient] = React.useState<ClientWithStats | null>(null);
  const [archivingClient, setArchivingClient] = React.useState<ClientWithStats | null>(null);

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
    router.push(`/clients?${params.toString()}`);
  };

  const handleOpenCreate = () => {
    setEditingClient(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (client: ClientWithStats) => {
    setEditingClient(client);
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Search and Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Cari nama client atau kontak..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs h-9"
          />
        </form>

        {canCreateOrEdit && (
          <Button onClick={handleOpenCreate} size="sm" className="gap-1.5 shrink-0">
            <Plus className="size-4" />
            <span>Tambah Client</span>
          </Button>
        )}
      </div>

      {/* Empty State */}
      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 p-12 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground mb-3">
            <Building2 className="size-5" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            {searchQuery ? "Client tidak ditemukan" : "Belum ada client"}
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
            {searchQuery
              ? `Tidak ada client aktif yang cocok dengan kata kunci "${searchQuery}".`
              : "Daftar direktori perusahaan client agency akan ditampilkan di sini."}
          </p>
          {canCreateOrEdit && !searchQuery && (
            <div className="mt-4">
              <Button onClick={handleOpenCreate} size="sm" variant="outline" className="gap-1.5">
                <Plus className="size-4" />
                <span>Buat Client Pertama</span>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-hidden rounded-lg border border-border bg-card shadow-2xs">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs border-collapse min-w-[950px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                    <th className="py-2.5 px-4 font-medium w-[240px] min-w-[200px]">Perusahaan Client</th>
                    <th className="py-2.5 px-4 font-medium w-[180px] min-w-[150px]">Kontak Utama</th>
                    <th className="py-2.5 px-4 font-medium w-[200px] min-w-[180px]">Email / Telepon</th>
                    <th className="py-2.5 px-4 font-medium text-center w-[90px] min-w-[80px] whitespace-nowrap">Brand</th>
                    <th className="py-2.5 px-4 font-medium text-center w-[90px] min-w-[80px] whitespace-nowrap">Status</th>
                    <th className="py-2.5 px-4 font-medium w-[140px] min-w-[120px] whitespace-nowrap">Diperbarui</th>
                    <th className="py-2.5 px-4 font-medium text-right w-[100px] min-w-[90px] whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-border/60">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-accent/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">
                        <Link
                          href={`/clients/${client.id}`}
                          className="hover:underline flex items-center gap-1.5"
                        >
                          <span>{client.name}</span>
                          <ExternalLink className="size-3 text-muted-foreground" />
                        </Link>
                      </div>
                      {client.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-xs mt-0.5">
                          {client.description}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-medium">
                      {client.contact_name || <span className="text-muted-foreground/50">-</span>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        {client.contact_email && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Mail className="size-3 shrink-0" />
                            <span className="truncate max-w-[150px]">{client.contact_email}</span>
                          </div>
                        )}
                        {client.contact_phone && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Phone className="size-3 shrink-0" />
                            <span>{client.contact_phone}</span>
                          </div>
                        )}
                        {!client.contact_email && !client.contact_phone && (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">
                        {client.brands_count ?? 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                          client.is_active
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-muted text-muted-foreground border border-border"
                        }`}
                      >
                        {client.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-[11px]">
                      {new Date(client.updated_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        {canCreateOrEdit && (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleOpenEdit(client)}
                                  aria-label={`Edit ${client.name}`}
                                >
                                  <Edit2 className="size-3.5 text-muted-foreground hover:text-foreground" />
                                </Button>
                              }
                            />
                            <TooltipContent side="top">
                              Edit data client
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
                                  onClick={() => setArchivingClient(client)}
                                  aria-label={`Arsipkan ${client.name}`}
                                  className="text-destructive/70 hover:text-destructive"
                                >
                                  <Archive className="size-3.5" />
                                </Button>
                              }
                            />
                            <TooltipContent side="top">
                              Arsipkan client
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
          <div className="space-y-3 md:hidden">
            {clients.map((client) => (
              <div
                key={client.id}
                className="rounded-lg border border-border bg-card p-4 space-y-3 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/clients/${client.id}`}
                      className="font-semibold text-sm text-foreground hover:underline flex items-center gap-1.5"
                    >
                      <span>{client.name}</span>
                      <ExternalLink className="size-3.5 text-muted-foreground" />
                    </Link>
                    {client.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {client.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                      client.is_active
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-muted text-muted-foreground border border-border"
                    }`}
                  >
                    {client.is_active ? "Aktif" : "Nonaktif"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-t border-border/60 pt-2 text-muted-foreground">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 block">
                      Kontak
                    </span>
                    <span>{client.contact_name || "-"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground/70 block">
                      Brand Terdaftar
                    </span>
                    <span>{client.brands_count ?? 0} Brand</span>
                  </div>
                </div>

                {(client.contact_email || client.contact_phone) && (
                  <div className="text-xs space-y-1 bg-muted/30 p-2 rounded-md">
                    {client.contact_email && (
                      <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                        <Mail className="size-3 text-muted-foreground/70" />
                        <span className="truncate">{client.contact_email}</span>
                      </div>
                    )}
                    {client.contact_phone && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="size-3 text-muted-foreground/70" />
                        <span>{client.contact_phone}</span>
                      </div>
                    )}
                  </div>
                )}

                {(canCreateOrEdit || canArchive) && (
                  <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-2">
                    {canCreateOrEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(client)}
                        className="gap-1 text-xs h-8"
                      >
                        <Edit2 className="size-3.5" />
                        <span>Edit</span>
                      </Button>
                    )}
                    {canArchive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setArchivingClient(client)}
                        className="gap-1 text-xs h-8 text-destructive border-destructive/20 hover:bg-destructive/10"
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
      <ClientFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        clientToEdit={editingClient}
        onSuccess={() => {
          router.refresh();
        }}
      />

      <ClientArchiveDialog
        open={Boolean(archivingClient)}
        onOpenChange={(open) => {
          if (!open) setArchivingClient(null);
        }}
        client={archivingClient}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
