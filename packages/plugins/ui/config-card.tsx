"use client";

import type { ReactNode } from "react";
import { Button } from "@kianax/ui/components/button";
import { IconTrash } from "@tabler/icons-react";

interface ConfigCardProps {
  /**
   * Card title (e.g., "Condition 1", "Header 1")
   */
  title?: string;
  /**
   * Card content
   */
  children: ReactNode;
  /**
   * Whether the card can be removed
   */
  removable?: boolean;
  /**
   * Callback when remove button is clicked
   */
  onRemove?: () => void;
  /**
   * Optional className for custom styling
   */
  className?: string;
}

/**
 * Reusable card component for repeated config items
 *
 * Used for things like condition groups, header entries, etc.
 * Provides a consistent card design with optional remove button.
 *
 * @example
 * ```tsx
 * <ConfigCard
 *   title="Condition 1"
 *   removable
 *   onRemove={() => removeCondition(0)}
 * >
 *   <Input ... />
 * </ConfigCard>
 * ```
 */
export function ConfigCard({
  title,
  children,
  removable,
  onRemove,
  className = "",
}: ConfigCardProps) {
  return (
    <div
      className={`relative p-4 border border-border rounded-xl bg-card shadow-sm transition-all hover:border-ring group ${className}`}
    >
      {/* Card Header */}
      {(title || removable) && (
        <div className="flex items-center justify-between mb-3">
          {title && (
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {title}
            </span>
          )}
          {removable && onRemove && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-1"
              onClick={onRemove}
              title="Remove"
            >
              <IconTrash className="size-3.5" />
            </Button>
          )}
        </div>
      )}

      {/* Card Content */}
      {children}
    </div>
  );
}
