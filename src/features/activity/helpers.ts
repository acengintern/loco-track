import type { ActivityCategory } from "./types";

export function categorizeEventType(eventType: string): {
  category: ActivityCategory;
  label: string;
} {
  const upper = eventType.toUpperCase();

  if (upper.includes("CLIENT") || upper.includes("PRESENTATION")) {
    return { category: "CLIENT_REVIEW", label: "Review Klien" };
  }
  if (upper.includes("QC") || upper.includes("REVISION")) {
    return { category: "QC", label: "Quality Control" };
  }
  if (upper.includes("DELIVERABLE") || upper.includes("FILE")) {
    return { category: "DELIVERABLE", label: "Deliverable" };
  }
  if (upper.includes("TASK")) {
    return { category: "TASK", label: "Tugas" };
  }
  if (upper.includes("PROJECT")) {
    return { category: "PROJECT", label: "Project" };
  }

  return { category: "ALL", label: "Operasional" };
}

export function formatActivityTitle(eventType: string): string {
  const map: Record<string, string> = {
    PROJECT_CREATED: "Project Dibuat",
    PROJECT_STATUS_CHANGED: "Status Project Diperbarui",
    PROJECT_UPDATED: "Data Project Diperbarui",
    PROJECT_PUBLISHED: "Project Resmi Dipublikasikan",
    PROJECT_ARCHIVED: "Project Diarsipkan",
    MEMBER_ADDED: "Anggota Tim Ditambahkan",
    MEMBER_REMOVED: "Anggota Tim Dikeluarkan",
    BRIEF_CREATED: "Brief Project Dibuat",
    BRIEF_UPDATED: "Brief Project Diperbarui",
    CONTENT_PLAN_CREATED: "Content Plan Ditambahkan",
    CONTENT_PLAN_UPDATED: "Content Plan Diperbarui",
    SCRIPT_CREATED: "Naskah Project Dibuat",
    SCRIPT_UPDATED: "Naskah Project Diperbarui",
    SCRIPT_READY: "Naskah Siap Produksi",
    TASK_CREATED: "Task Dibuat",
    TASK_STATUS_CHANGED: "Status Task Diperbarui",
    TASK_ASSIGNED: "Task Ditugaskan",
    TASK_REASSIGNED: "Penugasan Task Dialihkan",
    TASK_STARTED: "Pengerjaan Task Dimulai",
    TASK_UPDATED: "Data Task Diperbarui",
    TASK_ARCHIVED: "Task Diarsipkan",
    DELIVERABLE_UPLOADED: "Deliverable Diunggah",
    FILE_UPLOADED: "Berkas Deliverable Diunggah",
    FILE_VERSION_BUMPED: "Versi Deliverable Ditingkatkan",
    FILE_DELETED: "Berkas Deliverable Dihapus",
    INTERNAL_QC_STARTED: "Pemeriksaan QC Dimulai",
    QC_APPROVED: "Disetujui QC Internal",
    INTERNAL_QC_APPROVED: "Disetujui QC Internal",
    QC_REJECTED: "Catatan QC Diajukan",
    INTERNAL_QC_REJECTED: "Catatan QC Diajukan",
    INTERNAL_QC_COMPLETED: "QC Internal Selesai",
    REVISION_REQUESTED: "Catatan Revisi Diajukan",
    REVISION_RESOLVED: "Revisi Diselesaikan",
    CLIENT_REVIEW_ROUND_STARTED: "Review Klien Dibuka",
    CLIENT_FEEDBACK_RECORDED: "Hasil Review Klien Dicatat",
    CLIENT_REVISION_DISPATCHED: "Revisi Klien Diteruskan",
  };

  if (map[eventType]) {
    return map[eventType];
  }

  // Fallback: title-case the snake_case event type
  return eventType
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatActivityDescription(
  eventType: string,
  metadata: Record<string, unknown> | null | undefined
): string {
  const meta = metadata || {};

  switch (eventType) {
    case "TASK_CREATED": {
      const taskTitle = (meta.title || meta.task_title || meta.name) as string | undefined;
      const typeLabel =
        meta.task_type === "VIDEO_EDITING"
          ? "Video Editing"
          : meta.task_type === "GRAPHIC_DESIGN"
            ? "Graphic Design"
            : undefined;
      const target = taskTitle || typeLabel || "produksi baru";
      return `Pembuatan task ${target}.`;
    }

    case "TASK_ASSIGNED": {
      const taskTitle = (meta.title || meta.task_title || meta.name) as string | undefined;
      const assignee = (meta.assignee_name || meta.assigned_to_name || meta.target_user_name) as string | undefined;
      const target = taskTitle || "Task";
      if (assignee) {
        return `${target} ditugaskan kepada ${assignee}.`;
      }
      return `${target} telah ditugaskan kepada anggota tim.`;
    }

    case "TASK_STARTED": {
      const taskTitle = (meta.task_title || meta.title || meta.name) as string | undefined;
      const target = taskTitle || "task produksi";
      return `Memulai pengerjaan ${target}.`;
    }

    case "TASK_REASSIGNED": {
      const taskTitle = (meta.task_title || meta.title) as string | undefined;
      const newAssignee = (meta.new_assignee_name || meta.assignee_name) as string | undefined;
      const prevAssignee = (meta.previous_assignee_name || meta.prev_assignee_name) as string | undefined;
      const target = taskTitle ? `Task "${taskTitle}"` : "Penugasan task";
      if (newAssignee && prevAssignee) {
        return `${target} dialihkan dari ${prevAssignee} ke ${newAssignee}.`;
      }
      if (newAssignee) {
        return `${target} dialihkan penugasannya kepada ${newAssignee}.`;
      }
      return `${target} dialihkan penugasannya.`;
    }

    case "TASK_STATUS_CHANGED": {
      const title = (meta.task_title || meta.title) ? `"${meta.task_title || meta.title}"` : "task";
      const to = (meta.to_status || meta.new_status || meta.status) as string | undefined;
      if (to === "IN_REVIEW") {
        return `${title} diajukan untuk pemeriksaan QC internal.`;
      }
      if (to === "APPROVED") {
        return `${title} disetujui pada evaluasi QC.`;
      }
      if (to === "COMPLETED") {
        return `${title} telah selesai dikerjakan.`;
      }
      if (to) {
        return `Status ${title} diperbarui menjadi ${to}.`;
      }
      return `Status ${title} telah diperbarui.`;
    }

    case "TASK_UPDATED": {
      const title = (meta.task_title || meta.title) ? `task "${meta.task_title || meta.title}"` : "task";
      return `Rincian ${title} diperbarui.`;
    }

    case "TASK_ARCHIVED": {
      const title = (meta.task_title || meta.title) ? `task "${meta.task_title || meta.title}"` : "task";
      return `${title} dipindahkan ke arsip.`;
    }

    case "SCRIPT_CREATED": {
      const title = (meta.title || meta.script_title) as string | undefined;
      return `Membuat naskah project${title ? `: "${title}"` : ""}.`;
    }

    case "SCRIPT_UPDATED": {
      const title = (meta.title || meta.script_title) as string | undefined;
      return `Memperbarui naskah project${title ? `: "${title}"` : ""}.`;
    }

    case "SCRIPT_READY": {
      const title = (meta.title || meta.script_title) as string | undefined;
      return `Naskah project${title ? ` "${title}"` : ""} disetujui dan siap produksi.`;
    }

    case "CONTENT_PLAN_CREATED": {
      const title = (meta.title || meta.plan_title) as string | undefined;
      return `Menambahkan content plan${title ? `: "${title}"` : ""}.`;
    }

    case "CONTENT_PLAN_UPDATED": {
      const title = (meta.title || meta.plan_title) as string | undefined;
      return `Memperbarui content plan${title ? `: "${title}"` : ""}.`;
    }

    case "BRIEF_CREATED": {
      return "Brief project dibuat untuk arahan kampanye.";
    }

    case "BRIEF_UPDATED": {
      return "Arahan brief project diperbarui.";
    }

    case "PROJECT_STATUS_CHANGED": {
      const from = meta.previous_status || meta.old_status;
      const to = meta.new_status || meta.status;
      if (from && to) {
        return `Perubahan status alur kerja dari ${from} menuju ${to}.`;
      }
      if (to) {
        return `Status alur kerja beralih ke ${to}.`;
      }
      return "Status alur kerja project diperbarui.";
    }

    case "PROJECT_CREATED": {
      return "Project diinisiasi dengan status awal Brief Received.";
    }

    case "PROJECT_UPDATED": {
      return "Informasi detail, prioritas, atau jadwal project diperbarui.";
    }

    case "PROJECT_ARCHIVED": {
      return "Project dinonaktifkan dan dipindahkan ke dalam arsip.";
    }

    case "MEMBER_ADDED": {
      const name = (meta.full_name || meta.user_name) as string | undefined;
      return `${name || "Anggota tim"} ditambahkan ke dalam roster project.`;
    }

    case "MEMBER_REMOVED": {
      const name = (meta.full_name || meta.user_name) as string | undefined;
      return `${name || "Anggota tim"} dihapus dari daftar penugasan project.`;
    }

    case "FILE_UPLOADED":
    case "DELIVERABLE_UPLOADED": {
      const fileName = meta.file_name || meta.name;
      const version = meta.version ? `v${meta.version}` : "";
      if (fileName && version) {
        return `Mengunggah berkas ${fileName} (${version}).`;
      }
      if (fileName) {
        return `Mengunggah berkas deliverable ${fileName}.`;
      }
      return "Berkas deliverable berhasil diunggah.";
    }

    case "FILE_VERSION_BUMPED": {
      const fileName = meta.file_name || meta.name;
      const version = meta.version ? `v${meta.version}` : "";
      return `Meningkatkan versi berkas ${fileName || "deliverable"}${version ? ` menjadi ${version}` : ""}.`;
    }

    case "FILE_DELETED":
    case "FILE_SOFT_DELETED": {
      const fileName = meta.file_name || meta.name;
      return `Berkas deliverable ${fileName ? `"${fileName}"` : ""} dihapus.`;
    }

    case "INTERNAL_QC_STARTED": {
      return "Pemeriksaan Quality Control (QC) internal dimulai.";
    }

    case "QC_APPROVED":
    case "INTERNAL_QC_APPROVED":
    case "INTERNAL_QC_COMPLETED": {
      const cdName = meta.cd_name || meta.approver_name;
      if (cdName) {
        return `Seluruh deliverable telah diverifikasi dan disetujui oleh ${cdName}.`;
      }
      return "Seluruh deliverable telah diverifikasi dan disetujui pada QC internal.";
    }

    case "QC_REJECTED":
    case "INTERNAL_QC_REJECTED": {
      const notes = meta.notes ? `: "${meta.notes}"` : "";
      return `Catatan revisi internal diajukan pada evaluasi QC${notes}.`;
    }

    case "REVISION_REQUESTED": {
      const notes = meta.notes ? `: "${meta.notes}"` : "";
      const source = meta.source === "CLIENT" ? "Klien" : "QC Internal";
      return `Catatan revisi diajukan dari ${source}${notes}.`;
    }

    case "REVISION_RESOLVED": {
      return "Catatan revisi telah diselesaikan dan diperbaiki.";
    }

    case "CLIENT_REVIEW_ROUND_STARTED": {
      const round = meta.round_number || meta.round;
      if (round) {
        return `Putaran review klien ke-${round} resmi dibuka untuk evaluasi deliverable.`;
      }
      return "Putaran review klien resmi dibuka.";
    }

    case "CLIENT_FEEDBACK_RECORDED": {
      const verdict = meta.verdict || meta.overall_verdict;
      const round = meta.round_number || meta.round;
      const verdictLabel =
        verdict === "APPROVED"
          ? "Disetujui"
          : verdict === "REVISION_REQUESTED"
            ? "Perlu Revisi"
            : verdict;
      if (verdictLabel && round) {
        return `Hasil putaran ke-${round} dicatat dengan status: ${verdictLabel}.`;
      }
      if (verdictLabel) {
        return `Hasil review klien dicatat dengan status: ${verdictLabel}.`;
      }
      return "Respon evaluasi dari klien berhasil dicatat ke dalam sistem.";
    }

    case "CLIENT_REVISION_DISPATCHED": {
      return "Arahan revisi dari klien diteruskan ke tim produksi.";
    }

    case "PROJECT_PUBLISHED": {
      const date = meta.published_at || meta.date;
      if (date) {
        return `Seluruh materi project telah tayang pada tanggal ${date}.`;
      }
      return "Seluruh materi konten project telah resmi dipublikasikan.";
    }

    default: {
      // Build human sentence from key metadata fields if present, never dumping raw JSON
      const notes = meta.notes ? `Catatan: "${meta.notes}". ` : "";
      const reason = meta.reason ? `Alasan: "${meta.reason}". ` : "";
      if (notes || reason) {
        return `${notes}${reason}`.trim();
      }
      return "Pembaruan operasional dicatat dalam riwayat audit.";
    }
  }
}

/**
 * Produces a human-readable action phrase for audit activity logs.
 * Example: "membuat project", "mengunggah berkas deliverable", "menyetujui QC internal".
 * Prevents raw enum strings from ever leaking into user interfaces.
 */
export function humanizeActivityAction(
  eventType: string,
  metadata?: Record<string, unknown> | null
): string {
  const meta = metadata || {};

  switch (eventType) {
    case "PROJECT_CREATED":
      return "membuat project";
    case "PROJECT_STATUS_CHANGED": {
      const toStatus = meta.to_status ? String(meta.to_status) : undefined;
      return toStatus ? "memperbarui status project" : "memperbarui status project";
    }
    case "PROJECT_UPDATED":
      return "memperbarui rincian project";
    case "PROJECT_PUBLISHED":
      return "mempublikasikan project";
    case "PROJECT_ARCHIVED":
      return "mengarsipkan project";
    case "MEMBER_ADDED": {
      const name = meta.full_name as string | undefined;
      return name ? `menambahkan ${name} ke tim project` : "menambahkan anggota tim";
    }
    case "MEMBER_REMOVED": {
      const name = meta.full_name as string | undefined;
      return name ? `menghapus ${name} dari tim project` : "menghapus anggota tim";
    }
    case "BRIEF_CREATED":
      return "membuat brief project";
    case "BRIEF_UPDATED":
      return "memperbarui brief project";
    case "CONTENT_PLAN_CREATED":
      return "menambahkan content plan";
    case "CONTENT_PLAN_UPDATED":
      return "memperbarui content plan";
    case "SCRIPT_CREATED":
      return "membuat naskah project";
    case "SCRIPT_UPDATED":
      return "memperbarui naskah project";
    case "SCRIPT_READY":
      return "menandai naskah siap produksi";
    case "TASK_CREATED": {
      const title = (meta.title || meta.task_title || meta.name) as string | undefined;
      return title ? `membuat task "${title}"` : "membuat task baru";
    }
    case "TASK_STATUS_CHANGED": {
      const title = (meta.title || meta.task_title) as string | undefined;
      return title ? `memperbarui status task "${title}"` : "memperbarui status task";
    }
    case "TASK_ASSIGNED": {
      const assignee = (meta.assignee_name || meta.assigned_to_name) as string | undefined;
      return assignee ? `menugaskan task kepada ${assignee}` : "menugaskan task";
    }
    case "TASK_REASSIGNED": {
      const newAssignee = (meta.new_assignee_name || meta.assignee_name) as string | undefined;
      return newAssignee ? `mengalihkan task ke ${newAssignee}` : "mengalihkan penugasan task";
    }
    case "TASK_STARTED":
      return "memulai pengerjaan task";
    case "TASK_UPDATED":
      return "memperbarui data task";
    case "TASK_ARCHIVED":
      return "mengarsipkan task";
    case "DELIVERABLE_UPLOADED":
    case "FILE_UPLOADED":
      return "mengunggah berkas deliverable";
    case "FILE_VERSION_BUMPED":
      return "memperbarui versi berkas deliverable";
    case "FILE_DELETED":
      return "menghapus berkas deliverable";
    case "INTERNAL_QC_STARTED":
      return "memulai pemeriksaan QC internal";
    case "QC_APPROVED":
    case "INTERNAL_QC_APPROVED":
      return "menyetujui QC internal";
    case "QC_REJECTED":
    case "INTERNAL_QC_REJECTED":
    case "REVISION_REQUESTED":
      return "mengajukan catatan revisi";
    case "REVISION_RESOLVED":
      return "menyelesaikan revisi";
    case "CLIENT_REVIEW_ROUND_STARTED":
      return "membuka sesi review klien";
    case "CLIENT_FEEDBACK_RECORDED":
      return "mencatat hasil review klien";
    case "CLIENT_REVISION_DISPATCHED":
      return "meneruskan revisi dari klien";
    default:
      return formatActivityTitle(eventType).toLowerCase();
  }
}

