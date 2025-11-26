"use client";

import type { ReactNode } from "react";

interface InfoCardProps {
  title?: string;
  children: ReactNode;
  variant?: "info" | "warning" | "success";
}

/**
 * Reusable info card component for plugin config UIs
 *
 * Displays helpful information, tips, or warnings to users
 * when configuring a plugin.
 */
export function InfoCard({
  title = "Usage Tip",
  children,
  variant = "info",
}: InfoCardProps) {
  const variantStyles = {
    info: {
      bg: "bg-blue-500/10",
      text: "text-blue-600 dark:text-blue-400",
    },
    warning: {
      bg: "bg-amber-500/10",
      text: "text-amber-600 dark:text-amber-400",
    },
    success: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-600 dark:text-emerald-400",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="p-4 bg-muted/50 border border-border rounded-xl text-sm text-muted-foreground">
      <p className="font-medium text-foreground mb-1 flex items-center gap-2">
        <span
          className={`flex h-4 w-4 items-center justify-center rounded-full ${styles.bg} text-[10px] font-bold ${styles.text}`}
        >
          i
        </span>
        {title}
      </p>
      <div className="text-xs leading-relaxed">{children}</div>
    </div>
  );
}
