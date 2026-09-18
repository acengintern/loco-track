"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Log unexpected errors for operational tracking
    console.error("Dashboard error caught by boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center p-6">
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
        <AlertTriangle className="size-7" />
      </div>

      <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
        Terjadi Kendala Sistem
      </h1>

      <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
        Sistem mendeteksi kendala tak terduga saat memuat data halaman ini.
        Silakan coba muat ulang halaman.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={() => reset()} size="sm">
          Coba Lagi
        </Button>
      </div>
    </div>
  );
}
