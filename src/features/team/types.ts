export interface CreativeTaskSummary {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  status: string;
  deadline: string | null;
  isOverdue: boolean;
  isDueSoon: boolean;
}

export interface CreativeWorkloadMember {
  id: string;
  fullName: string;
  email: string;
  role: "GRAPHIC_DESIGNER" | "VIDEO_EDITOR";
  avatarUrl: string | null;
  totalActiveTasks: number;
  todoCount: number;
  inProgressCount: number;
  revisionCount: number;
  inReviewCount: number;
  dueSoonCount: number;
  overdueCount: number;
  tasks: CreativeTaskSummary[];
}

export interface UrgentTaskItem {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  assigneeName: string;
  assigneeRole: "GRAPHIC_DESIGNER" | "VIDEO_EDITOR";
  status: string;
  deadline: string | null;
  urgencyLabel: string;
  isOverdue: boolean;
  isDueToday: boolean;
  isDueTomorrow: boolean;
}

export interface TeamStatusDistribution {
  todo: number;
  inProgress: number;
  revision: number;
  inReview: number;
  total: number;
}

export interface TeamDeadlineRisk {
  overdue: number;
  dueSoon: number;
  safe: number;
  noDeadline: number;
  total: number;
}

export interface TeamWorkloadData {
  members: CreativeWorkloadMember[];
  totalActiveCreatives: number;
  totalActiveTasks: number;
  totalDueSoonTasks: number;
  totalOverdueTasks: number;
  statusDistribution: TeamStatusDistribution;
  deadlineRisk: TeamDeadlineRisk;
  nearestDeadlines: UrgentTaskItem[];
}
