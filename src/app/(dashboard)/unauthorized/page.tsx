import * as React from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center p-6">
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
        <ShieldAlert className="size-7" />
      </div>

      <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
        Akses Dibatasi
      </h1>

      <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
        Peran akun Anda tidak memiliki izin untuk mengakses halaman yang Anda tuju.
        Jika Anda memerlukan akses ke modul ini, silakan hubungi administrator
        sistem.
      </p>

      <div className="mt-6">
        <Button nativeButton={false} render={<Link href="/dashboard" />}>
          Kembali ke Dashboard
        </Button>
      </div>
    </div>
  );
}
