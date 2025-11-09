/**
 * Kianax Type Definitions
 *
 * Central export for all type definitions used across the application.
 */

// Plugin types
export type {
  Plugin,
  PluginType,
  PluginContext,
  PluginMetadata,
  InstalledPlugin,
  PluginCredentials,
  CredentialSchema,
} from "./plugin";

// Workflow types
export type {
  Workflow,
  WorkflowNode,
  WorkflowConnection,
  WorkflowStatus,
  WorkflowCreateInput,
  WorkflowUpdateInput,
  WorkflowTemplate,
  WorkflowValidationError,
  WorkflowValidationResult,
  Position,
} from "./workflow";

// Execution types
export type {
  WorkflowExecution,
  ExecutionStatus,
  NodeExecutionState,
  ExecutionLog,
  ExecutionStatistics,
  ExecutionEvent,
} from "./execution";

// User types
export interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
  createdAt: number;
}

// Settings types
export interface UserSettings {
  userId: string;
  notifications: {
    email: boolean;
    executionFailures: boolean;
    executionSuccess: boolean;
  };
  preferences: {
    theme: "light" | "dark" | "system";
    timezone: string;
  };
  quotas: {
    maxWorkflows: number;
    maxExecutionsPerMonth: number;
    maxPlugins: number;
  };
  updatedAt: number;
}
