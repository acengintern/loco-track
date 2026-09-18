import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireActiveProfile } from "@/lib/supabase/auth";
import { PageHeader } from "@/components/layout/page-header";
import {
  getActiveBrandsForProjectSelection,
  getActiveSMSUsersForSelection,
} from "@/features/projects/queries";
import { ProjectCreateForm } from "@/features/projects/components/project-create-form";
import { buttonVariants } from "@/components/ui/button";

export default async function NewProjectPage() {
  const profile = await requireActiveProfile();

  // Guard: Only Admin and SMS can create projects
  if (profile.role !== "ADMIN" && profile.role !== "SOCIAL_MEDIA_SPECIALIST") {
    redirect("/projects");
  }

  const [brands, smsUsers] = await Promise.all([
    getActiveBrandsForProjectSelection(),
    getActiveSMSUsersForSelection(),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/projects"
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className:
              "gap-1.5 text-xs text-muted-foreground hover:text-foreground pl-0 mb-3",
          })}
        >
          <ArrowLeft className="size-3.5" />
          <span>Kembali ke Direktori Project</span>
        </Link>

        <PageHeader
          title="Buat Project Baru"
          description="Inisiasi project baru dengan kode penomoran otomatis berbasis brand."
        />
      </div>

      <ProjectCreateForm
        brands={brands}
        smsUsers={smsUsers}
        isAdmin={profile.role === "ADMIN"}
        currentUserId={profile.id}
      />
    </div>
  );
}
