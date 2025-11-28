/**
 * Shared type inference utilities for expression components.
 *
 * Provides consistent type inference across ExpressionInput, ExpressionDataPicker,
 * and related components.
 */

import type { CompletionItemType } from "../components/expression-input";

/**
 * Infer the CompletionItemType from a runtime value.
 *
 * Used for:
 * - Type badges in tree views
 * - Autocomplete type hints
 * - Preview type detection
 *
 * @param value - The value to infer the type of
 * @returns The inferred CompletionItemType
 */
export function inferType(value: unknown): CompletionItemType {
  if (value === null) return "null";
  if (value === undefined) return "obj"; // Default for unknown
  if (Array.isArray(value)) return "arr";
  if (typeof value === "string") return "str";
  if (typeof value === "number") return "num";
  if (typeof value === "boolean") return "bool";
  if (typeof value === "object") return "obj";
  return "obj"; // Default fallback
}
