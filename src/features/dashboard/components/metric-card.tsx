import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export interface MetricCardProps {
  label: string;
  value: number | string;
  description?: string;
  variant?: "default" | "warning" | "destructive" | "success";
  icon?: React.ReactNode;
  className?: string;
}

const variantStyles = {
  default: {
    badge: "border-border/60 bg-muted/50 text-foreground",
    value: "text-foreground",
    indicator: "bg-muted-foreground",
  },
  warning: {
    badge: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    value: "text-amber-700 dark:text-amber-400",
    indicator: "bg-amber-500",
  },
  destructive: {
    badge: "border-destructive/20 bg-destructive/10 text-destructive",
    value: "text-destructive",
    indicator: "bg-destructive",
  },
  success: {
    badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    value: "text-emerald-700 dark:text-emerald-400",
    indicator: "bg-emerald-500",
  },
};

export function MetricCard({
  label,
  value,
  description,
  variant = "default",
  icon,
  className,
}: MetricCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card
      className={cn(
        "flex flex-col justify-between p-5 transition-colors h-full min-h-[136px]",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {icon && (
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className={cn("text-2xl font-bold tracking-tight tabular-nums", styles.value)}>
          {value}
        </div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {description}
          </p>
        )}
      </div>
    </Card>
  );
}
