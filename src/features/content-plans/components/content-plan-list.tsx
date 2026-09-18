"use client";

import * as React from "react";
import type { ContentPlanDetail } from "../types";
import { ContentPlanFormDialog } from "./content-plan-form-dialog";
import {
  Calendar,
  Edit3,
  Layers,
  Plus,
  Search,
  Tag,
} from "lucide-react";

interface ContentPlanListProps {
  projectId: string;
  projectStatus: string;
  contentPlans: ContentPlanDetail[];
  canManage: boolean;
}

export function ContentPlanList({
  projectId,
  projectStatus,
  contentPlans,
  canManage,
}: ContentPlanListProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<ContentPlanDetail | null>(null);

  const isProductionLocked = [
    "PRODUCTION",
    "INTERNAL_QC",
    "CLIENT_REVIEW",
    "APPROVED",
    "PUBLISHED",
    "DONE",
  ].includes(projectStatus);

  const filteredPlans = React.useMemo(() => {
    if (!searchTerm.trim()) return contentPlans;
    const term = searchTerm.toLowerCase().trim();
    return contentPlans.filter(
      (cp) =>
        cp.title.toLowerCase().includes(term) ||
        cp.channel.toLowerCase().includes(term) ||
        (cp.pillar && cp.pillar.toLowerCase().includes(term))
    );
  }, [contentPlans, searchTerm]);

  const handleCreate = () => {
    setEditingItem(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (item: ContentPlanDetail) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari judul, channel, atau pillar..."
            className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {canManage && (
          <button
            type="button"
            onClick={handleCreate}
            disabled={isProductionLocked}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              isProductionLocked
                ? "Content plan terkunci karena project telah masuk tahap produksi"
                : "Tambah Content Plan"
            }
          >
            <Plus className="size-3.5" />
            <span>Tambah Konten</span>
          </button>
        )}
      </div>

      {/* Empty State */}
      {filteredPlans.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center shadow-2xs">
          <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
            <Layers className="size-5" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            {searchTerm ? "Konten tidak ditemukan." : "Belum ada rencana konten."}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
            {searchTerm
              ? "Coba gunakan kata kunci pencarian lain."
              : canManage
              ? "Susun daftar konten, channel publikasi, dan jadwal posting untuk project ini."
              : "Penanggung jawab project belum menambahkan jadwal konten."}
          </p>

          {!searchTerm && canManage && !isProductionLocked && (
            <div className="mt-5">
              <button
                type="button"
                onClick={handleCreate}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs"
              >
                <Plus className="size-3.5" />
                <span>Tambah Konten Pertama</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Desktop Table */}
          <div className="hidden md:block rounded-lg border border-border bg-card shadow-2xs overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Judul Konten</th>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Jadwal Posting</th>
                    <th className="px-4 py-3">Pillar</th>
                    <th className="px-4 py-3">Status</th>
                    {canManage && <th className="px-4 py-3 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredPlans.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground max-w-xs">
                        <div className="truncate font-semibold">{item.title}</div>
                        {item.copy_draft && (
                          <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                            {item.copy_draft}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium bg-muted border border-border text-foreground">
                          {item.channel}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="size-3 text-muted-foreground" />
                          <span>
                            {new Date(item.planned_post_date).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.pillar ? (
                          <span className="inline-flex items-center gap-1">
                            <Tag className="size-3" />
                            <span>{item.pillar}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                            item.status === "APPROVED"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleEdit(item)}
                            disabled={isProductionLocked}
                            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Edit konten"
                          >
                            <Edit3 className="size-3.5" />
                            <span className="sr-only">Edit</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredPlans.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border bg-card p-4 space-y-2.5 shadow-2xs text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-foreground leading-snug">{item.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center rounded px-1.5 py-0.2 text-[10px] font-medium bg-muted border border-border text-foreground">
                        {item.channel}
                      </span>
                      {item.pillar && (
                        <span className="text-[11px] text-muted-foreground">#{item.pillar}</span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold border shrink-0 ${
                      item.status === "APPROVED"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                {item.copy_draft && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 bg-muted/20 p-2 rounded border border-border/40">
                    {item.copy_draft}
                  </p>
                )}

                <div className="flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-mono">
                    <Calendar className="size-3" />
                    <span>
                      {new Date(item.planned_post_date).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      disabled={isProductionLocked}
                      className="inline-flex items-center gap-1 text-primary hover:underline font-medium disabled:opacity-40"
                    >
                      <Edit3 className="size-3" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ContentPlanFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        projectId={projectId}
        initialData={editingItem}
      />
    </div>
  );
}
