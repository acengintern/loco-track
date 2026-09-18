import type { ApprovalQueueItem, ApprovalQueueStats } from "./types";

/**
 * Calculates summary metrics for the active approvals queue.
 * Pure function safe for both Client and Server Components.
 */
export function getApprovalQueueStats(items: ApprovalQueueItem[]): ApprovalQueueStats {
  const totalInReview = items.length;
  const urgentCount = items.filter((i) => i.priority === "HIGH" || i.priority === "URGENT").length;
  const revisionRoundCount = items.filter((i) => i.has_prior_revisions).length;

  const now = new Date();
  const criticalDeadlineCount = items.filter((i) => {
    if (!i.deadline) return false;
    const deadlineDate = new Date(i.deadline);
    const diffDays = Math.round((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 3;
  }).length;

  return {
    totalInReview,
    urgentCount,
    revisionRoundCount,
    criticalDeadlineCount,
  };
}
