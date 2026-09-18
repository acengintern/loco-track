"use client";

import * as React from "react";
import type { BriefDetail } from "../types";
import { BriefFormDialog } from "./brief-form-dialog";
import { FileText, Plus, Edit3, ExternalLink, Link as LinkIcon, User, Calendar } from "lucide-react";

interface BriefViewProps {
  projectId: string;
  projectStatus: string;
  brief: BriefDetail | null;
  canManage: boolean;
}

export function BriefView({
  projectId,
  projectStatus,
  brief,
  canManage,
}: BriefViewProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const isProductionLocked = [
    "PRODUCTION",
    "INTERNAL_QC",
    "CLIENT_REVIEW",
    "APPROVED",
    "PUBLISHED",
    "DONE",
  ].includes(projectStatus);

  // Parse reference links (one per line or comma-separated)
  const parsedLinks = brief?.reference_links
    ? brief.reference_links
        .split(/[\n,]+/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
    : [];

  if (!brief) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center shadow-2xs">
        <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
          <FileText className="size-5" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">
          {canManage ? "Brief belum dibuat." : "Brief belum tersedia."}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          {canManage
            ? "Mulai dengan menyusun tujuan campaign, target audiens, pesan kunci, dan ringkasan deliverable."
            : "Penanggung jawab project belum menyusun dokumen creative brief untuk project ini."}
        </p>

        {canManage && !isProductionLocked && (
          <div className="mt-5">
            <button
              type="button"
              onClick={() => setIsDialogOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs"
            >
              <Plus className="size-3.5" />
              <span>Buat Brief</span>
            </button>
          </div>
        )}

        <BriefFormDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          projectId={projectId}
          initialData={null}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card shadow-2xs overflow-hidden">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Creative Brief
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-muted-foreground">
              {brief.creator && (
                <span className="flex items-center gap-1">
                  <User className="size-3" />
                  <span>{brief.creator.full_name}</span>
                </span>
              )}
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                <span>
                  {new Date(brief.updated_at).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </span>
            </div>

            {canManage && (
              <button
                type="button"
                onClick={() => setIsDialogOpen(true)}
                disabled={isProductionLocked}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  isProductionLocked
                    ? "Brief terkunci karena project telah masuk tahap produksi"
                    : "Edit brief"
                }
              >
                <Edit3 className="size-3" />
                <span>Edit Brief</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 text-xs">
          {/* Objective */}
          <div>
            <h3 className="text-[10px] uppercase font-semibold text-muted-foreground/70 tracking-wider mb-1.5">
              Tujuan Campaign (Objective)
            </h3>
            <p className="text-foreground text-xs leading-relaxed whitespace-pre-line bg-muted/20 p-3 rounded-md border border-border/50">
              {brief.objective}
            </p>
          </div>

          {/* Target Audience & Key Message */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-[10px] uppercase font-semibold text-muted-foreground/70 tracking-wider mb-1.5">
                Target Audiens
              </h3>
              <p className="text-foreground text-xs leading-relaxed whitespace-pre-line bg-muted/20 p-3 rounded-md border border-border/50">
                {brief.target_audience}
              </p>
            </div>

            <div>
              <h3 className="text-[10px] uppercase font-semibold text-muted-foreground/70 tracking-wider mb-1.5">
                Pesan Utama (Key Message)
              </h3>
              <p className="text-foreground text-xs leading-relaxed whitespace-pre-line bg-muted/20 p-3 rounded-md border border-border/50">
                {brief.key_message}
              </p>
            </div>
          </div>

          {/* Deliverables Summary */}
          <div>
            <h3 className="text-[10px] uppercase font-semibold text-muted-foreground/70 tracking-wider mb-1.5">
              Ringkasan Deliverable
            </h3>
            <p className="text-foreground text-xs leading-relaxed whitespace-pre-line bg-muted/20 p-3 rounded-md border border-border/50 font-mono text-[11px]">
              {brief.deliverables_summary}
            </p>
          </div>

          {/* Reference Links */}
          {parsedLinks.length > 0 && (
            <div>
              <h3 className="text-[10px] uppercase font-semibold text-muted-foreground/70 tracking-wider mb-1.5 flex items-center gap-1">
                <LinkIcon className="size-3 text-muted-foreground" />
                <span>Link Referensi & Moodboard</span>
              </h3>
              <div className="space-y-1.5 bg-muted/20 p-3 rounded-md border border-border/50">
                {parsedLinks.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <a
                      href={link.startsWith("http") ? link : `https://${link}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-medium text-primary hover:underline flex items-center gap-1 truncate max-w-lg"
                    >
                      <span className="truncate">{link}</span>
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <BriefFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        projectId={projectId}
        initialData={brief}
      />
    </div>
  );
}
