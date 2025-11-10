/**
 * Validation Utilities
 *
 * Zod-based validation for plugin inputs, outputs, and configuration.
 */

import type { z } from "zod";

/**
 * Plugin validation error
 */
export class PluginValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: z.ZodIssue[],
  ) {
    super(message);
    this.name = "PluginValidationError";
  }
}

/**
 * Validate plugin input against schema
 *
 * @throws {PluginValidationError} If validation fails
 */
export function validateInput<T extends z.ZodType>(
  data: unknown,
  schema: T,
): z.infer<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new PluginValidationError(
      "Plugin input validation failed",
      result.error.issues,
    );
  }

  return result.data;
}

/**
 * Validate plugin output against schema
 *
 * @throws {PluginValidationError} If validation fails
 */
export function validateOutput<T extends z.ZodType>(
  data: unknown,
  schema: T,
): z.infer<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new PluginValidationError(
      "Plugin output validation failed",
      result.error.issues,
    );
  }

  return result.data;
}

/**
 * Validate plugin configuration against schema
 *
 * @throws {PluginValidationError} If validation fails
 */
export function validateConfig<T extends z.ZodType>(
  data: unknown,
  schema: T,
): z.infer<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new PluginValidationError(
      "Plugin configuration validation failed",
      result.error.issues,
    );
  }

  return result.data;
}
