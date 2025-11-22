/**
 * Kianax Type Definitions
 *
 * Central export for all type definitions used across the application.
 */

// Plugin types
export type {
  Plugin,
  PluginContext,
  PluginMetadata,
  InstalledPlugin,
  PluginCredentials,
  CredentialSchema,
} from "./plugin";

// Routine types (formerly "workflow" - renamed to avoid confusion with Temporal Workflows)
export type {
  Routine,
  RoutineNode,
  RoutineConnection,
  RoutineStatus,
  RoutineCreateInput,
  RoutineUpdateInput,
  RoutineTemplate,
  RoutineValidationError,
  RoutineValidationResult,
  Position,
} from "./routine";

// Execution types
export type {
  RoutineExecution,
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
    maxRoutines: number;
    maxExecutionsPerMonth: number;
    maxPlugins: number;
  };
  updatedAt: number;
}
