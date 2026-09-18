"use client";

import * as React from "react";
import type { ClientReviewRoundDetail } from "../types";
import { CheckCircle2, AlertTriangle, Clock, ChevronDown, ChevronUp, FileText } from "lucide-react";

interface ClientHistoryTimelineProps {
  rounds: ClientReviewRoundDetail[];
}

export function ClientHistoryTimeline({ rounds }: ClientHistoryTimelineProps) {
  const [expandedRounds, setExpandedRounds] = React.useState<Record<string, boolean>>({});

  const toggleRound = (roundId: string) => {
    setExpandedRounds((prev) => ({
      ...prev,
      [roundId]: !prev[roundId],
    }));
  };

  if (!rounds || rounds.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 text-center text-xs text-muted-foreground">
        Belum ada riwayat sesi review dengan klien untuk project ini.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
        Riwayat Sesi Review Klien ({rounds.length})
      </h3>

      <div className="space-y-3">
        {rounds.map((round) => {
          const isExpanded = expandedRounds[round.id] ?? (round.overall_verdict === "PENDING");
          const isPending = round.overall_verdict === "PENDING";
          const isApproved = round.overall_verdict === "APPROVED";

          return (
            <div
              key={round.id}
              className="rounded-lg border border-border bg-card overflow-hidden shadow-2xs text-xs"
            >
              {/* Round Header */}
              <button
                type="button"
                onClick={() => toggleRound(round.id)}
                className="w-full flex items-center justify-between p-3.5 hover:bg-muted/40 transition-colors text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex size-6 items-center justify-center rounded-full bg-muted border border-border text-[11px] font-bold text-foreground">
                    {round.round_number}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">
                      Sesi Presentasi Ronde {round.round_number}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Diajukan oleh {round.submitter?.full_name || "SMS"} pada{" "}
                      {new Date(round.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      isApproved
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : isPending
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    {isApproved ? (
                      <CheckCircle2 className="size-3 text-emerald-500" />
                    ) : isPending ? (
                      <Clock className="size-3 text-blue-500" />
                    ) : (
                      <AlertTriangle className="size-3 text-amber-500" />
                    )}
                    <span>
                      {isApproved
                        ? "Disetujui"
                        : isPending
                        ? "Sedang Berjalan"
                        : "Revisi Diminta"}
                    </span>
                  </span>

                  {isExpanded ? (
                    <ChevronUp className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Items Detail */}
              {isExpanded && (
                <div className="border-t border-border/70 p-3.5 space-y-3 bg-muted/10">
                  {round.items.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic">
                      Belum ada item deliverable yang dievaluasi dalam sesi ini.
                    </p>
                  ) : (
                    <div className="divide-y divide-border/60">
                      {round.items.map((item) => (
                        <div key={item.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <FileText className="size-3.5 text-primary" />
                              <span className="font-semibold text-foreground">
                                {item.task.title}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                (v{item.file.version})
                              </span>
                            </div>

                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.2 rounded uppercase ${
                                item.verdict === "APPROVED"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              }`}
                            >
                              {item.verdict === "APPROVED" ? "Disetujui" : "Perlu Revisi"}
                            </span>
                          </div>

                          {item.feedback_notes && (
                            <div className="rounded border border-border/80 bg-card p-2 text-[11px] text-foreground leading-relaxed">
                              <span className="text-[10px] font-semibold uppercase text-muted-foreground block mb-0.5">
                                Catatan Klien:
                              </span>
                              {item.feedback_notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
