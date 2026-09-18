"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Calendar,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ToggleLeft,
  ToggleRight,
  ShieldAlert,
} from "lucide-react";
import {
  transitionProjectPhaseAction,
  toggleScriptNotRequiredAction,
} from "../actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/toast";

interface ProjectPlanningSummaryProps {
  projectId: string;
  projectStatus: string;
  scriptNotRequired: boolean;
  hasBrief: boolean;
  contentPlansCount: number;
  scriptsCount: number;
  readyScriptsCount: number;
  canManage: boolean;
}

export function ProjectPlanningSummary({
  projectId,
  projectStatus,
  scriptNotRequired,
  hasBrief,
  contentPlansCount,
  scriptsCount,
  readyScriptsCount,
  canManage,
}: ProjectPlanningSummaryProps) {
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const [isTogglingScript, setIsTogglingScript] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const isBriefReceived = projectStatus === "BRIEF_RECEIVED";
  const isContentPlanning = projectStatus === "CONTENT_PLANNING";
  const isScriptReady = projectStatus === "SCRIPT_READY";
  const isLocked = [
    "PRODUCTION",
    "INTERNAL_QC",
    "CLIENT_REVIEW",
    "APPROVED",
    "PUBLISHED",
    "DONE",
  ].includes(projectStatus);

  // Transition 1 Requirements (BRIEF_RECEIVED -> CONTENT_PLANNING)
  const canAdvanceToContentPlanning = hasBrief;

  // Transition 2 Requirements (CONTENT_PLANNING -> SCRIPT_READY)
  const unreadyScriptsCount = scriptsCount - readyScriptsCount;
  const scriptConditionMet = scriptNotRequired
    ? unreadyScriptsCount === 0
    : scriptsCount > 0 && unreadyScriptsCount === 0;

  const canAdvanceToScriptReady =
    hasBrief && contentPlansCount > 0 && scriptConditionMet;

  const handleTransition = async (targetPhase: "CONTENT_PLANNING" | "SCRIPT_READY") => {
    setActionError(null);
    setIsTransitioning(true);

    try {
      const res = await transitionProjectPhaseAction(projectId, targetPhase);
      if (!res.success) {
        const errorMsg = res.error || "Gagal memajukan fase project. Coba lagi.";
        setActionError(errorMsg);
        toast.error(errorMsg);
      } else {
        toast.success("Fase project berhasil dimajukan.");
        router.refresh();
      }
    } catch {
      const errorMsg = "Terjadi kesalahan jaringan saat memajukan fase project.";
      setActionError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsTransitioning(false);
    }
  };

  const [isToggleConfirmOpen, setIsToggleConfirmOpen] = React.useState(false);

  const confirmToggleScriptNotRequired = async () => {
    const nextValue = !scriptNotRequired;
    setActionError(null);
    setIsTogglingScript(true);
    setIsToggleConfirmOpen(false);

    try {
      const res = await toggleScriptNotRequiredAction(projectId, nextValue);
      if (!res.success) {
        const errorMsg = res.error || "Gagal mengubah opsi naskah. Coba lagi.";
        setActionError(errorMsg);
        toast.error(errorMsg);
      } else {
        toast.success("Kebutuhan naskah berhasil diperbarui.");
        router.refresh();
      }
    } catch {
      const errorMsg = "Terjadi kesalahan jaringan saat mengubah opsi naskah.";
      setActionError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsTogglingScript(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6 sm:p-7 space-y-5 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-foreground">
            Status Kesiapan Perencanaan
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Indikator faktual kelengkapan dokumen pra-produksi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Fase Aktif:</span>
          <span className="inline-flex items-center rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary uppercase tracking-wider">
            {projectStatus.replace("_", " ")}
          </span>
        </div>
      </div>

      {actionError && (
        <div className="flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive">
          <AlertCircle className="size-4.5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Discrete, Factual Completeness Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-sm">
        {/* 1. Brief */}
        <div className="rounded-md border border-border bg-muted/20 p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-medium flex items-center gap-2 text-sm">
              <FileText className="size-4 text-primary" />
              Project Brief
            </span>
            {hasBrief ? (
              <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                LENGKAP
              </span>
            ) : (
              <span className="text-xs font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                BELUM DIISI
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {hasBrief
              ? "Objektif, audiens sasaran, dan pesan utama tercatat."
              : "Wajib diisi sebelum masuk perencanaan konten."}
          </p>
        </div>

        {/* 2. Content Plans */}
        <div className="rounded-md border border-border bg-muted/20 p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-medium flex items-center gap-2 text-sm">
              <Calendar className="size-4 text-primary" />
              Content Plan
            </span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                contentPlansCount > 0
                  ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                  : "text-amber-500 bg-amber-500/10 border-amber-500/20"
              }`}
            >
              {contentPlansCount} ITEM
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {contentPlansCount > 0
              ? `${contentPlansCount} rencana editorial terjadwal.`
              : "Minimal 1 content plan sebelum naskah siap."}
          </p>
        </div>

        {/* 3. Scripts */}
        <div className="rounded-md border border-border bg-muted/20 p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-medium flex items-center gap-2 text-sm">
              <Layers className="size-4 text-primary" />
              Naskah (Scripts)
            </span>
            {scriptNotRequired ? (
              <span className="text-xs font-semibold text-sky-500 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                TIDAK DIPERLUKAN
              </span>
            ) : (
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                  scriptsCount > 0 && unreadyScriptsCount === 0
                    ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                    : "text-amber-500 bg-amber-500/10 border-amber-500/20"
                }`}
              >
                {readyScriptsCount}/{scriptsCount} SIAP
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {scriptNotRequired
              ? `Script tidak diperlukan (${readyScriptsCount}/${scriptsCount} naskah tersedia).`
              : scriptsCount === 0
              ? "Belum ada naskah. Wajib minimal 1 naskah siap."
              : unreadyScriptsCount > 0
              ? `Masih ada ${unreadyScriptsCount} naskah berstatus DRAFT.`
              : "Seluruh naskah berstatus READY."}
          </p>
        </div>
      </div>

      {/* Script Not Required Configuration */}
      {canManage && (isBriefReceived || isContentPlanning) ? (
        /* Editable in Planning Phases for ADMIN / Owner SMS */
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-lg border border-border bg-background p-4 text-sm">
          <div className="space-y-0.5">
            <span className="font-medium text-foreground">Script tidak diperlukan</span>
            <p className="text-xs text-muted-foreground">
              Aktifkan bila format konten proyek ini (seperti desain grafis statis) tidak membutuhkan naskah tertulis.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsToggleConfirmOpen(true)}
            disabled={isTogglingScript}
            aria-pressed={scriptNotRequired}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3.5 h-10 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 shrink-0 self-start sm:self-auto transition-colors cursor-pointer"
          >
            {isTogglingScript ? (
              <Loader2 className="size-4 animate-spin" />
            ) : scriptNotRequired ? (
              <ToggleRight className="size-4.5 text-primary" />
            ) : (
              <ToggleLeft className="size-4.5 text-muted-foreground" />
            )}
            <span>{scriptNotRequired ? "Aktif" : "Tidak Aktif"}</span>
          </button>
        </div>
      ) : (
        /* Read-Only Status after SCRIPT_READY or for Non-Managing Team Members */
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-lg border border-border bg-muted/20 p-4 text-sm">
          <div className="space-y-0.5">
            <span className="font-medium text-foreground">Script tidak diperlukan</span>
            <p className="text-xs text-muted-foreground">
              {scriptNotRequired
                ? "Mode ini aktif. Proyek dapat dilanjutkan ke tahap produksi tanpa penulisan naskah."
                : "Mode ini tidak aktif. Proyek memerlukan naskah berstatus READY sebelum produksi."}
            </p>
          </div>

          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border shrink-0 self-start sm:self-auto ${
              scriptNotRequired
                ? "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                : "border-border bg-muted/50 text-muted-foreground"
            }`}
          >
            {scriptNotRequired ? "Aktif" : "Tidak Aktif"}
          </span>
        </div>
      )}

      {/* Phase Transition Actions */}
      {canManage && isBriefReceived && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border">
          <div className="text-sm text-muted-foreground">
            {!canAdvanceToContentPlanning
              ? "Lengkapi formulir brief pada tab Brief untuk membuka fase perencanaan konten."
              : "Brief telah siap. Anda dapat memulai penyusunan jadwal editorial dan naskah."}
          </div>
          <button
            type="button"
            onClick={() => handleTransition("CONTENT_PLANNING")}
            disabled={!canAdvanceToContentPlanning || isTransitioning}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 h-10 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {isTransitioning && <Loader2 className="size-4 animate-spin" />}
            <span>Mulai Perencanaan Konten</span>
            <ArrowRight className="size-4" />
          </button>
        </div>
      )}

      {canManage && isContentPlanning && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border">
          <div className="text-sm text-muted-foreground">
            {!canAdvanceToScriptReady ? (
              <div className="space-y-1 text-amber-500">
                <span className="font-medium text-sm">Syarat menuju Naskah Siap belum terpenuhi:</span>
                <ul className="list-disc list-inside text-xs text-muted-foreground">
                  {!hasBrief && <li>Brief belum diisi</li>}
                  {contentPlansCount === 0 && <li>Minimal 1 content plan harus dibuat</li>}
                  {!scriptConditionMet && !scriptNotRequired && (
                    <li>
                      {scriptsCount === 0
                        ? "Minimal 1 naskah harus dibuat (atau aktifkan opsi 'Script tidak diperlukan')"
                        : "Seluruh naskah harus berstatus READY"}
                    </li>
                  )}
                  {!scriptConditionMet && scriptNotRequired && (
                    <li>Semua naskah yang dibuat harus berstatus READY</li>
                  )}
                </ul>
              </div>
            ) : (
              <span className="text-emerald-500 font-medium text-sm">
                Seluruh syarat perencanaan terpenuhi. Proyek siap dimajukan ke status Naskah Siap.
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleTransition("SCRIPT_READY")}
            disabled={!canAdvanceToScriptReady || isTransitioning}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 h-10 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {isTransitioning && <Loader2 className="size-4 animate-spin" />}
            <span>Tandai Naskah Siap</span>
            <CheckCircle2 className="size-4" />
          </button>
        </div>
      )}

      {isScriptReady && (
        <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-500">
          <CheckCircle2 className="size-4.5 shrink-0" />
          <span>
            Perencanaan kreatif selesai (SCRIPT_READY). Proyek siap memasuki tahap produksi tugas pada Phase 7.
          </span>
        </div>
      )}

      {isLocked && (
        <div className="flex items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-500">
          <ShieldAlert className="size-4.5 shrink-0" />
          <span>
            Dokumen perencanaan terkunci (T-004). Perubahan brief, content plan, atau naskah hanya dapat dilakukan melalui prosedur revisi luar biasa.
          </span>
        </div>
      )}

      {/* Script Not Required Confirmation Alert Dialog */}
      <AlertDialog open={isToggleConfirmOpen} onOpenChange={setIsToggleConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold">
              {!scriptNotRequired ? "Aktifkan Mode 'Script Tidak Diperlukan'?" : "Nonaktifkan Mode 'Script Tidak Diperlukan'?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              {!scriptNotRequired
                ? "Proyek dapat maju ke fase Script Ready tanpa menulis naskah konten."
                : "Proyek akan membutuhkan minimal 1 naskah berstatus READY sebelum dapat maju ke fase berikutnya."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isTogglingScript}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmToggleScriptNotRequired}
              disabled={isTogglingScript}
            >
              {isTogglingScript ? "Memproses..." : "Konfirmasi"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
