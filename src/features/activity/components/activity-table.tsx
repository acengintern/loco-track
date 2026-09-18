import * as React from "react";
import Link from "next/link";
import { Activity, Clock } from "lucide-react";
import type { ActivityLogItem, ActivityCategory } from "../types";

interface ActivityTableProps {
  items: ActivityLogItem[];
}

const categoryStyles: Record<ActivityCategory, string> = {
  ALL: "border-border/60 bg-muted/50 text-foreground",
  PROJECT: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  TASK: "border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  DELIVERABLE: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  QC: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  CLIENT_REVIEW: "border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-400",
};

export function ActivityTable({ items }: ActivityTableProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-12 text-center shadow-2xs">
        <Activity className="size-8 text-muted-foreground/60 mb-2" />
        <h3 className="text-sm font-semibold text-foreground">
          Tidak Ada Catatan Aktivitas
        </h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
          Tidak ditemukan rekaman log aktivitas untuk filter yang dipilih. Silakan ubah kriteria pencarian Anda.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-2xs">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-sm min-w-[850px]">
          <thead>
            <tr className="border-b border-border/80 bg-muted/40 text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="py-3.5 pl-6 pr-4 whitespace-nowrap w-[170px] min-w-[150px]">Waktu</th>
              <th className="py-3.5 px-4 whitespace-nowrap w-[180px] min-w-[160px]">Personel</th>
              <th className="py-3.5 px-4 whitespace-nowrap w-[140px] min-w-[120px]">Kategori</th>
              <th className="py-3.5 px-4 w-[170px] min-w-[150px]">Project</th>
              <th className="py-3.5 pl-4 pr-6 min-w-[240px]">Rincian Aktivitas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {items.map((item) => (
              <tr
                key={item.id}
                className="hover:bg-muted/30 transition-colors text-sm"
              >
                {/* Timestamp */}
                <td className="py-3.5 sm:py-4 pl-6 pr-4 whitespace-nowrap text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-mono text-xs tabular-nums">
                    <Clock className="size-3.5 text-muted-foreground/70" />
                    <span>
                      {new Date(item.createdAt).toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                </td>

                {/* Actor */}
                <td className="py-3.5 sm:py-4 px-4 whitespace-nowrap font-medium text-foreground">
                  {item.actorName}
                </td>

                {/* Category Badge */}
                <td className="py-3.5 sm:py-4 px-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium ${
                      categoryStyles[item.category] || categoryStyles.ALL
                    }`}
                  >
                    {item.categoryLabel}
                  </span>
                </td>

                {/* Project */}
                <td className="py-3.5 sm:py-4 px-4 max-w-[200px] truncate">
                  {item.projectId ? (
                    <Link
                      href={`/projects/${item.projectId}`}
                      className="font-medium text-foreground hover:text-primary transition-colors truncate block"
                    >
                      {item.projectName}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">
                      {item.projectName}
                    </span>
                  )}
                </td>

                {/* Activity Description */}
                <td className="py-3.5 sm:py-4 pl-4 pr-6">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-foreground text-sm">
                      {item.humanTitle}
                    </span>
                    <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {item.humanDescription}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
