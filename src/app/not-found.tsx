import * as React from "react";
import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center antialiased">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
        <FileQuestion className="size-7" />
      </div>

      <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
        Halaman Tidak Ditemukan
      </h1>

      <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
        Halaman yang Anda tuju tidak tersedia atau tautan yang Anda buka telah
        kedaluwarsa.
      </p>

      <div className="mt-6">
        <Button nativeButton={false} render={<Link href="/dashboard" />}>
          Kembali ke Dashboard
        </Button>
      </div>
    </div>
  );
}
