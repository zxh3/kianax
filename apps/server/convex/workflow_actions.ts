"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Client, Connection } from "@temporalio/client";
import { requireAuthUser } from "./auth";

/**
 * Start a routine execution via Temporal
 */
export const startRoutine = action({
  args: {
    routineId: v.id("routines"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ workflowId: string; runId: string }> => {
    const user = await requireAuthUser(ctx);

    // 1. Fetch the routine
    // We use ctx.runQuery because we are in an Action
    const routine = await ctx.runQuery(api.routines.get, {
      id: args.routineId,
    });

    if (!routine) {
      throw new Error("Routine not found or unauthorized");
    }

    // Double check ownership (though 'get' already does it, good for safety)
    if (routine.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    // 2. Connect to Temporal
    const connection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS || "localhost:7233",
    });

    const client = new Client({
      connection,
      namespace: process.env.TEMPORAL_NAMESPACE || "default",
    });

    // 3. Prepare Input
    const routineInput = {
      routineId: routine._id,
      userId: routine.userId,
      nodes: routine.nodes.map((node: any) => ({
        id: node.id,
        pluginId: node.pluginId,
        type: node.type,
        config: node.config || {},
        enabled: node.enabled,
      })),
      connections: routine.connections,
      triggerData: {
        timestamp: Date.now(),
        source: "manual-trigger",
        triggerType: routine.triggerType,
      },
    };

    const workflowId = `manual-${routine._id}-${Date.now()}`;

    // 4. Start Workflow
    const handle = await client.workflow.start("routineExecutor", {
      taskQueue: "default",
      args: [routineInput],
      workflowId,
    });

    // 5. Update last executed timestamp
    await ctx.runMutation(api.routines.updateLastExecuted, {
      id: routine._id,
      timestamp: Date.now(),
    });

    return {
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
    };
  },
});
