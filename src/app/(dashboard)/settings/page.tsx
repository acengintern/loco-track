import * as React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Database,
  Lock,
  HardDrive,
  Users,
  Activity,
  ArrowRight,
  FolderKanban,
} from "lucide-react";
import { requireActiveProfile } from "@/lib/supabase/auth";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileForm } from "./profile-form";

export default async function SettingsPage() {
  const profile = await requireActiveProfile();
  const isAdmin = profile.role === "ADMIN";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan Akun"
        description="Kelola informasi identitas pribadi dan tinjau hak akses peran Anda."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Personal Profile Form */}
        <div className={isAdmin ? "lg:col-span-7" : "lg:col-span-12"}>
          <div className="rounded-lg border border-border bg-card p-6 shadow-2xs">
            <h2 className="text-sm font-semibold text-foreground mb-4">
              Informasi Profil
            </h2>
            <ProfileForm initialProfile={profile} />
          </div>
        </div>

        {/* Right Column: System Governance (Admin only) */}
        {isAdmin && (
          <div className="space-y-6 lg:col-span-5">
            <div className="rounded-lg border border-border bg-card p-6 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <ShieldCheck className="size-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">
                  Tata Kelola & Keamanan Sistem
                </h2>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Database className="size-3.5" />
                    <span>Database & RLS</span>
                  </div>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    Aktif (18 Tabel Terproteksi)
                  </span>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Lock className="size-3.5" />
                    <span>Pendaftaran Akun</span>
                  </div>
                  <span className="font-medium text-foreground">
                    Terkunci (Hanya Admin)
                  </span>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <HardDrive className="size-3.5" />
                    <span>Penyimpanan Berkas</span>
                  </div>
                  <span className="font-medium text-foreground">
                    Private Storage Bucket
                  </span>
                </div>
              </div>

              <div className="border-t border-border/80 pt-4 space-y-2">
                <h3 className="text-xs font-semibold text-foreground">
                  Pintasan Tata Kelola
                </h3>

                <div className="divide-y divide-border/60">
                  <Link
                    href="/users"
                    className="flex items-center justify-between py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
                  >
                    <span className="flex items-center gap-2">
                      <Users className="size-3.5 text-primary" />
                      <span>Manajemen Personel</span>
                    </span>
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                  </Link>

                  <Link
                    href="/clients"
                    className="flex items-center justify-between py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
                  >
                    <span className="flex items-center gap-2">
                      <FolderKanban className="size-3.5 text-primary" />
                      <span>Direktori Client & Brand</span>
                    </span>
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                  </Link>

                  <Link
                    href="/activity"
                    className="flex items-center justify-between py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
                  >
                    <span className="flex items-center gap-2">
                      <Activity className="size-3.5 text-primary" />
                      <span>Log Audit Sistem</span>
                    </span>
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
