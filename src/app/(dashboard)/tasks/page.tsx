import * as React from "react";
import { requireActiveProfile, requireRole } from "@/lib/supabase/auth";
import { ROUTE_PERMISSIONS } from "@/constants/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getMyTasks, getAssignableCreativeUsers } from "@/features/tasks/queries";
import { TaskList } from "@/features/tasks/components/task-list";

export default async function TasksPage() {
  await requireRole(ROUTE_PERMISSIONS["/tasks"]);
  const profile = await requireActiveProfile();

  const [tasks, assignees] = await Promise.all([
    getMyTasks(),
    profile.role === "ADMIN" || profile.role === "SOCIAL_MEDIA_SPECIALIST"
      ? getAssignableCreativeUsers()
      : Promise.resolve([]),
  ]);

  const canManage =
    profile.role === "ADMIN" || profile.role === "SOCIAL_MEDIA_SPECIALIST";

  const getSubtitle = () => {
    switch (profile.role) {
      case "GRAPHIC_DESIGNER":
      case "VIDEO_EDITOR":
        return "Pekerjaan produksi kreatif yang ditugaskan langsung kepada Anda.";
      case "SOCIAL_MEDIA_SPECIALIST":
        return "Tugas produksi pada project yang berada dalam tanggung jawab Anda.";
      case "ADMIN":
        return "Seluruh daftar tugas produksi operasional lintas tim.";
      default:
        return "Kelola penugasan dan status pengerjaan konten.";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tugas Saya"
        description={getSubtitle()}
      />

      <TaskList
        tasks={tasks}
        currentUserId={profile.id}
        userRole={profile.role}
        canManage={canManage}
        availableAssignees={assignees}
        showProjectColumn={true}
      />
    </div>
  );
}
