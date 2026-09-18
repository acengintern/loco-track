"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Filter, RotateCcw } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { ActivityFilterOptions, ActivityCategory } from "../types";
import { ACTIVITY_CATEGORY_LABELS } from "@/constants/labels";

interface ActivityFilterBarProps {
  options: ActivityFilterOptions;
}

export function ActivityFilterBar({ options }: ActivityFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentProject = searchParams.get("project") || "ALL";
  const currentActor = searchParams.get("actor") || "ALL";
  const currentCategory = (searchParams.get("category") as ActivityCategory) || "ALL";

  const currentProjectLabel = React.useMemo(() => {
    if (currentProject === "ALL") return "Semua Project";
    const found = options.projects.find((p) => p.id === currentProject);
    return found ? found.name : "Data tidak tersedia";
  }, [currentProject, options.projects]);

  const currentActorLabel = React.useMemo(() => {
    if (currentActor === "ALL") return "Semua Personel";
    const found = options.actors.find((a) => a.id === currentActor);
    return found ? found.fullName : "Data tidak tersedia";
  }, [currentActor, options.actors]);

  const currentCategoryLabel =
    currentCategory === "ALL"
      ? "Semua Kategori"
      : ACTIVITY_CATEGORY_LABELS[currentCategory] || currentCategory;

  const hasActiveFilters =
    currentProject !== "ALL" || currentActor !== "ALL" || currentCategory !== "ALL";

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "ALL" || !value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    // Always reset to page 1 on filter change
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleReset = () => {
    const params = new URLSearchParams();
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Filter className="size-3.5" />
          <span>Filter:</span>
        </div>

        {/* Project Selector */}
        <Select
          value={currentProject}
          onValueChange={(val) => val && updateParam("project", val)}
        >
          <SelectTrigger className="h-8 text-xs min-w-36" aria-label="Filter berdasarkan project">
            <SelectValue placeholder="Semua Project">
              {currentProjectLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Project</SelectItem>
            {options.projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Actor Selector */}
        <Select
          value={currentActor}
          onValueChange={(val) => val && updateParam("actor", val)}
        >
          <SelectTrigger className="h-8 text-xs min-w-36" aria-label="Filter berdasarkan personel">
            <SelectValue placeholder="Semua Personel">
              {currentActorLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Personel</SelectItem>
            {options.actors.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Category Selector */}
        <Select
          value={currentCategory}
          onValueChange={(val) => val && updateParam("category", val)}
        >
          <SelectTrigger className="h-8 text-xs min-w-36" aria-label="Filter berdasarkan kategori aktivitas">
            <SelectValue placeholder="Semua Kategori">
              {currentCategoryLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Kategori</SelectItem>
            <SelectItem value="PROJECT">Project</SelectItem>
            <SelectItem value="TASK">Tugas</SelectItem>
            <SelectItem value="DELIVERABLE">Deliverable</SelectItem>
            <SelectItem value="QC">Quality Control</SelectItem>
            <SelectItem value="CLIENT_REVIEW">Review Klien</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1 self-start sm:self-auto rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RotateCcw className="size-3" />
          <span>Reset Filter</span>
        </button>
      )}
    </div>
  );
}
