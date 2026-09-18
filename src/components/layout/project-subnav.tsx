import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import type { UserRole } from "@/lib/supabase/provisioning";

interface ProjectSubnavProps {
  current: "projects" | "clients" | "brands";
  role: UserRole;
  className?: string;
}

export function ProjectSubnav({ current, role, className }: ProjectSubnavProps) {
  // Creatives (Designer and Editor) only have access to Projects
  const isCreative = role === "GRAPHIC_DESIGNER" || role === "VIDEO_EDITOR";
  if (isCreative) {
    return null;
  }

  const tabs = [
    { id: "projects", label: "Proyek", href: "/projects" },
    { id: "clients", label: "Client", href: "/clients" },
    { id: "brands", label: "Brand", href: "/brands" },
  ];

  return (
    <nav
      className={cn(
        "flex items-center gap-1 border-b border-border mb-6",
        className
      )}
      aria-label="Navigasi Manajemen Proyek"
    >
      {tabs.map((tab) => {
        const isActive = current === tab.id;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={cn(
              "relative px-3.5 py-2 text-xs font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-t-sm",
              isActive
                ? "text-foreground font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
