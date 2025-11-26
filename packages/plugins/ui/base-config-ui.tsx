"use client";

import type { ReactNode } from "react";

interface BaseConfigUIProps {
  children: ReactNode;
  /**
   * Optional title for the config UI
   */
  title?: string;
  /**
   * Optional description
   */
  description?: string;
}

/**
 * Base wrapper component for plugin configuration UIs
 *
 * Provides consistent spacing, layout, and styling across all plugin configs.
 * Use this as a wrapper for your plugin's config UI.
 *
 * @example
 * ```tsx
 * <BaseConfigUI title="HTTP Request Configuration">
 *   <ConfigSection label="URL">
 *     <Input ... />
 *   </ConfigSection>
 * </BaseConfigUI>
 * ```
 */
export function BaseConfigUI({
  children,
  title,
  description,
}: BaseConfigUIProps) {
  return (
    <div className="space-y-6">
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          )}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
