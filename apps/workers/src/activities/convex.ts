/**
 * Convex Update Activities
 *
 * Activities that update Convex database with execution status.
 * These activities call Convex mutations to store real-time status.
 */

import { ConvexHttpClient } from "convex/browser";
import type {
  CreateRoutineExecutionInput,
  UpdateRoutineStatusInput,
  StoreNodeResultInput,
} from "@kianax/shared/temporal";
import { api } from "../../../server/convex/_generated/api";

/**
 * Lazy initialization of Convex client
 * This ensures env vars are loaded before the client is created
 */
let convexClient: ConvexHttpClient | null = null;

export function getConvexClient(): ConvexHttpClient {
  if (!convexClient) {
    const convexUrl = process.env.CONVEX_URL;

    if (!convexUrl) {
      throw new Error(
        "CONVEX_URL environment variable is required. Make sure .env exists in apps/workers/ with CONVEX_URL set.",
      );
    }

    console.log(`✅ Convex client initialized: ${convexUrl}`);
    convexClient = new ConvexHttpClient(convexUrl);
  }

  return convexClient;
}

/**
 * Create routine execution record
 * Called at the start of a workflow
 */
export async function createRoutineExecution(
  input: CreateRoutineExecutionInput,
): Promise<void> {
  try {
    const convex = getConvexClient();
    await convex.mutation(api.executions.create, {
      routineId: input.routineId as any, // Type conversion for Convex ID
      userId: input.userId,
      workflowId: input.workflowId,
      runId: input.runId,
      triggerType: input.triggerType,
      ...(input.triggerData !== undefined && {
        triggerData: input.triggerData,
      }),
    });
  } catch (error: any) {
    console.error("Failed to create routine execution:", error);
    // Don't throw - we don't want Convex create failures to fail the workflow
  }
}

/**
 * Update routine execution status
 * Called by workflow during execution lifecycle
 */
export async function updateRoutineStatus(
  input: UpdateRoutineStatusInput,
): Promise<void> {
  try {
    const convex = getConvexClient();
    await convex.mutation(api.executions.updateStatus, {
      workflowId: input.workflowId,
      status:
        input.status === "running"
          ? "running"
          : input.status === "completed"
            ? "completed"
            : input.status === "failed"
              ? "failed"
              : "cancelled",
      ...(input.startedAt !== undefined && { startedAt: input.startedAt }),
      ...(input.completedAt !== undefined && {
        completedAt: input.completedAt,
      }),
      ...(input.error !== undefined && { error: input.error }),
      ...(input.executionPath !== undefined && {
        executionPath: input.executionPath,
      }),
    });
  } catch (error: any) {
    console.error("Failed to update routine status:", error);
    // Don't throw - we don't want Convex update failures to fail the workflow
  }
}

/**
 * Store node execution result
 * Called by workflow after each node executes
 */
export async function storeNodeResult(
  input: StoreNodeResultInput,
): Promise<void> {
  try {
    const convex = getConvexClient();
    await convex.mutation(api.executions.storeNodeResult, {
      workflowId: input.workflowId,
      nodeId: input.nodeId,
      ...(input.iteration !== undefined && { iteration: input.iteration }),
      status: input.status,
      ...(input.output !== undefined && { output: input.output }),
      ...(input.error !== undefined && { error: input.error }),
      completedAt: input.completedAt,
    });
  } catch (error: any) {
    console.error("Failed to store node result:", error);
    // Don't throw - we don't want Convex update failures to fail the workflow
  }
}
