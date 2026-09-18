"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ActivityPaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
}

export function ActivityPagination({
  page,
  totalPages,
  totalCount,
}: ActivityPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) {
    return null;
  }

  const navigateToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-2">
      <p className="text-xs text-muted-foreground">
        Menampilkan halaman <strong className="font-semibold text-foreground">{page}</strong> dari{" "}
        <strong className="font-semibold text-foreground">{totalPages}</strong> (Total {totalCount} rekaman audit)
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => navigateToPage(page - 1)}
          aria-label="Halaman sebelumnya"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-2xs hover:bg-muted disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="size-3.5" />
          <span>Sebelumnya</span>
        </button>

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => navigateToPage(page + 1)}
          aria-label="Halaman selanjutnya"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-2xs hover:bg-muted disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span>Selanjutnya</span>
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
