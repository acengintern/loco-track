"use client";

import * as React from "react";
import type { ScriptWithRelations } from "../types";
import {
  FileText,
  Calendar,
  User,
  Sparkles,
  Eye,
  Film,
  Megaphone,
  Layers,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ScriptViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  script: ScriptWithRelations | null;
}

export function ScriptViewDialog({
  open,
  onOpenChange,
  script,
}: ScriptViewDialogProps) {
  if (!script) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FileText className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-foreground">
                Detail Naskah Konten
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Struktur naskah, arahan visual pengerjaan, dan status kesiapan produksi.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
          {/* Title & Status Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{script.title}</h3>
              {script.content_plan && (
                <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
                  <Layers className="size-3.5 text-primary" />
                  <span>
                    Tautan Plan: [{script.content_plan.channel}] {script.content_plan.title}
                  </span>
                </div>
              )}
            </div>
            <span
              className={`inline-flex items-center self-start px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wider uppercase ${
                script.status === "READY"
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
              }`}
            >
              {script.status}
            </span>
          </div>

          {/* Hook */}
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <div className="flex items-center gap-1.5 text-foreground font-medium mb-1.5">
              <Sparkles className="size-3.5 text-amber-500" />
              <span>Hook Opening</span>
            </div>
            <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {script.hook}
            </p>
          </div>

          {/* Visual Cues */}
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <div className="flex items-center gap-1.5 text-foreground font-medium mb-1.5">
              <Film className="size-3.5 text-blue-500" />
              <span>Petunjuk Visual & Aset</span>
            </div>
            <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {script.visual_cues}
            </p>
          </div>

          {/* Body */}
          <div className="rounded-md border border-border bg-background p-3">
            <div className="flex items-center gap-1.5 text-foreground font-medium mb-1.5">
              <Eye className="size-3.5 text-emerald-500" />
              <span>Isi Naskah (Body)</span>
            </div>
            <p className="text-foreground whitespace-pre-wrap leading-relaxed">
              {script.body}
            </p>
          </div>

          {/* CTA */}
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <div className="flex items-center gap-1.5 text-foreground font-medium mb-1.5">
              <Megaphone className="size-3.5 text-primary" />
              <span>Call to Action (CTA)</span>
            </div>
            <p className="text-foreground font-medium leading-relaxed">
              {script.call_to_action}
            </p>
          </div>

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border text-[11px] text-muted-foreground">
            {script.creator && (
              <div className="flex items-center gap-1">
                <User className="size-3" />
                <span>Penulis: {script.creator.full_name}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Calendar className="size-3" />
              <span>
                Dibuat: {new Date(script.created_at).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-3.5 border-t border-border bg-muted/20 flex items-center justify-end shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
