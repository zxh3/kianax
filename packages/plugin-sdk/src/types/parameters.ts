/**
 * Declarative Parameter System
 *
 * Define plugin parameters declaratively to auto-generate configuration UIs.
 * Inspired by n8n's parameter system with conditional display and rich types.
 */

import type { z } from "zod";

/**
 * Parameter types supported by the system
 */
export enum ParameterType {
  // Basic types
  String = "string",
  Number = "number",
  Boolean = "boolean",

  // Selection types
  Select = "select",
  MultiSelect = "multiSelect",

  // Structured types
  Json = "json",
  Code = "code",

  // Resource types
  Credential = "credential",
  ResourceLocator = "resourceLocator", // Smart resource picker with search

  // Complex types
  Collection = "collection", // Nested object
  FixedCollection = "fixedCollection", // Multiple named collections

  // UI elements
  Notice = "notice", // Info/warning/error display
  Button = "button", // Trigger action
  Hidden = "hidden", // Hidden field (for internal state)
}

/**
 * Display condition for conditional parameter visibility
 */
export interface DisplayCondition {
  /** Show parameter when another parameter has these values */
  show?: Record<string, unknown[]>;
  /** Hide parameter when another parameter has these values */
  hide?: Record<string, unknown[]>;
}

/**
 * Parameter option (for select/multiSelect)
 */
export interface ParameterOption {
  /** Display text */
  name: string;
  /** Actual value */
  value: unknown;
  /** Optional description */
  description?: string;
}

/**
 * Type-specific options
 */
export interface ParameterTypeOptions {
  // Number constraints
  minValue?: number;
  maxValue?: number;
  numberPrecision?: number;

  // String constraints
  rows?: number; // For textarea
  password?: boolean; // Mask input

  // Collection options
  multipleValues?: boolean;
  sortable?: boolean;

  // Dynamic loading
  loadOptionsMethod?: string; // Method name for loading options dynamically
  loadOptionsDependsOn?: string[]; // Parameters this depends on
}

/**
 * Parameter definition for plugins
 */
export interface ParameterDefinition {
  /** Parameter name (key in config object) */
  name: string;

  /** Parameter type */
  type: ParameterType;

  /** Display name in UI */
  displayName: string;

  /** Description/help text */
  description?: string;

  /** Default value */
  default?: unknown;

  /** Whether parameter is required */
  required?: boolean;

  /** Placeholder text */
  placeholder?: string;

  /** Conditional display rules */
  displayOptions?: DisplayCondition;

  /** Options for select/multiSelect */
  options?: ParameterOption[];

  /** Type-specific configuration */
  typeOptions?: ParameterTypeOptions;

  /** Zod schema for validation */
  validation?: z.ZodType;

  /** Disable expressions/variables in this field */
  noExpressions?: boolean;
}

/**
 * Parameter metadata (serializable)
 */
export interface ParameterMetadata {
  name: string;
  type: ParameterType;
  displayName: string;
  description?: string;
  default?: unknown;
  required: boolean;
  placeholder?: string;
  displayOptions?: DisplayCondition;
  options?: ParameterOption[];
  typeOptions?: ParameterTypeOptions;
  validationJson?: string; // Serialized zod schema
}

/**
 * Helper to create a parameter definition
 */
export function defineParameter(
  name: string,
  options: Omit<ParameterDefinition, "name">,
): ParameterDefinition {
  return {
    name,
    ...options,
  };
}

/**
 * Helper to convert parameter to metadata
 */
export function parameterToMetadata(
  param: ParameterDefinition,
): ParameterMetadata {
  return {
    name: param.name,
    type: param.type,
    displayName: param.displayName,
    description: param.description,
    default: param.default,
    required: param.required ?? false,
    placeholder: param.placeholder,
    displayOptions: param.displayOptions,
    options: param.options,
    typeOptions: param.typeOptions,
    validationJson: param.validation
      ? JSON.stringify(param.validation)
      : undefined,
  };
}

/**
 * Type guard for ParameterType
 */
export function isParameterType(value: string): value is ParameterType {
  return Object.values(ParameterType).includes(value as ParameterType);
}

/**
 * Helper to check if a parameter should be shown based on current values
 */
export function shouldShowParameter(
  param: ParameterDefinition,
  currentValues: Record<string, unknown>,
): boolean {
  if (!param.displayOptions) {
    return true;
  }

  // Check show conditions
  if (param.displayOptions.show) {
    for (const [key, allowedValues] of Object.entries(
      param.displayOptions.show,
    )) {
      const currentValue = currentValues[key];
      if (!allowedValues.includes(currentValue)) {
        return false;
      }
    }
  }

  // Check hide conditions
  if (param.displayOptions.hide) {
    for (const [key, hiddenValues] of Object.entries(
      param.displayOptions.hide,
    )) {
      const currentValue = currentValues[key];
      if (hiddenValues.includes(currentValue)) {
        return false;
      }
    }
  }

  return true;
}
