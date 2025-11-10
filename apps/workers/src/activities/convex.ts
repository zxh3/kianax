/**
 * Convex Update Activities
 *
 * Activities that update Convex database with execution status.
 * These activities call Convex mutations to store real-time status.
 */

import { ConvexHttpClient } from "convex/browser";
import type {
  UpdateRoutineStatusInput,
  StoreNodeResultInput,
} from "@kianax/shared/temporal";
import { api } from "../../../server/convex/_generated/api";

// Initialize Convex client
const convex = new ConvexHttpClient(
  process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL || "",
);

/**
 * Update routine execution status
 * Called by workflow during execution lifecycle
 */
export async function updateRoutineStatus(
  input: UpdateRoutineStatusInput,
): Promise<void> {
  try {
    await convex.mutation(api.executions.updateStatus, {
      workflowId: input.workflowId,
      status: input.status === "running" ? "running"
        : input.status === "completed" ? "completed"
        : input.status === "failed" ? "failed"
        : "cancelled",
      ...(input.startedAt !== undefined && { startedAt: input.startedAt }),
      ...(input.completedAt !== undefined && { completedAt: input.completedAt }),
      ...(input.error !== undefined && { error: input.error }),
      ...(input.executionPath !== undefined && { executionPath: input.executionPath }),
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
    await convex.mutation(api.executions.storeNodeResult, {
      workflowId: input.workflowId,
      nodeId: input.nodeId,
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
