import * as React from "react";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  ClipboardCheck,
  Users,
  Activity,
  Settings,
  type LucideProps,
} from "lucide-react";
import type { NavigationItem } from "@/constants/navigation";

interface NavIconProps extends Omit<LucideProps, "ref"> {
  name: NavigationItem["iconName"];
}

export function NavIcon({ name, className, ...props }: NavIconProps) {
  switch (name) {
    case "LayoutDashboard":
      return <LayoutDashboard className={className} {...props} />;
    case "FolderKanban":
      return <FolderKanban className={className} {...props} />;
    case "CheckSquare":
      return <CheckSquare className={className} {...props} />;
    case "ClipboardCheck":
      return <ClipboardCheck className={className} {...props} />;
    case "Users":
      return <Users className={className} {...props} />;
    case "Activity":
      return <Activity className={className} {...props} />;
    case "Settings":
      return <Settings className={className} {...props} />;
    default:
      return <LayoutDashboard className={className} {...props} />;
  }
}
