"use client";

import * as React from "react";
import type { ScriptWithRelations } from "../types";
import { ScriptFormDialog } from "./script-form-dialog";
import { ScriptViewDialog } from "./script-view-dialog";
import {
  Edit3,
  Eye,
  FileText,
  Layers,
  Plus,
  Search,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

interface ScriptListProps {
  projectId: string;
  projectStatus: string;
  scripts: ScriptWithRelations[];
  availableContentPlans?: {
    id: string;
    title: string;
    channel: string;
  }[];
  canManage: boolean;
  scriptNotRequired?: boolean;
}

export function ScriptList({
  projectId,
  projectStatus,
  scripts,
  availableContentPlans = [],
  canManage,
  scriptNotRequired = false,
}: ScriptListProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isFormDialogOpen, setIsFormDialogOpen] = React.useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = React.useState(false);
  const [selectedScript, setSelectedScript] = React.useState<ScriptWithRelations | null>(null);

  const isProductionLocked = [
    "PRODUCTION",
    "INTERNAL_QC",
    "CLIENT_REVIEW",
    "APPROVED",
    "PUBLISHED",
    "DONE",
  ].includes(projectStatus);

  const filteredScripts = React.useMemo(() => {
    if (!searchTerm.trim()) return scripts;
    const term = searchTerm.toLowerCase().trim();
    return scripts.filter(
      (s) =>
        s.title.toLowerCase().includes(term) ||
        s.hook.toLowerCase().includes(term) ||
        s.body.toLowerCase().includes(term) ||
        (s.content_plan && s.content_plan.title.toLowerCase().includes(term))
    );
  }, [scripts, searchTerm]);

  const handleCreate = () => {
    setSelectedScript(null);
    setIsFormDialogOpen(true);
  };

  const handleEdit = (script: ScriptWithRelations) => {
    setSelectedScript(script);
    setIsFormDialogOpen(true);
  };

  const handleView = (script: ScriptWithRelations) => {
    setSelectedScript(script);
    setIsViewDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {scriptNotRequired && (
        <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>
            Mode Naskah Tidak Wajib aktif untuk project ini. Naskah bersifat opsional dan tidak menghambat transisi ke tahap Script Ready.
          </span>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari naskah atau hook..."
            className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {canManage && (
          <button
            type="button"
            onClick={handleCreate}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-1 focus:ring-ring shrink-0"
          >
            <Plus className="size-3.5" />
            <span>Tambah Naskah</span>
          </button>
        )}
      </div>

      {/* Script List or Empty */}
      {filteredScripts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
            <FileText className="size-5" />
          </div>
          <h3 className="text-sm font-medium text-foreground">
            {searchTerm ? "Naskah tidak ditemukan" : "Belum ada naskah"}
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {searchTerm
              ? "Coba kata kunci lain untuk menemukan naskah yang Anda cari."
              : scriptNotRequired
              ? "Opsi 'Script tidak diperlukan' aktif. Anda tetap dapat menambahkan naskah bila dibutuhkan."
              : "Buat naskah hook, visual cues, dan body copy untuk mengarahkan tim produksi."}
          </p>
          {canManage && !searchTerm && (
            <button
              type="button"
              onClick={handleCreate}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <Plus className="size-3.5" />
              <span>Buat Naskah Pertama</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden rounded-lg border border-border bg-card md:block shadow-2xs overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs min-w-[900px]">
                <thead className="border-b border-border bg-muted/30 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4 w-[240px] min-w-[200px]">Judul & Pembuat</th>
                    <th className="py-2.5 px-4 w-[200px] min-w-[170px]">Content Plan</th>
                    <th className="py-2.5 px-4 min-w-[220px]">Hook Opening</th>
                    <th className="py-2.5 px-4 w-[110px] min-w-[100px] whitespace-nowrap">Status</th>
                    <th className="py-2.5 px-4 text-right w-[90px] min-w-[80px] whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-border">
                {filteredScripts.map((script) => (
                  <tr
                    key={script.id}
                    className="hover:bg-muted/20 transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground">{script.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {script.creator ? `Oleh: ${script.creator.full_name}` : "Tim"}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {script.content_plan ? (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Layers className="size-3 text-primary shrink-0" />
                          <span className="truncate max-w-[140px]">
                            [{script.content_plan.channel}] {script.content_plan.title}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/60 italic">
                          Mandiri
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-muted-foreground line-clamp-1 max-w-[220px]">
                        {script.hook}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          script.status === "READY"
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                        }`}
                      >
                        {script.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                onClick={() => handleView(script)}
                                aria-label={`Lihat naskah: ${script.title}`}
                                className="inline-flex items-center gap-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                              >
                                <Eye className="size-3.5" />
                                <span className="sr-only">Lihat Naskah Lengkap</span>
                              </button>
                            }
                          />
                          <TooltipContent side="top">
                            Lihat naskah lengkap
                          </TooltipContent>
                        </Tooltip>

                        {canManage && (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <button
                                  type="button"
                                  onClick={() => handleEdit(script)}
                                  aria-label={`Ubah naskah: ${script.title}`}
                                  className="inline-flex items-center gap-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                                >
                                  <Edit3 className="size-3.5" />
                                  <span className="sr-only">Ubah Naskah</span>
                                </button>
                              }
                            />
                            <TooltipContent side="top">
                              Ubah naskah
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

          {/* Mobile Reflow Cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredScripts.map((script) => (
              <div
                key={script.id}
                className="rounded-lg border border-border bg-card p-3.5 text-xs space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-foreground">{script.title}</h4>
                    {script.content_plan && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                        <Layers className="size-3 text-primary shrink-0" />
                        <span>[{script.content_plan.channel}] {script.content_plan.title}</span>
                      </div>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase shrink-0 ${
                      script.status === "READY"
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                    }`}
                  >
                    {script.status}
                  </span>
                </div>

                <div className="rounded border border-border bg-muted/20 p-2 text-muted-foreground">
                  <div className="flex items-center gap-1 text-[10px] font-medium text-foreground mb-0.5">
                    <Sparkles className="size-3 text-amber-500" />
                    <span>Hook:</span>
                  </div>
                  <p className="line-clamp-2">{script.hook}</p>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <span className="text-[11px] text-muted-foreground">
                    {script.creator ? script.creator.full_name : "Tim"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleView(script)}
                      className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted"
                    >
                      <Eye className="size-3" />
                      <span>Lihat</span>
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleEdit(script)}
                        className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted"
                      >
                        <Edit3 className="size-3" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Form Dialog */}
      <ScriptFormDialog
        open={isFormDialogOpen}
        onOpenChange={setIsFormDialogOpen}
        projectId={projectId}
        initialData={selectedScript}
        availableContentPlans={availableContentPlans}
        isProductionLocked={isProductionLocked}
        onSuccess={() => {
          // Action revalidates path automatically
        }}
      />

      {/* View Dialog */}
      <ScriptViewDialog
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
        script={selectedScript}
      />
    </div>
  );
}
