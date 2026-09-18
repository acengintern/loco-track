import * as React from "react";
import { cn } from "cn";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 pb-8 md:pb-10 md:flex-row md:items-center md:justify-between",
        className
      )}
    >
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-[30px]">
          {title}
        </h1>
        {description && (
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 items-center gap-2.5 pt-2 md:pt-0">
          {children}
        </div>
      )}
    </div>
  );
}
