"use client";

import type { ReactNode } from "react";
import { Label } from "@kianax/ui/components/label";

interface ConfigSectionProps {
  /**
   * Section label
   */
  label: string;
  /**
   * Optional description text shown below the label
   */
  description?: string;
  /**
   * Optional action button/element shown next to the label
   */
  action?: ReactNode;
  /**
   * Form controls (Input, Select, Textarea, etc.)
   */
  children: ReactNode;
  /**
   * Whether this field is required
   */
  required?: boolean;
  /**
   * Error message to display
   */
  error?: string;
}

/**
 * Reusable section component for plugin configuration UIs
 *
 * Provides consistent label, description, and spacing for config fields.
 *
 * @example
 * ```tsx
 * <ConfigSection label="URL" description="The endpoint to call" required>
 *   <Input value={url} onChange={...} />
 * </ConfigSection>
 *
 * <ConfigSection
 *   label="Headers"
 *   action={<Button onClick={addHeader}>Add</Button>}
 * >
 *   {headers.map(...)}
 * </ConfigSection>
 * ```
 */
export function ConfigSection({
  label,
  description,
  action,
  children,
  required,
  error,
}: ConfigSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium text-foreground">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1.5">
          <span className="flex h-3 w-3 items-center justify-center rounded-full bg-destructive/10 text-[8px] font-bold">
            !
          </span>
          {error}
        </p>
      )}
    </div>
  );
}
