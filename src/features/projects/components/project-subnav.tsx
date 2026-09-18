"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  Calendar,
  Layers,
  Users,
  Activity,
  LayoutDashboard,
  ListTodo,
  Globe,
} from "lucide-react";

export type ProjectTabKey =
  | "overview"
  | "brief"
  | "content-plan"
  | "script"
  | "tasks"
  | "client-review"
  | "team"
  | "activity";

interface ProjectSubnavProps {
  projectId: string;
  activeTab: ProjectTabKey;
  counts: {
    hasBrief: boolean;
    contentPlans: number;
    scripts: number;
    tasks: number;
    team: number;
    clientReviewBadge?: string;
    clientReviewBadgeColor?: string;
  };
  userRole?: string;
  isCreativePreview?: boolean;
}

export function ProjectSubnav({
  projectId,
  activeTab,
  counts,
  userRole,
  isCreativePreview = false,
}: ProjectSubnavProps) {
  const isCreativeRole =
    userRole === "GRAPHIC_DESIGNER" || userRole === "VIDEO_EDITOR";

  const tabs: {
    key: ProjectTabKey;
    label: string;
    icon: React.ElementType;
    badge?: string | number;
    badgeColor?: string;
  }[] = isCreativeRole
    ? [
        {
          key: "tasks",
          label: "Tugas",
          icon: ListTodo,
          badge: counts.tasks,
        },
        {
          key: "brief",
          label: "Brief",
          icon: FileText,
          badge: counts.hasBrief ? "OK" : "KOSONG",
          badgeColor: counts.hasBrief
            ? "text-emerald-500 bg-emerald-500/10"
            : "text-muted-foreground bg-muted",
        },
        {
          key: "script",
          label: "Naskah",
          icon: Layers,
          badge: counts.scripts,
        },
        {
          key: "overview",
          label: "Ringkasan",
          icon: LayoutDashboard,
        },
      ]
    : [
        {
          key: "overview",
          label: "Ringkasan",
          icon: LayoutDashboard,
        },
        {
          key: "brief",
          label: "Brief",
          icon: FileText,
          badge: counts.hasBrief ? "OK" : "KOSONG",
          badgeColor: counts.hasBrief
            ? "text-emerald-500 bg-emerald-500/10"
            : "text-muted-foreground bg-muted",
        },
        {
          key: "content-plan",
          label: "Content Plan",
          icon: Calendar,
          badge: counts.contentPlans,
        },
        {
          key: "script",
          label: "Naskah",
          icon: Layers,
          badge: counts.scripts,
        },
        {
          key: "tasks",
          label: "Tugas",
          icon: ListTodo,
          badge: counts.tasks,
        },
        {
          key: "client-review",
          label: "Review & Publikasi",
          icon: Globe,
          badge: counts.clientReviewBadge,
          badgeColor: counts.clientReviewBadgeColor,
        },
        {
          key: "team",
          label: "Tim Proyek",
          icon: Users,
          badge: counts.team,
        },
        {
          key: "activity",
          label: "Aktivitas",
          icon: Activity,
        },
      ];

  return (
    <nav
      aria-label="Navigasi Proyek"
      className="flex items-center gap-1 border-b border-border overflow-x-auto no-scrollbar text-xs font-medium"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;
        let href =
          tab.key === "overview" && !isCreativeRole
            ? `/projects/${projectId}`
            : `/projects/${projectId}?tab=${tab.key}`;

        if (isCreativePreview) {
          href += `${href.includes("?") ? "&" : "?"}view=creative`;
        }

        return (
          <Link
            key={tab.key}
            href={href}
            prefetch={false}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
              isActive
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <Icon className="size-3.5" />
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`ml-1 rounded px-1.5 py-0.2 text-[10px] font-semibold ${
                  tab.badgeColor || "bg-muted text-muted-foreground"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
