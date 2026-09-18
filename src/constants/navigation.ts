import type { UserRole } from "@/lib/supabase/provisioning";

export interface NavigationItem {
  title: string;
  href: string;
  iconName:
    | "LayoutDashboard"
    | "FolderKanban"
    | "CheckSquare"
    | "ClipboardCheck"
    | "Users"
    | "Activity"
    | "Settings";
}

/**
 * Human-facing role display labels (Section 11).
 * Raw enum strings must never be displayed in the UI.
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrator",
  CREATIVE_DIRECTOR: "Creative Director",
  ACCOUNT_EXECUTIVE: "Account Executive",
  SOCIAL_MEDIA_SPECIALIST: "Social Media Specialist",
  GRAPHIC_DESIGNER: "Graphic Designer",
  VIDEO_EDITOR: "Video Editor",
};

/**
 * Role-specific navigation items (Section 10).
 */
export const ROLE_NAVIGATION: Record<UserRole, NavigationItem[]> = {
  ADMIN: [
    { title: "Dashboard", href: "/dashboard", iconName: "LayoutDashboard" },
    { title: "Users", href: "/users", iconName: "Users" },
    { title: "Activity", href: "/activity", iconName: "Activity" },
    { title: "Settings", href: "/settings", iconName: "Settings" },
  ],
  CREATIVE_DIRECTOR: [
    { title: "Dashboard", href: "/dashboard", iconName: "LayoutDashboard" },
    { title: "Projects", href: "/projects", iconName: "FolderKanban" },
    { title: "Approvals", href: "/approvals", iconName: "ClipboardCheck" },
    { title: "Team / Workload", href: "/team", iconName: "Users" },
    { title: "Activity", href: "/activity", iconName: "Activity" },
  ],
  ACCOUNT_EXECUTIVE: [
    { title: "Dashboard", href: "/dashboard", iconName: "LayoutDashboard" },
    { title: "Projects", href: "/projects", iconName: "FolderKanban" },
    { title: "Team / Workload", href: "/team", iconName: "Users" },
    { title: "Activity", href: "/activity", iconName: "Activity" },
  ],
  SOCIAL_MEDIA_SPECIALIST: [
    { title: "Dashboard", href: "/dashboard", iconName: "LayoutDashboard" },
    { title: "Projects", href: "/projects", iconName: "FolderKanban" },
    { title: "My Tasks", href: "/tasks", iconName: "CheckSquare" },
    { title: "Activity", href: "/activity", iconName: "Activity" },
  ],
  GRAPHIC_DESIGNER: [
    { title: "Dashboard", href: "/dashboard", iconName: "LayoutDashboard" },
    { title: "My Tasks", href: "/tasks", iconName: "CheckSquare" },
    { title: "Projects", href: "/projects", iconName: "FolderKanban" },
    { title: "Activity", href: "/activity", iconName: "Activity" },
  ],
  VIDEO_EDITOR: [
    { title: "Dashboard", href: "/dashboard", iconName: "LayoutDashboard" },
    { title: "My Tasks", href: "/tasks", iconName: "CheckSquare" },
    { title: "Projects", href: "/projects", iconName: "FolderKanban" },
    { title: "Activity", href: "/activity", iconName: "Activity" },
  ],
};

/**
 * Route authorization matrix (Section 18).
 * Enforces server-side route guards before page rendering.
 */
export const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  "/dashboard": [
    "ADMIN",
    "CREATIVE_DIRECTOR",
    "ACCOUNT_EXECUTIVE",
    "SOCIAL_MEDIA_SPECIALIST",
    "GRAPHIC_DESIGNER",
    "VIDEO_EDITOR",
  ],
  "/projects": [
    "ADMIN",
    "CREATIVE_DIRECTOR",
    "ACCOUNT_EXECUTIVE",
    "SOCIAL_MEDIA_SPECIALIST",
    "GRAPHIC_DESIGNER",
    "VIDEO_EDITOR",
  ],
  "/clients": [
    "ADMIN",
    "CREATIVE_DIRECTOR",
    "ACCOUNT_EXECUTIVE",
    "SOCIAL_MEDIA_SPECIALIST",
  ],
  "/brands": [
    "ADMIN",
    "CREATIVE_DIRECTOR",
    "ACCOUNT_EXECUTIVE",
    "SOCIAL_MEDIA_SPECIALIST",
  ],
  "/tasks": [
    "ADMIN",
    "SOCIAL_MEDIA_SPECIALIST",
    "GRAPHIC_DESIGNER",
    "VIDEO_EDITOR",
  ],
  "/approvals": [
    "ADMIN",
    "CREATIVE_DIRECTOR",
    "ACCOUNT_EXECUTIVE",
    "SOCIAL_MEDIA_SPECIALIST",
  ],
  "/team": ["ADMIN", "CREATIVE_DIRECTOR", "ACCOUNT_EXECUTIVE"],
  "/activity": [
    "ADMIN",
    "CREATIVE_DIRECTOR",
    "ACCOUNT_EXECUTIVE",
    "SOCIAL_MEDIA_SPECIALIST",
    "GRAPHIC_DESIGNER",
    "VIDEO_EDITOR",
  ],
  "/users": ["ADMIN"],
  "/settings": [
    "ADMIN",
    "CREATIVE_DIRECTOR",
    "ACCOUNT_EXECUTIVE",
    "SOCIAL_MEDIA_SPECIALIST",
    "GRAPHIC_DESIGNER",
    "VIDEO_EDITOR",
  ],
  "/notifications": [
    "ADMIN",
    "CREATIVE_DIRECTOR",
    "ACCOUNT_EXECUTIVE",
    "SOCIAL_MEDIA_SPECIALIST",
    "GRAPHIC_DESIGNER",
    "VIDEO_EDITOR",
  ],
};

/**
 * Checks if a given role is authorized to access a route.
 */
export function isRouteAuthorized(pathname: string, role: UserRole): boolean {
  // Check exact route or root segment
  const matchedRoute = Object.keys(ROUTE_PERMISSIONS).find(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (!matchedRoute) {
    // Unmapped routes default to authorized if within authenticated shell
    return true;
  }

  const allowedRoles = ROUTE_PERMISSIONS[matchedRoute];
  return allowedRoles.includes(role);
}

/**
 * Contextual dashboard empty-state text per role (Section 23).
 * No fabricated statistics or fake metrics.
 */
export const ROLE_DASHBOARD_DESCRIPTIONS: Record<UserRole, string> = {
  ADMIN: "Kelola akun pengguna, hak akses, dan audit aktivitas operasional.",
  CREATIVE_DIRECTOR: "Pantau produksi dan review yang membutuhkan perhatian.",
  ACCOUNT_EXECUTIVE: "Pantau progres project dan deadline tim.",
  SOCIAL_MEDIA_SPECIALIST: "Kelola project, assignment, dan alur client review.",
  GRAPHIC_DESIGNER: "Lihat pekerjaan desain yang ditugaskan kepada Anda.",
  VIDEO_EDITOR: "Lihat pekerjaan editing yang ditugaskan kepada Anda.",
};
