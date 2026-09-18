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
import { ROLE_LABELS } from "@/constants/navigation";
import type { UserRole } from "@/lib/supabase/provisioning";

interface UserFiltersProps {
  currentSearch?: string;
  currentRole?: string;
  currentStatus?: string;
}

const ALL_ROLES: UserRole[] = [
  "ADMIN",
  "CREATIVE_DIRECTOR",
  "ACCOUNT_EXECUTIVE",
  "SOCIAL_MEDIA_SPECIALIST",
  "GRAPHIC_DESIGNER",
  "VIDEO_EDITOR",
];

export function UserFilters({
  currentSearch = "",
  currentRole,
  currentStatus,
}: UserFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = React.useState(currentSearch);

  const hasFilters = Boolean(
    currentSearch ||
      (currentRole && currentRole !== "ALL") ||
      (currentStatus && currentStatus !== "ALL")
  );

  const applyParam = (key: string, value: string | null | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "ALL" && value.trim()) {
      params.set(key, value.trim());
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.push(`/users?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyParam("q", search);
  };

  const handleReset = () => {
    setSearch("");
    router.push("/users");
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
      {/* Search Bar */}
      <form
        onSubmit={handleSearchSubmit}
        className="relative flex-1 max-w-sm"
      >
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder="Cari nama atau email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 pl-8 pr-8 text-xs"
        />
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              applyParam("q", "");
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
            aria-label="Hapus pencarian"
          >
            <X className="size-3" />
          </button>
        )}
      </form>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Role Selector */}
        <Select
          value={currentRole || "ALL"}
          onValueChange={(val) => applyParam("role", val)}
        >
          <SelectTrigger className="h-8 text-xs min-w-40" aria-label="Filter berdasarkan peran">
            <SelectValue placeholder="Semua Peran" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Peran</SelectItem>
            {ALL_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {ROLE_LABELS[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Selector */}
        <Select
          value={currentStatus || "ALL"}
          onValueChange={(val) => applyParam("status", val)}
        >
          <SelectTrigger className="h-8 text-xs min-w-32" aria-label="Filter berdasarkan status">
            <SelectValue placeholder="Semua Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Status</SelectItem>
            <SelectItem value="ACTIVE">Aktif</SelectItem>
            <SelectItem value="INACTIVE">Nonaktif</SelectItem>
          </SelectContent>
        </Select>

        {/* Reset Button */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <X className="size-3.5" />
            <span>Reset</span>
          </Button>
        )}
      </div>
    </div>
  );
}
