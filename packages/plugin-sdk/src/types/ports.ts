/**
 * Enhanced Port System
 *
 * Type-safe port definitions with explicit port types for different data flows.
 * Inspired by n8n's connection type system.
 */

import type { z } from "zod";

/**
 * Port type enumeration
 *
 * Currently only Main is supported. Future port types (Config, Error, etc.)
 * can be added when needed and will be used for UI/validation, not execution logic.
 */
export enum PortType {
  /** Standard data flow between nodes */
  Main = "main",
}

/**
 * Port definition for inputs and outputs
 */
export interface PortDefinition {
  /** Unique port identifier (used in connections) */
  name: string;

  /** Port type (controls what can connect) */
  type: PortType;

  /** Display label for UI */
  label: string;

  /** Description for documentation */
  description?: string;

  /** Zod schema for validation */
  schema: z.ZodType;

  /** Whether this port is required (for inputs) */
  required?: boolean;

  /** Allow multiple connections to this port */
  multiple?: boolean;
}

/**
 * Port metadata (serializable version for storage/transfer)
 */
export interface PortMetadata {
  name: string;
  type: PortType;
  label: string;
  description?: string;
  schemaJson: string; // Serialized zod schema
  required: boolean;
  multiple: boolean;
}

/**
 * Helper to create a port definition
 */
export function definePort(
  name: string,
  options: {
    type?: PortType;
    label?: string;
    description?: string;
    schema: z.ZodType;
    required?: boolean;
    multiple?: boolean;
  },
): PortDefinition {
  return {
    name,
    type: options.type ?? PortType.Main,
    label: options.label ?? name,
    description: options.description,
    schema: options.schema,
    required: options.required ?? false,
    multiple: options.multiple ?? false,
  };
}

/**
 * Helper to convert port definition to metadata
 */
export function portToMetadata(port: PortDefinition): PortMetadata {
  return {
    name: port.name,
    type: port.type,
    label: port.label,
    description: port.description,
    schemaJson: JSON.stringify(port.schema),
    required: port.required ?? false,
    multiple: port.multiple ?? false,
  };
}

/**
 * Type guard to check if a string is a valid PortType
 */
export function isPortType(value: string): value is PortType {
  return Object.values(PortType).includes(value as PortType);
}
