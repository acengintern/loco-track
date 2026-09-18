export interface MetricItem {
  label: string;
  value: number;
  description?: string;
  variant?: "default" | "warning" | "destructive" | "success";
}

export interface UserRoleDistributionItem {
  role: string;
  label: string;
  count: number;
}

export interface AdminAccessChangeEvent {
  id: string;
  actorName: string;
  actionLabel: string;
  targetUserName: string;
  targetUserRole?: string;
  contextName?: string;
  createdAt: string;
}

export interface AdminRecentActivityItem {
  id: string;
  eventType: string;
  actionPhrase: string;
  projectName: string;
  projectId?: string;
  actorName: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface AdminDashboardData {
  activeUsersCount: number;
  inactiveUsersCount: number;
  activeProjectsCount: number;
  auditActivity7DaysCount: number;
  overdueProjectsCount: number;
  publishedProjectsCount: number;
  userDistribution: UserRoleDistributionItem[];
  recentAccessChanges: AdminAccessChangeEvent[];
  workflowDistribution: Array<{
    status: string;
    label: string;
    count: number;
  }>;
  recentActivity: AdminRecentActivityItem[];
}

export interface CreativeDirectorDashboardData {
  tasksWaitingQcCount: number;
  tasksInRevisionCount: number;
  projectsInQcCount: number;
  upcomingDeadlinesCount: number;
  qcQueue: Array<{
    taskId: string;
    taskTitle: string;
    projectId: string;
    projectName: string;
    assigneeName: string;
    deadline: string;
    version: number;
  }>;
  revisionQueue: Array<{
    taskId: string;
    taskTitle: string;
    projectId: string;
    projectName: string;
    assigneeName: string;
    notes: string;
    roundNumber: number;
  }>;
  creativeWorkloadSummary: Array<{
    creativeId: string;
    creativeName: string;
    role: string;
    activeTasksCount: number;
    inReviewCount: number;
  }>;
}

export interface AccountExecutiveDashboardData {
  activeProjectsCount: number;
  clientReviewProjectsCount: number;
  overdueProjectsCount: number;
  publishedProjectsCount: number;
  clientReviewProjects: Array<{
    projectId: string;
    projectName: string;
    brandName: string;
    roundNumber: number;
    deadline: string;
    smsOwnerName: string;
  }>;
  upcomingDeadlines: Array<{
    projectId: string;
    projectName: string;
    brandName: string;
    status: string;
    deadline: string;
    isOverdue: boolean;
  }>;
}

export interface SmsDashboardData {
  myActiveProjectsCount: number;
  awaitingClientProjectsCount: number;
  readyToPublishProjectsCount: number;
  overdueOwnedProjectsCount: number;
  readyForClient: Array<{
    projectId: string;
    projectName: string;
    brandName: string;
    deadline: string;
  }>;
  readyToPublish: Array<{
    projectId: string;
    projectName: string;
    brandName: string;
    deadline: string;
  }>;
  activeClientRevisions: Array<{
    taskId: string;
    taskTitle: string;
    projectId: string;
    projectName: string;
    creativeName: string;
    notes: string;
  }>;
  ownedProjects: Array<{
    projectId: string;
    projectName: string;
    brandName: string;
    status: string;
    deadline: string;
    isOverdue: boolean;
  }>;
}

export interface CreativePriorityTask {
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectName: string;
  status: string;
  priority: string;
  deadline: string;
  isOverdue: boolean;
  isDueSoon: boolean;
  isToday: boolean;
  revisionSource?: "INTERNAL_QC" | "CLIENT" | null;
  revisionSourceLabel?: "Revisi Internal" | "Revisi dari Client" | null;
  ctaText?: string;
  ctaHref: string;
}

export interface CreativeFeedbackItem {
  id: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectName: string;
  version: number | null;
  source: "INTERNAL_QC" | "CLIENT";
  sourceLabel: "Revisi Internal" | "Revisi dari Client";
  notes: string;
  createdAt: string;
}

export interface CreativeProjectSummaryItem {
  id: string;
  projectCode: string;
  name: string;
  clientName: string;
  brandName: string;
  myActiveTasksCount: number;
  myNearestDeadline: string | null;
  hasActiveRevision: boolean;
  revisionCount: number;
}

export interface CreativeDashboardData {
  myActiveTasksCount: number;
  revisionRequestedCount: number;
  urgentOrOverdueCount: number;
  overdueCount: number;
  inReviewCount: number;
  totalAssignedTasksCount: number;
  priorityTasks: CreativePriorityTask[];
  recentFeedbacks: CreativeFeedbackItem[];
  myProjects: CreativeProjectSummaryItem[];
  activeTasks: Array<{
    taskId: string;
    taskTitle: string;
    projectId: string;
    projectName: string;
    status: string;
    priority: string;
    deadline: string;
    isOverdue: boolean;
    isDueSoon: boolean;
  }>;
  recentCompletedTasks: Array<{
    taskId: string;
    taskTitle: string;
    projectId: string;
    projectName: string;
    completedAt: string;
  }>;
}

