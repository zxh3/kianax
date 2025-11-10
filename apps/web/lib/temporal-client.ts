/**
 * Temporal Client Singleton
 *
 * Provides a singleton Temporal client for the Next.js app.
 * Used by API routes and Convex functions to start routine executions.
 *
 * IMPORTANT: Only use this in server-side code (API routes, Server Components, Convex).
 * Never import this in client components.
 *
 * TERMINOLOGY NOTE:
 * - "Routine" = user-facing automation (product concept)
 * - "Workflow" = Temporal's execution engine (infrastructure concept)
 * - We start Temporal Workflows to execute user Routines
 */

import { Client, Connection } from "@temporalio/client";

let client: Client | null = null;
let connection: Connection | null = null;

/**
 * Get or create the Temporal client singleton
 */
export async function getTemporalClient(): Promise<Client> {
  if (client) {
    return client;
  }

  // Create connection
  const address = process.env.TEMPORAL_ADDRESS || "localhost:7233";

  // For Temporal Cloud (production)
  if (process.env.TEMPORAL_CLIENT_CERT && process.env.TEMPORAL_CLIENT_KEY) {
    connection = await Connection.connect({
      address,
      tls: {
        clientCertPair: {
          crt: Buffer.from(process.env.TEMPORAL_CLIENT_CERT, "base64"),
          key: Buffer.from(process.env.TEMPORAL_CLIENT_KEY, "base64"),
        },
      },
    });
  } else {
    // Local development
    connection = await Connection.connect({ address });
  }

  // Create client
  client = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || "default",
  });

  console.log("✅ Temporal client initialized");
  console.log(`   Address: ${address}`);
  console.log(`   Namespace: ${process.env.TEMPORAL_NAMESPACE || "default"}`);

  return client;
}

/**
 * Start a routine execution (via Temporal Workflow)
 *
 * @example
 * const handle = await startRoutine('routineExecutor', {
 *   workflowId: 'routine-123',
 *   taskQueue: 'kianax-workflows',
 *   args: [routineDefinition],
 * });
 */
export async function startRoutine<_T = any>(
  workflowType: string,
  options: {
    workflowId: string; // Still called workflowId for Temporal compatibility
    taskQueue: string;
    args: any[];
    cronSchedule?: string;
  },
) {
  const client = await getTemporalClient();

  const handle = await client.workflow.start(workflowType, {
    workflowId: options.workflowId,
    taskQueue: options.taskQueue,
    args: options.args,
    cronSchedule: options.cronSchedule,
  });

  return handle;
}

/**
 * Get routine execution handle
 */
export async function getRoutineHandle(routineId: string) {
  const client = await getTemporalClient();
  return client.workflow.getHandle(routineId);
}

/**
 * Cancel a routine execution
 */
export async function cancelRoutine(routineId: string) {
  const handle = await getRoutineHandle(routineId);
  await handle.cancel();
}

/**
 * Query routine execution status
 */
export async function getRoutineStatus(routineId: string) {
  const handle = await getRoutineHandle(routineId);
  return await handle.describe();
}
