import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@kianax/server/convex/_generated/api";
import type { Id } from "@kianax/server/convex/_generated/dataModel";
import { getToken } from "@kianax/web/lib/auth-server";
import { parseWebEnv } from "@kianax/config";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Authenticate user
    const token = await getToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const routineId = id as Id<"routines">;

    // Get env config
    const env = parseWebEnv();

    // Initialize Convex client
    const convex = new ConvexHttpClient(env.convex.publicUrl);
    convex.setAuth(token);

    // Fetch routine
    const routine = await convex.query(api.routines.get, { id: routineId });
    if (!routine) {
      return NextResponse.json({ error: "Routine not found" }, { status: 404 });
    }

    // Import Temporal client
    const { Client, Connection } = await import("@temporalio/client");

    // Connect to Temporal
    const connection = await Connection.connect({
      address: env.temporal.address,
    });

    const client = new Client({
      connection,
      namespace: env.temporal.namespace,
    });

    // Convert routine to workflow input
    const routineInput = {
      routineId: routine._id,
      userId: routine.userId,
      nodes: routine.nodes.map((node: any) => ({
        id: node.id,
        pluginId: node.pluginId,
        config: node.config || {},
        credentialMappings: node.credentialMappings,
      })),
      connections: routine.connections,
      triggerData: {
        timestamp: Date.now(),
        source: "manual-trigger",
        triggerType: routine.triggerType,
      },
    };

    // Generate workflow ID
    const workflowId = `manual-${routine._id}-${Date.now()}`;

    // Start workflow
    const handle = await client.workflow.start("routineExecutor", {
      taskQueue: "default",
      args: [routineInput],
      workflowId,
    });

    // Update last executed timestamp
    await convex.mutation(api.routines.updateLastExecuted, {
      id: routineId,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      workflowId: handle.workflowId,
      message: "Workflow started successfully",
    });
  } catch (error: any) {
    console.error("Failed to execute workflow:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute workflow" },
      { status: 500 },
    );
  }
}
