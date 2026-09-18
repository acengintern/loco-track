"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Edit2, ArrowLeft, Building2, Eye } from "lucide-react";
import type { ProjectDetail } from "../types";
import { ProjectStatusBadge, ProjectPriorityBadge } from "./project-badges";
import { ProjectEditDialog } from "./project-edit-dialog";
import { Button, buttonVariants } from "@/components/ui/button";

interface ProjectDetailHeaderProps {
  project: ProjectDetail;
  canManage: boolean;
  isAdmin: boolean;
  isCreativePreview?: boolean;
  brands: Array<{
    id: string;
    name: string;
    code: string;
    client_name: string;
  }>;
  smsUsers: Array<{
    id: string;
    full_name: string;
    email: string;
  }>;
}

export function ProjectDetailHeader({
  project,
  canManage,
  isAdmin,
  isCreativePreview = false,
  brands,
  smsUsers,
}: ProjectDetailHeaderProps) {
  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = React.useState(false);

  return (
    <div className="space-y-3">
      <Link
        href="/projects"
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          className:
            "gap-1.5 text-xs text-muted-foreground hover:text-foreground pl-0",
        })}
      >
        <ArrowLeft className="size-3.5" />
        <span>Kembali ke Direktori Project</span>
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold bg-muted px-2 py-0.5 rounded border border-border">
              {project.project_code}
            </span>
            <ProjectStatusBadge status={project.status} />
            <ProjectPriorityBadge priority={project.priority} />
          </div>

          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            {project.name}
          </h1>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="size-3.5" />
            <Link
              href={`/clients/${project.brand.client.id}`}
              className="hover:underline text-foreground/80 font-medium"
            >
              {project.brand.client.name}
            </Link>
            <span>/</span>
            <Link
              href={`/brands/${project.brand.id}`}
              className="hover:underline text-foreground/80 font-medium"
            >
              {project.brand.name}
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && (
            <Link
              href={
                isCreativePreview
                  ? `/projects/${project.id}`
                  : `/projects/${project.id}?view=creative`
              }
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className:
                  "gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground",
              })}
            >
              <Eye className="size-3.5" />
              <span>{isCreativePreview ? "Mode Admin" : "Mode Kreatif"}</span>
            </Link>
          )}

          {canManage && !isCreativePreview && (
            <Button
              onClick={() => setIsEditOpen(true)}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8"
            >
              <Edit2 className="size-3.5" />
              <span>Edit Project</span>
            </Button>
          )}
        </div>
      </div>

      <ProjectEditDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        project={project}
        brands={brands}
        smsUsers={smsUsers}
        isAdmin={isAdmin}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
