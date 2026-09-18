"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { ProjectPhase, PriorityLevel } from "@/types/database";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_PRIORITY_LABELS,
} from "./project-badges";

interface ProjectFiltersProps {
  currentSearch?: string;
  currentStatus?: ProjectPhase;
  currentPriority?: PriorityLevel;
  currentBrandId?: string;
  brands: Array<{ id: string; name: string }>;
}

export function ProjectFilters({
  currentSearch = "",
  currentStatus,
  currentPriority,
  currentBrandId,
  brands,
}: ProjectFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState(currentSearch);

  const hasFilters = Boolean(
    currentSearch || currentStatus || currentPriority || currentBrandId
  );

  const applyParam = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value.trim()) {
      params.set(key, value.trim());
    } else {
      params.delete(key);
    }
    params.delete("page"); // Reset page when filtering
    router.push(`/projects?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyParam("q", search);
  };

  const handleReset = () => {
    setSearch("");
    const viewParam = searchParams.get("view");
    router.push(viewParam ? `/projects?view=${viewParam}` : "/projects");
  };

  const statusFilterLabel = currentStatus
    ? PROJECT_STATUS_LABELS[currentStatus] || currentStatus
    : "Semua Status";

  const priorityFilterLabel = currentPriority
    ? PROJECT_PRIORITY_LABELS[currentPriority] || currentPriority
    : "Semua Prioritas";

  const brandFilterLabel = React.useMemo(() => {
    if (!currentBrandId || currentBrandId === "ALL") return "Semua Brand";
    const found = brands.find((b) => b.id === currentBrandId);
    return found ? found.name : "Data tidak tersedia";
  }, [currentBrandId, brands]);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <form
        onSubmit={handleSearchSubmit}
        className="relative flex-1 max-w-sm"
      >
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Cari judul project atau kode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 text-xs h-9"
        />
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {/* Status Dropdown */}
        <Select
          value={currentStatus || "ALL"}
          onValueChange={(val) => applyParam("status", val === "ALL" ? undefined : val || undefined)}
        >
          <SelectTrigger className="h-9 text-xs min-w-36" aria-label="Filter status project">
            <SelectValue placeholder="Semua Status">
              {statusFilterLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Status</SelectItem>
            {Object.entries(PROJECT_STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Priority Dropdown */}
        <Select
          value={currentPriority || "ALL"}
          onValueChange={(val) => applyParam("priority", val === "ALL" ? undefined : val || undefined)}
        >
          <SelectTrigger className="h-9 text-xs min-w-36" aria-label="Filter prioritas project">
            <SelectValue placeholder="Semua Prioritas">
              {priorityFilterLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Prioritas</SelectItem>
            {Object.entries(PROJECT_PRIORITY_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Brand Dropdown */}
        {brands.length > 0 && (
          <Select
            value={currentBrandId || "ALL"}
            onValueChange={(val) => applyParam("brandId", val === "ALL" ? undefined : val || undefined)}
          >
            <SelectTrigger className="h-9 text-xs min-w-36" aria-label="Filter brand project">
              <SelectValue placeholder="Semua Brand">
                {brandFilterLabel}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Brand</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Reset button */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <X className="size-3.5" />
            <span>Reset</span>
          </Button>
        )}
      </div>
    </div>
  );
}
